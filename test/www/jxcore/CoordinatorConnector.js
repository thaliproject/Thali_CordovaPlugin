/**
 * Created by juksilve on 1.9.2015.
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
}

CoordinatorConnector.prototype.identify = function(name){
    this.socket.emit('identify device', name);
}

CoordinatorConnector.prototype.sendData = function(data){
    this.socket.emit('test data', data);
}

module.exports = CoordinatorConnector;