/**
 * a class that is used to store each test device so we can send data back to them
 */

'use strict';

function TestDevice(deviceSocket,name,platform,testType) {
    this.socket = deviceSocket;
    this.deviceName = name;
    this.os = platform;
    this.type = testType;
}
TestDevice.prototype.gettestType = function(){
    return this.type;
};

TestDevice.prototype.getName = function(){
    return this.deviceName;
};

TestDevice.prototype.compareSocket = function(socket){
    return (socket == this.socket);
};

TestDevice.prototype.getPlatform = function(){
    return this.os;
};

TestDevice.prototype.start_tests = function(data){
    this.socket.emit('start_tests', JSON.stringify({data:data}));
};

TestDevice.prototype.SendCommand = function(command,test,data,dev){
    this.socket.emit('command', JSON.stringify({command: command, testName: test, testData:data,devices:dev}));
};

TestDevice.prototype.SendEndUnitTest = function(data){
    this.socket.emit('end_unit_test', JSON.stringify({data:data}));
};

TestDevice.prototype.SendStartUnitTest = function(data){
    this.socket.emit('start_unit_test', JSON.stringify({data:data}));
};

module.exports = TestDevice;
