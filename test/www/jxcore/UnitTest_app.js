/*
 * This file needs to be renamed as app.js when we want to run unit tests
 * in order this to get loaded by the jxcore ready event.
 * This effectively acts as main entry point to the unit test app
 */

'use strict';

if (typeof Mobile === 'undefined') {
  global.Mobile = require('./lib/wifiBasedNativeMock.js')();
}

var testRunner = require('./runTests.js');
var testUtils = require('./lib/testUtils');
var ThaliMobile = require('thali/NextGeneration/thaliMobile');
var Promise = require('lie');
var utResult = false;

if (process.platform === 'android' || process.platform === 'ios') {
  console.log('Running unit tests');
  Mobile('ExecuteNativeTests').callNative(function (result) {
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
//console.log('****TEST_LOGGER:[PROCESS_ON_EXIT_SUCCESS]****');
//return;

// Issue #914
var networkTypes = [];
if (process.platform === 'android' || process.platform === 'ios') {
  global.Mobile = require('./lib/wifiBasedNativeMock.js')();
  networkTypes = [
    ThaliMobile.networkTypes.WIFI,
    ThaliMobile.networkTypes.NATIVE,
    ThaliMobile.networkTypes.BOTH
  ];
}

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
      console.log('My device name is: %s', name);
      testUtils.setName(name);

      networkTypes.reduce(function (sequence, networkType) {
        return sequence
          .then(function () {
            console.log('Running for ' + networkType + ' network type');
            global.NETWORK_TYPE = networkType;
            return testRunner.run();
          });
      }, Promise.resolve());
    });
  });
});

console.log('Unit Test app is loaded');
