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
    this.socket.heartbeatTimeout = 3600000; // close socket if we don't get heartbeat in one  hour

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

    this.socket.on('too_late', function (data) {
        self.emit('too_late',data);
    });

    this.socket.on('start_tests', function (data) {
        self.emit('start_tests',data);
    });

};

CoordinatorConnector.prototype.close = function(){
    this.socket.close();
};

CoordinatorConnector.prototype.present = function(name,type){
    if(jxcore.utils.OSInfo().isAndroid) {
        this.socket.emit('present', JSON.stringify({"os": "android","name": name,"type":type}));
    }else{
        this.socket.emit('present', JSON.stringify({"os": "ios","name": name,"type":type}));
    }
};

CoordinatorConnector.prototype.sendData = function(data){
    this.socket.emit('test data', data);
};

CoordinatorConnector.prototype.setUp = function(deviceName,testName){
    this.socket.emit('setup_unit_test', JSON.stringify({"name":deviceName,"test":testName}));
};

CoordinatorConnector.prototype.tearDown = function(deviceName,testName){
    this.socket.emit('unit_test_done', JSON.stringify({"name":deviceName,"test":testName}));
};

CoordinatorConnector.prototype.toggleRadios = function(on) {
    if (!jxcore.utils.OSInfo().isMobile) {
        return;
    }
    console.log("Turning radios to " + on);
    Mobile.toggleBluetooth(on, function(err) {
        if (err) {
            console.log("We could not set Bluetooth! - " + err);
        }
        console.log("toggleBluetooth - ");
        Mobile.toggleWiFi(on, function(err) {
            if (err) {
                console.log("We could not set WiFi! - " + err);
            }
            console.log("toggleWiFi");
        });
    });
};


module.exports = CoordinatorConnector;
