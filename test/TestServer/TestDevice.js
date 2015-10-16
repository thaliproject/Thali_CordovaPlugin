/**
 * a class that is used to store each test device so we can sent data back to them
 */

'use strict';

function TestDevice(deviceSocket,name,platform) {
    this.socket = deviceSocket;
    this.deviceName = name;
    this.os = platform;
}
TestDevice.prototype.getName = function(){
    return this.deviceName;
}

TestDevice.prototype.getPlatform = function(){
    return this.os;
}

TestDevice.prototype.SendCommand = function(command,test,data,dev){
    this.socket.emit('command', JSON.stringify({command: command, testName: test, testData:data,devices:dev}));
}

TestDevice.prototype.SendEndUnitTest = function(data){
    this.socket.emit('end_unit_test', JSON.stringify({data:data}));
}

TestDevice.prototype.SendStartUnitTest = function(data){
    this.socket.emit('start_unit_test', JSON.stringify({data:data}));
}

module.exports = TestDevice;