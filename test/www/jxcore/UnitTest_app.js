/*
 * This file needs to be renamed as app.js when we want to run unit tests
 * in order this to get loaded by the jxcore ready event.
 * This effectively acts as main entry point to the unit test app
 */

'use strict';

if (typeof Mobile === 'undefined') {
  global.Mobile = require('./lib/wifiBasedNativeMock.js')();
}

var config = require('./config.json');
var objectAssign = require('object-assign');
process.env = objectAssign(process.env, config.env);

var Promise = require('bluebird');

var ThaliMobile = require('thali/NextGeneration/thaliMobile');
var platform = require('thali/NextGeneration/utils/platform');
var testUtils = require('./lib/testUtils');

var logger = require('./lib/testLogger')('UnitTest_app');

var utResult = false;

if (process.platform === 'android' || process.platform === 'ios') {
  logger.debug('Running unit tests');
  Mobile('executeNativeTests').callNative(function (result) {
    utResult = true;
    if (result && result.executed) {
      logger.debug('Total number of executed tests: ', result.total);
      logger.debug('Number of passed tests: ', result.passed);
      logger.debug('Number of failed tests: ', result.failed);
      logger.debug('Number of ignored tests: ', result.ignored);
      logger.debug('Total duration: ', result.duration);
      if (result.failed > 0) {
        logger.debug('Failures: \n', result.failures);
        utResult = false;
      }
    }
  });
} else {
  // We aren't on a device so we can't run those tests anyway
  utResult = true;
}

if (!utResult) {
  logger.debug('Failed to execute UT.');
  global.nativeUTFailed = true;
} else {
  global.nativeUTFailed = false;
}

// TODO finish testing here (the node part will be omitted)
// console.log('****TEST_LOGGER:[PROCESS_ON_EXIT_SUCCESS]****');
// return;

// Issue #914
var networkTypes = [
  ThaliMobile.networkTypes.WIFI,
  ThaliMobile.networkTypes.NATIVE,
  ThaliMobile.networkTypes.BOTH,
];

var testFiles = process.argv[2] || null;

var getDeviceName = function () {
  return new Promise(function (resolve) {
    Mobile('GetDeviceName').callNative(resolve);
  });
};

ThaliMobile.getNetworkStatus().then(function (networkStatus) {
  var promiseList = [];
  if (networkStatus.wifi === 'off') {
    promiseList.push(testUtils.toggleWifi(true));
  }
  if (networkStatus.bluetooth === 'off') {
    promiseList.push(testUtils.toggleBluetooth(true));
  }
  Promise.all(promiseList)
  .then(getDeviceName)
  .then(function (name) {
    logger.debug('My device name is: %s', name);
    testUtils.setName(name);
  })
  .then(function () {
    var TestRunner = require('./runTests.js');
    var runner = new TestRunner({
      networkTypes: networkTypes,
      platforms: [platform.name],
      testFiles: testFiles,
      nativeUTFailed: global.nativeUTFailed,
    });
    return runner.runTests();
  })
  .then(function () {
    process.exit(0);
  })
  .catch(function (error) {
    logger.error(error.message + '\n' + error.stack);
    process.exit(1);
  });
});

logger.debug('Unit Test app is loaded');
