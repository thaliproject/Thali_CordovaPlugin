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
 * This function registers the path to start to serve incoming
 * http requests to.
 *
 * @param {Object} router An express router object
 * @param {string} url The request URL
 * @param {number} responseCode HTTP response code
 * @param {string} body response body
 * @param {number} times how many times same body is sent
 * @param {?number} delay how long delay before sending response
 */
module.exports.runServer = function (router, url, responseCode, body, times,
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
  router.get(url, delayCallback, requestHandler);
};


