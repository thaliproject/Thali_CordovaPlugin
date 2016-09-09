/*
 * This file needs to be renamed as app.js when we want to run unit tests
 * in order this to get loaded by the jxcore ready event.
 * This effectively acts as main entry point to the unit test app
 */

'use strict';

if (typeof Mobile === 'undefined') {
  global.Mobile = require('./lib/wifiBasedNativeMock.js')();
}

var testUtils = require('./lib/testUtils');
var ThaliMobile = require('thali/NextGeneration/thaliMobile');
var Promise = require('lie');
var utResult = false;

if (process.platform === 'android' || process.platform === 'ios') {
  console.log('Running unit tests');
  Mobile('executeNativeTests').callNative(function (result) {
    utResult = true;
    if (result && result.executed) {
      console.log('Total number of executed tests: ', result.total);
      console.log('Number of passed tests: ', result.passed);
      console.log('Number of failed tests: ', result.failed);
      console.log('Number of ignored tests: ', result.ignored);
      console.log('Total duration: ', result.duration);
      if (result.failed > 0) {
        console.log('Failures: \n', result.failures);
        utResult = false;
      }
    }
  });
} else {
  // We aren't on a device so we can't run those tests anyway
  utResult = true;
}

if (!utResult) {
  console.log('Failed to execute UT.');
  global.nativeUTFailed = true;
}

// TODO finish testing here (the node part will be omitted)
// console.log('****TEST_LOGGER:[PROCESS_ON_EXIT_SUCCESS]****');
// return;

// Issue #914
global.NETWORK_TYPE = ThaliMobile.networkTypes.WIFI;

ThaliMobile.getNetworkStatus()
.then(function (networkStatus) {
  console.log('Network status after Unit Tests: ', networkStatus);
  var promiseList = [];
  if (networkStatus.wifi === 'off') {
    console.log('Toggling WIFI ON');
    promiseList.push(testUtils.toggleWifi(true));
  }
  if (networkStatus.bluetooth === 'off') {
    console.log('Toggling BLUETOOTH ON');
    promiseList.push(testUtils.toggleBluetooth(true));
  }
  Promise.all(promiseList)
  .then(function() {
    // To be sure that radios are enabled;
    return ThaliMobile.getNetworkStatus()
  })
  .then(function (networkStatus) {
    console.log('Network status before Coordination Tests: ', networkStatus);
    Mobile('GetDeviceName').callNative(function (name) {
      console.log('My device name is: %s', name);
      testUtils.setName(name);

      console.log('Running for ' + global.NETWORK_TYPE + ' network type');
      setImmediate(function () {
        var testRunner = require('./runTests.js');
        return testRunner.run();
      });
    });
  });
});

console.log('Unit Test app is loaded');
