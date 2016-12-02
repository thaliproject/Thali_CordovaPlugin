'use strict';

var Logger = require('thali/ThaliLogger');
var platform = require('thali/NextGeneration/utils/platform');

var logCallback;
var messages = [];

var isMobile = platform.isMobile;

if (isMobile) {
  Mobile('setLogCallback').registerAsync(function (callback) {
    logCallback = callback;
    messages.forEach(function (message) {
      logCallback(message);
    });
    messages = [];
  });
}

/**
* Log a message to the screen - only applies when running on Mobile.
* It assumes we are using our test framework with our Cordova WebView
* who is setup to receive logging messages and display them.
* @param {object} meta Winston's meta object
* @returns {object} A Winston logger object
*/
module.exports = function (meta) {
  var logger = Logger(meta);
  if (isMobile) {
    logger._thaliLogger.on('message', function (message) {
      // 'logCallback' is required.
      // We should save all messages before it will be available.
      if (logCallback) {
        logCallback(message);
      } else {
        messages.push(message);
      }
    });
  }
  return logger;
};
