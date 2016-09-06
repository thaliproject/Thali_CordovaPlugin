'use strict';
var Promise = require('lie');
var log = require('./utils/log');
var filePaths = require('./utils/filePaths');
var thaliTapeOpts = require('./utils/thaliTapeOpts');
var thaliTape = require('../lib/thaliTape');
var MobileMock = require('../lib/wifiBasedNativeMock.js');

var mobileShouldBeMocked = global.Mobile === undefined;
if (mobileShouldBeMocked) {
  global.Mobile = new MobileMock();
}

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
 * @param {Object} opts includes `filter` by which tests are selected
 */
module.exports = function (opts) {
  var location = opts.files;
  log('Looking for tests in ', location);

  var testFiles = filePaths(location, WITH_JS_SUFFIX);
  log('Going to execute ', testFiles.length, ' test file(s)');

  return executeTests(testFiles)
    .catch(log.error);
};