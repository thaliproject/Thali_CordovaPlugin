'use strict';

/*
Thali unit test implementation of tape.
Highly inspired by wrapping-tape.
Usage is very similar to the wrapping tape:

var tape = require('thaliTape');

var test = tape({
  setup: function(t) {
    // will be called after each test has started to setup the test
    // after the next line, the actual test code will be executed
    t.end();
  },
  teardown: function(t) {
    // will be called after each device has ended the test
    // do any final tear down for the test in here
    t.end();
  },
  emitRetryCount:   120,
  emitRetryTimeout: 3 * 1000,
  setupTimeout:     1 * 60 * 1000,
  testTimeout:      10 * 60 * 1000,
  teardownTimeout:  1 * 60 * 1000
});
*/

var Promise = require('bluebird');

var testUtils = require('./testUtils');


Promise.config({
  warnings:        true,
  longStackTraces: true,
  cancellation:    true,
  monitoring:      true
});

var logger = testUtils.logger;

process
.on('SIGINT', function () {
  logger.error('got \'SIGINT\', terminating');
  process.exit(130); // Ctrl-C std exit code
})
.on('uncaughtException', function (error) {
  logger.error(
    'uncaught exception, error: \'%s\', stack: \'%s\'',
    error.toString(), error.stack
  );
  logger.error('****TEST_LOGGER:[PROCESS_ON_EXIT_FAILED]****');
  process.exit(1);
})
.on('unhandledRejection', function (error, p) {
  logger.error(
    'uncaught promise rejection, error: \'%s\', stack: \'%s\'',
    error.toString(), error.stack
  );
  logger.error('****TEST_LOGGER:[PROCESS_ON_EXIT_FAILED]****');
  process.exit(2);
});

var exports;
if (typeof jxcore === 'undefined' || typeof Mobile !== 'undefined') {
  // On mobile, or outside of jxcore (some dev scenarios)
  // we use the server-coordinated thaliTape.
  exports = require('./CoordinatedTape');
  exports.coordinated = true;
} else {
  // On desktop we just use simple non-coordinated tape.
  exports = require('./SimpleTape');
  exports.coordinated = false;
}

module.exports = exports;
