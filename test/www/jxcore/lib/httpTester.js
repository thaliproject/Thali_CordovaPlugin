'use strict';
var request = require('request');

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

module.exports.runServer = function () {
  var express = require('express');
  var app = express();

  app.get('/', function (req, res) {
    res.send('Hello World!');
  });

  app.listen(5000, function () {
    console.log('Example app listening on port 3000!');
  });
};


