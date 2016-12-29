'use strict';

var util   = require('util');
var format = util.format;

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

var DEFAULT_PLATFORM = platform.names.ANDROID;
var mockPlatform;

var argv = require('minimist')(process.argv.slice(2), {
  string: ['platform', 'networkType'],
  default: {
    'platform': DEFAULT_PLATFORM
  }
});

// The global.Mobile object is replaced here after thaliTape
// has been required so that thaliTape can pick up the right
// test framework to be used.
if (typeof Mobile === 'undefined') {
  mockPlatform = require('./lib/parsePlatformArg')() || DEFAULT_PLATFORM;
  global.Mobile = require('./lib/wifiBasedNativeMock.js')(mockPlatform);
} else {
  mockPlatform = Mobile._platform; // mock may be created in UnitTest_app.js
}

var networkTypes = require('thali/NextGeneration/thaliMobile').networkTypes;

if (argv.networkType) {
  var networkType = argv.networkType.toUpperCase();
  switch (networkType) {
    case networkTypes.WIFI:
    case networkTypes.NATIVE:
    case networkTypes.BOTH: {
      global.NETWORK_TYPE = networkType;
      break;
    }
    default: {
      logger.warn(
        'Unrecognized network type: ' + networkType + '. ' +
        'Available network types: ' + [
          networkTypes.WIFI,
          networkTypes.NATIVE,
          networkTypes.BOTH,
        ].join(', ')
      );
      process.exit(1);
    }
  }
}

var hasJavaScriptSuffix = function (path) {
  return path.indexOf('.js', path.length - 3) !== -1;
};

var loadFile = function (filePath) {
  logger.info('Test runner loading file:', filePath);
  try {
    require(filePath);
  } catch (error) {
    var prettyError = format(
      'test load failed, filePath: \'%s\', error: \'%s\', stack: \'%s\'',
      filePath, error.toString(), error.stack
    );
    logger.error(prettyError);
    throw new Error(prettyError);
  }
};

var testsToRun = argv._[0] || 'bv_tests';

var currentPlatform = platform.name;
// Our current platform can be 'darwin', 'linux', 'windows', etc.
// Our 'thaliTape' expects all these platforms will be named as 'desktop'.
if (!platform.isMobile) {
  currentPlatform = 'desktop';
}

logger.info(
  'Starting tests. ' +
  'Network type: ' + global.NETWORK_TYPE + '. ' +
  'Platform: ' + (mockPlatform || currentPlatform)
);

if (hasJavaScriptSuffix(testsToRun)) {
  loadFile(path.join(__dirname, testsToRun));
} else {
  fs.readdirSync(path.join(__dirname, testsToRun))
  .forEach(function (fileName) {
    if (fileName.indexOf('test') === 0 && hasJavaScriptSuffix(fileName)) {
      var filePath = path.join(__dirname, testsToRun, fileName);
      loadFile(filePath);
    }
  });
}

testUtils.hasRequiredHardware()
  .then(function (hasRequiredHardware) {

    return testUtils.enableRequiredHardware()
      .then(function (enableRequiredHardware) {

        return testUtils.getOSVersion()
          .then(function (version) {

            return thaliTape.begin(
              currentPlatform, version,
              hasRequiredHardware || enableRequiredHardware,
              global.nativeUTFailed
            );
          });
      });
  })
  .then(function () {
    logger.info('Finished');
    process.exit(0);
  })
  .catch(function (error) {
    logger.error(error.message + '\n' + error.stack);
    process.exit(1);
  });
