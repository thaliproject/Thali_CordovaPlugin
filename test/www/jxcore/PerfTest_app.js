/*
 * This file needs to be renamed as app.js when we want to run performance tests
 * in order this to get loaded by the jxcore ready event.
 * This effectively acts as main entry point to the performance test app
*/

'use strict';

var testUtils = require('./lib/testUtils');
var TestFrameworkClient = require('./perf_tests/PerfTestFrameworkClient');

/*------------------------------------------------------------------------------
 code for connecting to the coordinator server
 -----------------------------------------------------------------------------*/

function getDeviceCharacteristics(cb) {

  if (typeof jxcore === 'undefined') {
    cb('PERF_TEST-' + Math.random(), null);
  }
  else if (jxcore.utils.OSInfo().isAndroid) {
    Mobile('GetBluetoothAddress').callNative(
      function (bluetoothAddressError, bluetoothAddress) {
      Mobile('GetBluetoothName').callNative(
        function (bluetoothNameError, bluetoothName) {
        Mobile('GetDeviceName').callNative(
          function (deviceName) {
          console.log('Received device characteristics:\n' +
                      'Bluetooth address: ' + bluetoothAddress + '\n' +
                      'Bluetooth name: ' + bluetoothName + '\n' +
                      'Device name: ' + deviceName);
          // In case of Android, the name used is first checked from the
          // Bluetooth name, because that is one that user can set. If that is
          // not set, the returned device name is used. The device name is not
          // guaranteed to be unique, because it is concatenated from device
          // manufacturer and model and will thus be the same in case of
          // identical devices.
          var myName = bluetoothName || deviceName;
          if (!myName || !bluetoothAddress) {
            console.log('An error while getting the device characteristics!');
          }
          testUtils.setName(myName);
          cb(myName, bluetoothAddress);
        });
      });
    });
  } else {
    Mobile('GetDeviceName').callNative(function (deviceName) {
      // In case of iOS, the device name is used directly, because
      // the one returned in the one that user can set.
      testUtils.setName(deviceName);
      cb(deviceName, null);
    });
  }
}

/*------------------------------------------------------------------------------
 code for handling test communications
 -----------------------------------------------------------------------------*/

var testFramework;
getDeviceCharacteristics(function (deviceName, bluetoothAddress) {
  // The test framework client will coordinate everything from here..
  process.nextTick(function () {
    testFramework = new TestFrameworkClient(deviceName, bluetoothAddress);
  });
});

console.log('Perf Test app is loaded');
