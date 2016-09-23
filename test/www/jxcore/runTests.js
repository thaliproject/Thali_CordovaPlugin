'use strict';

var fs           = require('fs-extra-promise');
var path         = require('path');
var randomString = require('randomstring');


// Before including anything serious from thali we want to ensure
// that we have SSDP_NT env defined.
if (!process.env.SSDP_NT) {
  // We want to provide a new random value.
  process.env.SSDP_NT = randomString.generate({
    length: 'http://www.thaliproject.org/ssdp'.length
  });
}

var thaliTape = require('./lib/thaliTape');
var testUtils = require('./lib/testUtils');
var logger    = require('./lib/testLogger')('runTests');

var platform = require('thali/NextGeneration/utils/platform');

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
    if ((fileName.indexOf('test') === 0) &&
         hasJavaScriptSuffix(fileName)) {
      var filePath = path.join(__dirname, testsToRun, fileName);
      loadFile(filePath);
    }
  });
}

var currentPlatform = platform.name;

testUtils.hasRequiredHardware()
.then(function (hasRequiredHardware) {
  return testUtils.getOSVersion()
  .then(function (version) {
    return thaliTape.begin(currentPlatform, version, hasRequiredHardware);
  })
})
.then(function () {
  process.exit(0);
})
.catch(function () {
  process.exit(1);
});
