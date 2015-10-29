/**
 * Class used for connecting & communicating with the coordinator server
 */
'use strict';

var events = require('events');
var socketIo = require('socket.io-client');

function CoordinatorConnector() {
    this.wasClosed = false;

}

CoordinatorConnector.prototype = new events.EventEmitter;

CoordinatorConnector.prototype.init = function (ipAddress, port){
    var self = this;

    this.wasClosed = false;
    this.connectAddress = ipAddress;
    this.connectPort = port;

    var options = {
        pingTimeout: 3599000,
        pingInterval: 60000,
        transports: ['websocket']
    };

    this.socket = socketIo('http://' + ipAddress + ':' + port + '/',options);
    this.socket.on('connect', function () {
        console.log('DBG, CoordinatorConnector connect called');
        self.emit('connect');
    });

    this.socket.on('connect_error', function (err) {
        console.log('DBG, CoordinatorConnector connect_error called');
        self.emit('error',JSON.stringify({type: 'connect_error', data: err}));
    });

    this.socket.on('connect_timeout', function (err) {
        console.log('DBG, CoordinatorConnector connect_timeout called');
        self.emit('error',JSON.stringify({type: 'connect_timeout', data: err}));
    });

    this.socket.on('error', function (err) {
        console.log('DBG, CoordinatorConnector error called');
        self.emit('error',JSON.stringify({type: 'error', data: err}));
    });

    this.socket.on('test_error', function (err) {
        console.log('DBG, CoordinatorConnector test_error called');
        self.emit('test_error',JSON.stringify({type: 'test_error', data: err}));
    })

    this.socket.on('disconnect', function () {
        console.log('DBG, CoordinatorConnector disconnect called');
      //  if(this.wasClosed) {
            self.emit('disconnect');
      /*      return;
        }
        console.log('DBG, Will try re-init');
        self.close();
        self.init(self.connectAddress,self.connectPort);*/
    });

    this.socket.on('command', function (data) {
        console.log('DBG, CoordinatorConnector command called');
        self.emit('command',data);
    });

    this.socket.on('start_unit_test', function (data) {
        self.emit('setup_ready',data);
    });

    this.socket.on('end_unit_test', function (data) {
        self.emit('tear_down_ready',data);
    });

    this.socket.on('too_late', function (data) {
        console.log('DBG, CoordinatorConnector too_late called');
        self.emit('too_late',data);
    });

    this.socket.on('start_tests', function (data) {
        console.log('DBG, CoordinatorConnector start_tests called');
        self.emit('start_tests',data);
    });

};

CoordinatorConnector.prototype.close = function(){
    console.log('CoordinatorConnector close called');
    this.wasClosed = true;
    this.socket.close();
    this.emit('closed');
};

CoordinatorConnector.prototype.present = function(name,type){
    if(jxcore.utils.OSInfo().isAndroid) {
        this.socket.emit('present', JSON.stringify({"os": "android","name": name,"type":type}));
    }else{
        this.socket.emit('present', JSON.stringify({"os": "ios","name": name,"type":type}));
    }
};

CoordinatorConnector.prototype.sendData = function(data){
    console.log('DBG, CoordinatorConnector sendData called');
    this.socket.emit('test data', data);
};

CoordinatorConnector.prototype.setUp = function(deviceName,testName){
    this.socket.emit('setup_unit_test', JSON.stringify({"name":deviceName,"test":testName}));
};

CoordinatorConnector.prototype.tearDown = function(deviceName,testName){
    this.socket.emit('unit_test_done', JSON.stringify({"name":deviceName,"test":testName}));
};


module.exports = CoordinatorConnector;
