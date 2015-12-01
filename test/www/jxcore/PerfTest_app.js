/*
 * This file needs to be renamed as app.js when we want to run performance tests
 * in order this to get loaded by the jxcore ready event.
 * This effectively acts as main entry point to the performance test app
*/

"use strict";

var testUtils = require("./lib/testUtils");
var fs = require('fs');

testUtils.toggleRadios(true);

var TestFrameworkClient = require('./perf_tests/PerfTestFrameworkClient');

/*----------------------------------------------------------------------------------
 code for connecting to the coordinator server
 -----------------------------------------------------------------------------------*/

var bluetoothAddress = "";

var deviceName = null;

if (typeof jxcore == 'undefined') {
  deviceName = "PERF_TEST-" + Math.random();
}
else if (jxcore.utils.OSInfo().isAndroid) {

  Mobile('GetBluetoothAddress').callNative(function (err, address) {

    if (err) {
      console.log("GetBluetoothAddress returned error: " + err + ", address : " + address);
      return;
    }

    bluetoothAddress = address;
    console.log("Got Device Bluetooth address: " + bluetoothAddress);
    Mobile('GetDeviceName').callNative(function (name) {

      deviceName = name + "_PT" + Math.round((Math.random() * (10000)));

      console.log('my name is : ' + deviceName);
      testUtils.setMyName(deviceName);

      console.log('attempting to connect to test coordinator');

      // once we have had the BT off and we just turned it on,
      // we need to wait untill the BLE support is reported rigth way
      // seen with LG G4, Not seen with Motorola Nexus 6
      setTimeout(function () {
        Mobile('IsBLESupported').callNative(function (err) {
          if (err) {
            console.log("BLE advertisement not supported: " + err );
            return;
          }
          console.log("BLE supported!!");
        });
      }, 5000);
    });
  });

} else {

  bluetoothAddress = "C0:FF:FF:EE:42:00";
  Mobile('GetDeviceName').callNative(function (name) {
    deviceName = name + "_PT" + Math.round((Math.random() * (10000)));
    testUtils.setMyName(deviceName);
  });
}

/*----------------------------------------------------------------------------------
 code for handling test communications
 -----------------------------------------------------------------------------------*/

var testFramework = new TestFrameworkClient(deviceName, bluetoothAddress);

testFramework.on('done', function (data) {
  console.log('done, now sending data to server');
  Coordinator.sendData(data);
});

testFramework.on('end', function (data) {
  console.log('end, event received');
  Coordinator.close();
});

testFramework.on('debug', function (data) {
  testUtils.logMessageToScreen(data);
});

testFramework.on('start_tests', function (data) {
  console.log('got start_tests event with data : ' + data);
});


// Log that the app.js file was loaded.
console.log('Test app app.js loaded');
