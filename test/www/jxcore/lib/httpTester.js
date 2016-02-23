var request = require('request');
var PromiseQueue = require('thali/NextGeneration/promiseQueue');
var promiseQueue = new PromiseQueue();

/**
 * @public
 * @typedef HTTPRequest
 * @type {Object}
 * @property {string} url The request URL.
 * @property {number} delay The delay before request.
 * @property {callback} handler The callback function that handles the response
*/

/**
 * This function will generate HTTP requests to selected endpoint with 
 * a delay.
 * @param {HTTPRequest[]} testArray - An array of HTTP requests.
*/
module.exports.runTest = function (httpRequestArray) {
  var delay = 0;
  httpRequestArray.forEach(function (test) {
    delay += test.delay;
    setTimeout( function () {
      var requestSettings = {
        method: 'GET',
        url: '',
        encoding: null 
      };
      
      requestSettings.url = test.url;
      request(requestSettings, function (error, response, body) {
        if (test.handler) {
          test.handler(error, response, body);
        }
      });
    }, delay);
  });
};
