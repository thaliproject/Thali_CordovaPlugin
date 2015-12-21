/**
 * a class that is used to store each test device so we can send data back to them
 */

'use strict';

function TestDevice(deviceSocket, name, uuid, platform, testType, tests, bluetoothAddress) {
  this.socket = deviceSocket;
  this.deviceName = name;
  this.uuid = uuid;
  this.platform = platform;
  this.type = testType;
  this.btAddress = bluetoothAddress;
  this.tests = tests;
}

TestDevice.prototype.SendCommand = function(command,test,data,dev,btAddresList){
  var self = this;
  var filteredList = [];

  if(btAddresList && this.btAddress) {
    btAddresList.forEach(function(item) {
    if(item.address != self.btAddress) {
      filteredList.push(item);
    }});
  }

  this.socket.emit('command', JSON.stringify({command: command, testName: test, testData:data,devices:dev,addressList:filteredList}));
};

module.exports = TestDevice;
