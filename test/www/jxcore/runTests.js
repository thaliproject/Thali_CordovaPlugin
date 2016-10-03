'use strict';

var util   = require('util');
var format = util.format;

var assert       = require('assert');
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

var DEFAULT_TESTS_DIRECTORY = 'bv_tests';

// 'fileName' should start with 'test' and end with '.js'.
function isFileNameValid (fileName) {
  return /^test.*?\.js$/i.test(fileName);
}

function getTestFromFile (directory, fileName) {
  assert(isFileNameValid(fileName), 'file name should be valid');
  var filePath = path.resolve(path.join(directory, fileName));
  assert(fs.existsSync(filePath), 'test file should exist');
  return filePath;
}

function getTestsFromDirectory (directory) {
  var tests = fs.readdirSync(directory)
  .filter(function (fileName) {
    return isFileNameValid(fileName);
  })
  .map(function (fileName) {
    return path.resolve(path.join(directory, fileName));
  });
  tests.forEach(function (filePath) {
    assert(fs.existsSync(filePath), 'test file should exist');
  });
  assert(tests.length > 0, 'we should have at least one test');
  return tests;
}

function getTestsFromPath (testPath) {
  if (fs.isDirectorySync(testPath)) {
    return getTestsFromDirectory(testPath);
  } else {
    return [getTestFromFile(
      path.dirname (testPath),
      path.basename(testPath)
    )];
  }
}

var tests;
if (process.argv.length < 3) {
  tests = getTestsFromDirectory(DEFAULT_TESTS_DIRECTORY);
} else if (process.argv.length === 3) {
  tests = getTestsFromPath(process.argv[2]);
} else {
  logger.warn(
    'arguments won\'t be used:',
    process.argv.slice(3)
    .map(function (argument) {
      return '\'' + argument + '\'';
    })
    .join(', ')
  );
  tests = getTestsFromPath(process.argv[2]);
}

var currentPlatform = platform.name;
// Our current platform can be 'darwin', 'linux', 'windows', etc.
// Our 'thaliTape' expects all these platforms will be named as 'desktop'.
if (!platform.isMobile) {
  currentPlatform = 'desktop';
}

testUtils.hasRequiredHardware()
.then(function (hasRequiredHardware) {
  return testUtils.getOSVersion()
  .then(function (version) {
    return thaliTape.begin(tests, {
      platform:            currentPlatform,
      version:             version,
      hasRequiredHardware: hasRequiredHardware
    });
  });
})
.then(function () {
  process.exit(0);
})
.catch(function () {
  process.exit(1);
});
