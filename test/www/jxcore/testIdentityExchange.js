/* jshint undef: true, unused: true */

'use strict';

var originalMobile = global.Mobile;

var tape = require('wrapping-tape');
var mockMobile = require('./mockmobile');
var inherits = require('util').inherits;
var EventEmitter = require('events').EventEmitter;
var express = require('express');

var ThaliEmitter = require('thali/thaliemitter');
var identityExchange = require('thali/identityexchange');

inherits(MockThaliReplicationManager, EventEmitter);

// Mock replication manager
function MockThaliReplicationManager() {
  this._emitter = new ThaliEmitter();
  EventEmitter.call(this);
}

MockThaliReplicationManager.prototype.start = function (port, dbName, deviceName, error) {
  this._port = port;
  this._dbName = dbName;
  this._deviceName = deviceName;

  this.emit('starting');
  setImmediate(function () {
    if (error) {
      this.emit('startError', error);
    } else {
      this.emit('started');
    }
  }.bind(this));
};

MockThaliReplicationManager.prototype.stop = function (error) {
  this.emit('stopping');
  setImmediate(function () {
    if (error) {
      this.emit('stopError', error);
    } else {
      this.emit('stopped');
    }
  }.bind(this));
};

var replicationManager, app;

// test setup & teardown activities
var test = tape({
  setup: function(t) {
    global.Mobile = mockMobile;
    replicationManager = new MockThaliReplicationManager();
    app = express();
    t.end();
  },
  teardown: function(t) {
    global.Mobile = originalMobile;
    t.end();
  }
});

test('Calling startIdentityExchange twice creates and error', function (t) {
  
});
