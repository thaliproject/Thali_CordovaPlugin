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
  Mobile('executeNativeTests').callNative(function (result) {
    if (result) {
      if (!result.executed) {
        console.log('*Native tests were not executed*');

        utResult = false;
      } else {
        console.log('*Native tests were executed*');

        utResult = result.failed <= 0;
      }

      console.log('Total number of executed tests: ', result.total);
      console.log('Number of passed tests: ', result.passed);
      console.log('Number of failed tests: ', result.failed);
      console.log('Number of ignored tests: ', result.ignored);
      console.log('Total duration: ', result.duration);
    } else {
      console.log('*Native tests results are empty*');

      utResult = false;
    }
  });

  if (!utResult) {
    console.log("Failed to execute UT.");
    global.nativeUTFailed = true;
  }

  // TODO finish testing here (the node part will be omitted)
  console.log('****TEST_LOGGER:[PROCESS_ON_EXIT_SUCCESS]****');
  return;
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
      // The setImmediate is to avoid this issue:
      // https://github.com/thaliproject/Thali_CordovaPlugin/issues/563
      setImmediate(function () {
        require('./runTests.js');
      });
    });
  });
});

console.log('Unit Test app is loaded');
