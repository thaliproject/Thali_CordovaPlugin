/**
 * Class used for connecting & communicating with the coordinator server
 */
'use strict';

var events = require('events');
var socketIo = require('socket.io-client');

function CoordinatorConnector() {
}

CoordinatorConnector.prototype = new events.EventEmitter;

CoordinatorConnector.prototype.init = function (ipAddress, port){
    var self = this;
    this.socket = socketIo('http://' + ipAddress + ':' + port + '/');
    this.socket.on('connect', function () {
        self.emit('connect');
    });

    this.socket.on('connect_error', function (err) {
        self.emit('error',JSON.stringify({type: 'connect_error', data: err}));
    });

    this.socket.on('connect_timeout', function (err) {
        self.emit('error',JSON.stringify({type: 'connect_timeout', data: err}));
    });

    this.socket.on('error', function (err) {
        self.emit('error',JSON.stringify({type: 'error', data: err}));
    });

    this.socket.on('disconnect', function () {
        self.emit('disconnect');
    });

    this.socket.on('command', function (data) {
        self.emit('command',data);
    });

    this.socket.on('start_unit_test', function (data) {
        self.emit('setup_ready',data);
    });

    this.socket.on('end_unit_test', function (data) {
        self.emit('tear_down_ready',data);
    });
};

CoordinatorConnector.prototype.close = function(){
    this.socket.close();
}

CoordinatorConnector.prototype.identify = function(name){
    if(jxcore.utils.OSInfo().isAndroid) {
        this.socket.emit('start_performance_testing', JSON.stringify({"name": name, "os": "android"}));
    }else{
        this.socket.emit('start_performance_testing', JSON.stringify({"name": name, "os": "ios"}));
    }
};

CoordinatorConnector.prototype.sendData = function(data){
    this.socket.emit('test data', data);
};

CoordinatorConnector.prototype.initUnitTest = function(deviceName){
    //todo we also need to supply actual platform with the message
    if(jxcore.utils.OSInfo().isAndroid) {
        this.socket.emit('start_unit_testing', JSON.stringify({"name": deviceName, "os": "android"}));
    }else{
        this.socket.emit('start_unit_testing', JSON.stringify({"name": deviceName, "os": "ios"}));
    }
};

CoordinatorConnector.prototype.setUp = function(deviceName,testName){
    this.socket.emit('setup_unit_test', JSON.stringify({"name":deviceName,"test":testName}));
};

CoordinatorConnector.prototype.tearDown = function(deviceName,testName){
    this.socket.emit('unit_test_done', JSON.stringify({"name":deviceName,"test":testName}));
};

module.exports = CoordinatorConnector;