'use strict';

var fs = require('fs-extra-promise');
var path = require('path');
var thaliTape = require('./lib/thaliTape');
var testUtils = require('./lib/testUtils');
var logger = require('thali/thaliLogger')('runTests');

// The global.Mobile object is replaced here after thaliTape
// has been required so that thaliTape can pick up the right
// test framework to be used.
if (typeof Mobile === 'undefined') {
  global.Mobile = require('./lib/wifiBasedNativeMock.js')();
}

var hasJavaScriptSuffix = function (path) {
  return path.indexOf('.js', path.length - 3) !== -1;
};

var loadFile = function (filePath) {
  console.info('Test runner loading file: ' + filePath);
  try {
    require(filePath);
  } catch (error) {
    logger.error(error);
    throw new Error('Error when loading file ' + filePath + ': ' + error);
  }
};

var testsToRun = process.argv.length > 2 ? process.argv[2] : 'bv_tests';

if (hasJavaScriptSuffix(testsToRun)) {
  loadFile(path.join(__dirname, testsToRun));
} else {
  fs.readdirSync(path.join(__dirname, testsToRun)).forEach(function (fileName) {
    if ((fileName.indexOf('test') === 0) && hasJavaScriptSuffix(fileName)) {
      var filePath = path.join(__dirname, testsToRun, fileName);
      loadFile(filePath);
    }
  });
}

module.exports.run = function () {
  return testUtils.hasRequiredHardware()
    .then(function (hasRequiredHardware) {
      return testUtils.getOSVersion()
      .then(function (version) {
        console.log('ThaliTestRunner :: Running ThaliTape');
        return thaliTape.begin(version, hasRequiredHardware);
      });
    });
};

// If running this script from CLI
// http://thlorenz.com/blog/how-to-detect-if-a-nodejs-module-is-run-as-a-script/
// then execute immediatly
if (!module.parent) {
  module.exports.run();
}
