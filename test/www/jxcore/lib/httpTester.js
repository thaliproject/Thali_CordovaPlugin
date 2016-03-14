'use strict';
var request = require('request');
var express = require('express');
var Promise = require('lie');

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
 * This function registers new path to the incoming express router object.
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


