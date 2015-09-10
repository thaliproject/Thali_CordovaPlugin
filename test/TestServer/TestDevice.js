/**
 * Created by juksilve on 1.9.2015.
 */

'use strict';

function TestDevice(deviceSocket,name) {
    this.name = "";
    this.socket = deviceSocket;
    this.name = name;
}

TestDevice.prototype.SendCommand = function(command,test,data){
    this.socket.emit('command', JSON.stringify({command: command, testName: test, testData:data}));
}

TestDevice.prototype.getName = function(){
    return this.name;
}

module.exports = TestDevice;