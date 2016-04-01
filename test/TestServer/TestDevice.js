/**
 * a class that is used to store each test device so we can send data to them
 */

'use strict';

function TestDevice(deviceSocket, name, uuid, platform, testType,
                    tests, supportedHardware, bluetoothAddress) {
  this.socket = deviceSocket;
  this.deviceName = name;
  this.uuid = uuid;
  this.platform = platform;
  this.type = testType;
  this.supportedHardware = supportedHardware;
  this.tests = tests;
  this.btAddress = bluetoothAddress;
}

module.exports = TestDevice;
