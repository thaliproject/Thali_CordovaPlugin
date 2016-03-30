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
    return testUtils.hasRequiredHardware();
  })
  .then(function (hasRequiredHardware) {
    if (hasRequiredHardware) {
      Mobile('GetDeviceName').callNative(function (name) {
        console.log('My device name is: %s', name);
        testUtils.setName(name);
        // The setImmediate is to avoid this issue:
        // https://github.com/thaliproject/Thali_CordovaPlugin/issues/563
        setImmediate(function () {
          require('./runTests.js');
        });
      });
    } else {
      ThaliMobile.getNetworkStatus()
      .then(function (networkStatus) {
        testUtils.logMessageToScreen(
          'Device did not have required hardware capabilities!'
        );
        console.log(networkStatus);
        if (networkStatus.bluetoothLowEnergy === 'on') {
          // If we are on a device that doesn't have required capabilities
          // the network status for BLE must not be reported to be "on"
          // which would mean "The radio is on and available for use."
          console.log('****TEST_LOGGER:[PROCESS_ON_EXIT_FAILED]****');
        } else {
          console.log('****TEST_LOGGER:[PROCESS_ON_EXIT_SUCCESS]****');
        }
      });
    }
  });
});

console.log('Unit Test app is loaded');
