'use strict';
var Promise = require('lie');
var log = require('./utils/log');
var filePaths = require('./utils/filePaths');
var thaliTapeOpts = require('./utils/thaliTapeOpts');

var allTestsSucceed;

function init () {
  allTestsSucceed = true;
}

function executeTest (filePath) {
  return thaliTapeOpts()
    .then(function (opts) {
      var thaliTape = require('../lib/thaliTape');
      require(filePath);

      var version = opts.version;
      var hasRequiredHardware = opts.hasRequiredHardware;
      // TODO usage of global variable `nativeUTFailed` is awful
      var nativeUTFailed = global.nativeUTFailed;
      // TODO thaliTape `begin` method this signature looks ugly
      return thaliTape
        .begin(version, hasRequiredHardware, nativeUTFailed)
        .then(function (res) {
          log('Succeed');
        })
        .catch(function (error) {
          log.error('Failed with an error\n', error);
          allTestsSucceed = false;
        });
    });
}

function logResults () {
  log('\n\n')
  log(' -----------------')
  log('|  TESTS SUMMARY  |');
  log(' -----------------\n\n')

  if (allTestsSucceed) {
    log('Congrats! All tests succeed!');
  } else {
    log('Some of the tests failed. See above for more details.');
  }
}

var WITH_JS_SUFFIX = /.js$/;

/**
 * @param {Object} opts includes `filter` by which tests are selected
 */
module.exports = function (opts) {
  init();

  var location = opts.filter;
  log('Looking for tests in ', location);

  var testFiles = filePaths(location, WITH_JS_SUFFIX);
  log('Going to execute ', testFiles.length, ' test file(s)');

  return testFiles
    .reduce(function (sequence, filePath) {
      return sequence
        .then(function () {
          log('Executing ', filePath);
          return executeTest(filePath);
        })
        .catch(function (error) {
          log('Failed to execute ', filePath);
          log.error('Got an error: ', error);
          allTestsSucceed = false;
        });
    }, Promise.resolve())
    .then(logResults);
};