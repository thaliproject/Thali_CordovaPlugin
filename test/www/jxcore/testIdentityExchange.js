/* jshint undef: true, unused: true */

'use strict';

var originalMobile = global.Mobile;

var tape = require('wrapping-tape');
var mockMobile = require('./mockmobile');
var inherits = require('util').inherits;
var EventEmitter = require('events').EventEmitter;
var express = require('express');
var randomString = require('randomstring');

var ThaliEmitter = require('thali/thaliemitter');
var identityExchange = require('thali/identityexchange');

inherits(MockThaliReplicationManager, EventEmitter);

// Mock replication manager
function MockThaliReplicationManager(startError, stopError) {
  this._emitter = new ThaliEmitter();
  this._startError = startError;
  this._stopError = stopError;
  EventEmitter.call(this);
}

MockThaliReplicationManager.prototype.start = function (port, dbName, deviceName) {
  this._port = port;
  this._dbName = dbName;
  this._deviceName = deviceName;

  this.emit('starting');
  setImmediate(function () {
    if (this._startError) {
      this.emit('startError', this._startError);
    } else {
      this.emit('started');
    }
  }.bind(this));
};

MockThaliReplicationManager.prototype.stop = function () {
  this.emit('stopping');
  setImmediate(function () {
    if (this._stopError) {
      this.emit('stopError', this._stopError);
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
