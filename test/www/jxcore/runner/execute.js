'use strict';
var Promise = require('lie');
var log = require('./utils/log');
var filePaths = require('./utils/filePaths');
var thaliTapeOpts = require('./utils/thaliTapeOpts');
var thaliTape = require('../lib/thaliTape');
var MobileMock = require('../lib/wifiBasedNativeMock.js');

function executeTests (filePaths) {
  return thaliTapeOpts()
    .then(function (opts) {
      filePaths.forEach(function (filePath) {
        require(filePath);
      });

      var version = opts.version;
      var hasRequiredHardware = opts.hasRequiredHardware;
      // TODO usage of global variable `nativeUTFailed` is awful
      // it should be fixed
      var nativeUTFailed = global.nativeUTFailed;
      // TODO thaliTape `begin` method this signature looks ugly
      // it should be fixed
      return thaliTape
        .begin(version, hasRequiredHardware, nativeUTFailed);
    });
}

var WITH_JS_SUFFIX = /.js$/;

/**
 * @param {String[]} locations - a list of folders and files
 */
module.exports = function (locations) {
  log('Looking for tests in ', locations);

  var testFiles = filePaths(locations, WITH_JS_SUFFIX);
  log('Going to execute ', testFiles.length, ' test file(s)');

  return executeTests(testFiles)
    .catch(log.error);
};