/**
 * Class used for connecting & communicating with the coordinator server
 */
'use strict';

var events = require('events');

function CoordinatorConnector() {
}

CoordinatorConnector.prototype = new events.EventEmitter;

CoordinatorConnector.prototype.init = function (ipAddress, port){
    var self = this;
    this.socket = require('socket.io-client')('http://' + ipAddress + ':' + port + '/');
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
}

CoordinatorConnector.prototype.identify = function(name){
    this.socket.emit('start_performance_testing', name);
}

CoordinatorConnector.prototype.sendData = function(data){
    this.socket.emit('test data', data);
}

CoordinatorConnector.prototype.initUnitTest = function(deviceName){
    this.socket.emit('start_unit_testing', JSON.stringify({"name":deviceName}));
}

CoordinatorConnector.prototype.setUp = function(deviceName,testName){
    this.socket.emit('setup_unit_test', JSON.stringify({"name":deviceName,"test":testName}));
}

CoordinatorConnector.prototype.tearDown = function(deviceName,testName){
    this.socket.emit('unit_test_done', JSON.stringify({"name":deviceName,"test":testName}));
}

module.exports = CoordinatorConnector;
