/*
 * This file needs to be renamed as app.js when we want to run unit tests
 * in order this to get loaded by the jxcore ready event.
 * This effectively acts as main entry point to the unit test app
 */

'use strict';

if (typeof Mobile === 'undefined') {
  global.Mobile = require('./lib/wifiBasedNativeMock.js')();
}

var logger = require('./lib/testLogger')('UnitTest_app');
var testUtils = require('./lib/testUtils');
var ThaliMobile = require('thali/NextGeneration/thaliMobile');
var Promise = require('bluebird');
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
}

// TODO finish testing here (the node part will be omitted)
// console.log('****TEST_LOGGER:[PROCESS_ON_EXIT_SUCCESS]****');
// return;

// Issue #914
var networkTypes = [ThaliMobile.networkTypes.WIFI];

ThaliMobile.getNetworkStatus()
.then(function (networkStatus) {
  var promiseList = [];
  if (networkStatus.wifi === 'off') {
    promiseList.push(testUtils.toggleWifi(true));
  }
  if (networkStatus.bluetooth === 'off') {
    promiseList.push(testUtils.toggleBluetooth(true));
  }
  Promise.all(promiseList)
  .then(function () {
    Mobile('GetDeviceName').callNative(function (name) {
      logger.debug('My device name is: %s', name);
      testUtils.setName(name);

      networkTypes.reduce(function (sequence, networkType) {
        return sequence
          .then(function () {
            logger.debug('Running for ' + networkType + ' network type');
            global.NETWORK_TYPE = networkType;
            require('./runTests.js');
          });
      }, Promise.resolve())
      .catch(function (error) {
        logger.error(error);
      });
    });
  });
});

logger.debug('Unit Test app is loaded');
