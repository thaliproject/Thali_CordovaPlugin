'use strict';

var util   = require('util');
var format = util.format;

var fs           = require('fs-extra-promise');
var path         = require('path');
var randomString = require('randomstring');
var Promise      = require('bluebird');
var assign       = require('object-assign');


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
var asserts   = require('./lib/utils/asserts');
var logger    = require('./lib/testLogger')('runTests');

var platform = require('thali/NextGeneration/utils/platform');

// The global.Mobile object is replaced here after thaliTape
// has been required so that thaliTape can pick up the right
// test framework to be used.
if (typeof Mobile === 'undefined') {
  global.Mobile = require('./lib/wifiBasedNativeMock.js')();
}

var currentPlatform = platform.name;
// Our current platform can be 'darwin', 'linux', 'windows', etc.
// Our 'thaliTape' expects all these platforms will be named as 'desktop'.
if (!platform.isMobile) {
  currentPlatform = 'desktop';
}

var hasJavaScriptSuffix = function (path) {
  return path.indexOf('.js', path.length - 3) !== -1;
};

var requireUncached = function (moduleName) {
  delete require.cache[require.resolve(moduleName)];
  return require(moduleName);
};

var loadFile = function (filePath) {
  logger.info('Test runner loading file:', filePath);
  try {
    requireUncached(filePath);
  } catch (error) {
    var message = format(
      'test load failed, filePath: \'%s\', error: \'%s\', stack: \'%s\'',
      filePath, error.toString(), error.stack
    );
    logger.error(message);
    throw new Error(message);
  }
};

function TestRunner(options) {
  options = assign({}, TestRunner.defaults, options);
  this._networkTypes = options.networkTypes;
  this._platforms = options.platforms;
  this._testFiles = options.testFiles;
  this._nativeUTFailed = options.nativeUTFailed;
  asserts.isString(this._testFiles);
  asserts.isArray(this._networkTypes);
  asserts.isArray(this._platforms);
  asserts.isBool(this._nativeUTFailed);
  this._state = {
    testsLoaded: false,
  };
}

TestRunner.defaults = {
  networkTypes: [global.NETWORK_TYPE],
  platforms: [platform.names.ANDROID],
  testFiles: 'bv_tests',
};

TestRunner.prototype.loadTests = function () {
  if (this._state.testsLoaded) {
    return;
  }
  this._state.testsLoaded = true;
  this._networkTypes.forEach(function (networkType) {
    this._platforms.forEach(function (platformName) {
      this._setTestEnvironment({
        networkType: networkType,
        platformName: platformName,
      });
      logger.info('Loading test files for', networkType, platformName);
      this._loadTestFiles(this._testFiles);
    }, this);
  }, this);
};

TestRunner.prototype.runTests = function () {
  var self = this;

  this.loadTests();
  return Promise.all([
    testUtils.hasRequiredHardware(),
    testUtils.getOSVersion()
  ]).spread(function (hasRequiredHardware, version) {
    return thaliTape.begin(
      currentPlatform,
      version,
      hasRequiredHardware,
      self._nativeUTFailed
    );
  });
};

TestRunner.prototype._loadTestFiles = function () {
  var testsPath = path.join(__dirname, this._testFiles);
  if (hasJavaScriptSuffix(this._testFiles)) {
    loadFile(testsPath);
  } else {
    fs.readdirSync(testsPath).forEach(function (fileName) {
      if (fileName.indexOf('test') === 0 && hasJavaScriptSuffix(fileName)) {
        var filePath = path.join(testsPath, fileName);
        loadFile(filePath);
      }
    });
  }
};

TestRunner.prototype._setTestEnvironment = function (environment) {
  var test = thaliTape();
  var testName = format(
    'Change environment (network: %s, platform: %s)',
    environment.networkType,
    environment.platformName
  );
  test(testName, function (t) {
    platform._override(environment.platformName);
    global.NETWORK_TYPE = environment.networkType;
    t.pass('Updated');
    t.end();
  });
};

if (require.main === module) {
  var testRunner = new TestRunner({
    testFiles: process.argv[2] || 'bv_tests',
    nativeUTFailed: false,
  });
  testRunner.runTests().then(function () {
    process.exit(0);
  }).catch(function (error) {
    logger.error(error);
    process.exit(1);
  });
} else {
  module.exports = TestRunner;
}
