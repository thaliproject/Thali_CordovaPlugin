var request = require('request');
var PromiseQueue = require('thali/NextGeneration/promiseQueue');
var promiseQueue = new PromiseQueue();
  
var requestSettings = {
  method: 'GET',
  url: '',
  encoding: null
};
/**
 * This function will generate HTTP requests to selected endpoint with 
 * a delay. 
 * @param {object[]} testArray - An array of HTTP requests, delay and handler
 * testArray example:
 * [
 *   { url:'http://localhost:3000/NotificationBeacons', delay:0, handler:function (){}},
 *   { url:'http://localhost:3000/NotificationBeacons', delay:100, handler:function (){}}
 * ];
**/
module.exports.runTest = function (testArray) {
  var delay = 0;
  testArray.forEach(function (test) {
    delay += test.delay;
    setTimeout( function () {
      requestSettings.url = test.url;
      request(requestSettings, function (error, response, body) {
        if (test.handler) {
          test.handler(error, response, body);
        }
      });
    }, delay);
  });
};
