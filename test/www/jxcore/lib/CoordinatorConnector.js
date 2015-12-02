/**
 * Class used for connecting & communicating with the coordinator server
 * It's responsibilities are to maintain a connection with the test server
 * and to translate events to/from it.
 */
'use strict';

var util = require('util');
var io = require('socket.io-client');
var EventEmitter = require('events').EventEmitter;

function CoordinatorConnector() 
{
  EventEmitter.call(this);

  // Mapping of errors to events to emit when they occur
  this.errors = {
    "error" : "error",
    "connect_error" : "error",
    "connect_timeout" : "error",
    "test_error" : "test_error"
  };

  // Mapping of server/socket messages to events to emit when the occur
  this.messages = {
    "start" : "start",
    "stop" : "stop",
    "connect" : "connect",
    "disconnect" : "disconnect",
    "command" : "command",
    "start_tests" : "start_tests",
    "setup" : "setup",
    "start_test" : "start_test",
    "teardown" : "teardown",
    "schedule" : "schedule",
    "too_late" : "too_late"
  };
}

util.inherits(CoordinatorConnector, EventEmitter);

function debug_log(msg) {
  console.log("CoordinatorConnector-debug: " + msg);
}

CoordinatorConnector.prototype.connect = function (ipAddress, port) 
{
  // Connect to the server, this.socket is a singleton managed by io instance

  var options = {
    transports: ['websocket']
  };

  var self = this;
  this.socket = io('http://' + ipAddress + ':' + port + '/', options);

  // We're about to do some looping with closures. Some of this
  // code may look odd. Don't panic: http://www.mennovanslooten.nl/blog/post/62

  for (var e in this.errors) {
    this.socket.on(e, function(err) {
      return function(data) {
        debug_log("Socket error: " + err + ":" + data);
        self.emit(self.errors[err], JSON.stringify({type:err, data:data}));
      };
    }(e));
  }

  for (var m in this.messages) {
    this.socket.on(m, function(msg) {
      return function(data) {
        debug_log(msg + ":" + data);
        self.emit(self.messages[msg], data);
      };
    }(m));
  }
};

CoordinatorConnector.prototype.close = function()
{
  // Disconnect from the test server

  if (!this.socket) {
    throw new Error("Not Connected");
  }

  debug_log('close');
  this.socket.close();
  this.emit('closed');
};

CoordinatorConnector.prototype.present = function(name, type, tests, bluetoothAddress) 
{
  // Inform the test server who we are, what type of test we're prepared to run
  // and what our bluetoothAddress is (Android only)

  if (typeof jxcore !== 'undefined' && jxcore.utils.OSInfo().isAndroid) {
    this.socket.emit('present', JSON.stringify({
      "os": "android", 
      "name": name,
      "type": type,
      "tests": tests,
      "btaddress": bluetoothAddress
    }));
  } else {
    this.socket.emit('present', JSON.stringify({
      "os" : "ios",
      "name": name,
      "type": type,
      "tests": tests
    }));
  }
};

CoordinatorConnector.prototype.sendData = function(data) 
{
  // Send test data to the server (debug only)

  debug_log("sendData");
  this.socket.emit('test data', data);
};

CoordinatorConnector.prototype.scheduleComplete = function()
{
  // Inform the test server that we have completed set up
  this.socket.emit('schedule_complete');
};

CoordinatorConnector.prototype.setupComplete = function(deviceName, testName)
{
  // Inform the test server that we have completed set up
  this.socket.emit('setup_complete', JSON.stringify({"name":deviceName, "test":testName}));
};

CoordinatorConnector.prototype.testComplete = function(testName, success)
{
  // Inform the test server that we have completed test execution
  this.socket.emit('test_complete', JSON.stringify({"test":testName, "success":success}));
};


CoordinatorConnector.prototype.teardownComplete = function(deviceName, testName)
{
  // Inform the test server that we are tearing down the named test
  this.socket.emit('teardown_complete', JSON.stringify({"name":deviceName, "test":testName}));
};

module.exports = CoordinatorConnector;
