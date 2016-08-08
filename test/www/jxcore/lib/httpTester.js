'use strict';
var request = require('request');
var express = require('express');
var https = require('https');
var ForeverAgent = require('forever-agent');
var Promise = require('lie');
var thaliConfig =
  require('thali/NextGeneration/thaliConfig');
var makeIntoCloseAllServer =
  require('thali/NextGeneration/makeIntoCloseAllServer');
var thaliNotificationBeacons = require('thali/NextGeneration/notification/thaliNotificationBeacons');
var urlSafeBase64 = require('urlsafe-base64');

var gPskIdentity = 'I am me!';
var gPskKey = new Buffer('I am a reasonable long string');

var pskIdToSecret = function (id) {
  return id === gPskIdentity ? gPskKey : null;
};

/**
 * This function will generate HTTP request to selected endpoint and calls
 * provided callback when the request is finished.
 * @param {string} url The request URL.
 * @param {callback} handler The callback function that handles the response
*/
module.exports.runTest = function (url, handler) {
  var requestSettings = {
    method: 'GET',
    url: '',
    encoding: null
  };

  requestSettings.url = url;
  request(requestSettings, function (error, response, body) {
    if (handler) {
      handler(error, response, body);
    }
  });
};

/**
 * This function registers a new path to the incoming express router object.
 * This service can be used to test different HTTP client scenarios
 * such as connecting to a delayed service.
 *
 * @param {Object} router An express router object
 * @param {string} path A request path
 * @param {number} responseCode HTTP response code
 * @param {string} body a Response body
 * @param {number} times Tells how many times the body is written to the
 * response.
 * @param {?number} delay A delay before sending a response
 */
module.exports.runServer = function (router, path, responseCode, body, times,
                                     delay) {

  var requestHandler = function (req, res) {
    res.set('Content-Type', 'application/octet-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.status(responseCode);
    for (var i = 0 ; i < times ; i++){
      res.write(body);
    }
    res.end();
  };

  delay = delay || 0;

  var delayCallback = function (req, res, next){ setTimeout(next, delay);};
  router.get(path, delayCallback, requestHandler);
};

module.exports.getTestAgent = function (pskIdentity, pskKey) {

  pskIdentity = pskIdentity || gPskIdentity;
  pskKey = pskKey || gPskKey;

  return new ForeverAgent.SSL({
    keepAlive: true,
    keepAliveMsecs: thaliConfig.TCP_TIMEOUT_WIFI/2,
    maxSockets: Infinity,
    maxFreeSockets: 256,
    ciphers: thaliConfig.SUPPORTED_PSK_CIPHERS,
    pskIdentity: pskIdentity,
    pskKey: pskKey
  });
};

module.exports.getTestHttpsServer = function (expressApp,
                                              expressRouter,
                                              pskCallback){

  pskCallback = pskCallback || pskIdToSecret;

  return new Promise(function (resolve, reject) {
    // Initializes the server with the expressRouter
    expressApp.use('/', expressRouter);

    var options = {
      ciphers: thaliConfig.SUPPORTED_PSK_CIPHERS,
      key: thaliConfig.BOGUS_KEY_PEM,
      cert: thaliConfig.BOGUS_CERT_PEM,
      pskCallback : pskCallback
    };

    var expressServer = https.createServer(options, expressApp).
    listen(0, function (err) {
      if (err) {
        reject(err);
      } else {
        expressServer = makeIntoCloseAllServer(expressServer);
        resolve(expressServer);
      }
    });
  });
};

module.exports.pskGet = function(serverPort, path, pskId, pskKey, host) {
  return new Promise(function (resolve, reject) {
    https.get({
      hostname: host ? host : '127.0.0.1',
      path: path,
      port: serverPort,
      agent: false,
      pskIdentity: pskId,
      pskKey: pskKey
    }, function (res) {
      if (res.statusCode !== 200) {
        var error = new Error('response code was ' + res.statusCode);
        error.statusCode = res.statusCode;
        return reject(error);
      }
      var response = '';
      res.on('data', function (chunk) {
        response += chunk;
      });
      res.on('end', function () {
        resolve(response);
      });
      res.on('error', function (err) {
        reject(err);
      });
    }).on('error', function (err) {
      reject(err);
    });
  });
};

module.exports.generateSeqDocPath = function (devicePublicKey) {
  return '_local/' + thaliConfig.LOCAL_SEQ_POINT_PREFIX +
    urlSafeBase64.encode(devicePublicKey);
};

module.exports.getSeqDoc = function(dbName, serverPort, pskId, pskKey,
                                    devicePublicKey, host) {
  var path = thaliConfig.BASE_DB_PATH + '/' + dbName + '/' +
    module.exports.generateSeqDocPath(devicePublicKey);
  return module.exports.pskGet(serverPort, path, pskId, pskKey, host)
    .then(function (responseBody) {
      return JSON.parse(responseBody);
    });
};

module.exports.validateSeqNumber = function (t, dbName, serverPort, seq,
                                             pskId, pskKey, devicePublicKey,
                                             host, retries) {
  return module.exports.getSeqDoc(dbName, serverPort, pskId, pskKey,
                                  devicePublicKey, host)
    .then(function (pouchResponse) {
      t.equal(pouchResponse.lastSyncedSequenceNumber, seq);
      return pouchResponse;
    })
    .catch(function (err) {
      if (retries && retries > 0) {
        return module.exports.validateSeqNumber(t, dbName, serverPort, seq,
          pskId, pskKey, devicePublicKey, host, retries - 1);
      }
      return Promise.reject(err);
    });
};
