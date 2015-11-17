/**
 * Class used for connecting & communicating with the coordinator server
 */
'use strict';

var util = require('util');
var socketIo = require('socket.io-client');
var EventEmitter = require('events').EventEmitter;

function CoordinatorConnector() {
  EventEmitter.call(this);
}

util.inherits(CoordinatorConnector, EventEmitter);

var debug_log(msg) {
  console.log("CoordinatorConnector-debug: " + msg);
}

CoordinatorConnector.prototype.init = function (ipAddress, port){

  var self = this;
  var options = {
    transports: ['websocket']
  };

  // Connect to the server, this.socket is a singleton managed by socketIo instance
  this.socket = socketIo('http://' + ipAddress + ':' + port + '/',options);
  this.socket.on('connect', function () {
    debug_log("connected");
    self.emit('connect');
  });

  // Mapping of errors to event to emit when they occur
  this.errors = {
    "error" : "error",
    "connect_error" : "error",
    "connect_timeout" : "error",
    "test_error" : "test_error"
  };

  for (var e in this.errors) {
    this.socket.on(e, function(err) {
      debug_log(e);
      self.emit(self.errors[e], JSON.stringify({type:e, data:err}));
    });
  }

  // Mapping of server messages to events to emit when the occur
  this.messages = {
    "disconnect" : "disconnect",
    "command" : "command",
    "start_unit_test" : "setup_ready",
    "end_unit_test" : "tear_down_ready",
    "too_late" : "too_late",
    "start_tests" : "start_tests"
  };

  for (var m in this.messages) {
    this.socket.on(m, function(data) {
      debug_log(m + " Data:" + data);
      self.emit(self.error[m], data);
    });
  }
};

CoordinatorConnector.prototype.close = function(){
  debug_log('close');
  this.socket.close();
  this.emit('closed');
};

CoordinatorConnector.prototype.present = function(name,type,bluetoothAddress){
  if (jxcore.utils.OSInfo().isAndroid) {
    this.socket.emit('present', JSON.stringify({
      "os": "android", 
      "name": name,
      "type": type,
      "btaddress": bluetoothAddress
    }));
  } else {
    this.socket.emit('present', JSON.stringify({
      "os" : "ios",
      "name": name,
      "type": type
    }));
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
