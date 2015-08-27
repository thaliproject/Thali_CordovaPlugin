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

var app;

// test setup & teardown activities
var test = tape({
  setup: function(t) {
    global.Mobile = mockMobile;

    app = express();
    t.end();
  },
  teardown: function(t) {
    global.Mobile = originalMobile;
    global.isInIdentityExchange = false;
    t.end();
  }
});

test('Calling startIdentityExchange twice creates and error', function (t) {
  var myFriendlyName = randomString.generate(32);

  var replicationManager = new MockThaliReplicationManager();
  var exchange = identityExchange(app, replicationManager);

  exchange.startIdentityExchange(myFriendlyName, function () {
    exchange.startIdentityExchange(myFriendlyName, function (err) {
      t.ok(err, 'Start identity exchange twice should cause an error');
      t.end();
    });
  });
});

test('Can emit peerIdentityExchange event', function (t) {
  var hash = randomString.generate(32);
  var friendlyName = randomString.generate(10);

  var replicationManager = new MockThaliReplicationManager();

  replicationManager._emitter.once('peerIdentityExchange', function (peer) {
    t.equal(peer.peerName, hash, 'hash should equal peer name');
    t.equal(peer.peerFriendlyName, friendlyName, 'friendlyName should equal peer friendly name');
    t.end();
  });

  var peers = [
    { peerName: randomString.generate(32) },
    { peerName: hash + ';' + friendlyName }
  ];

  replicationManager._emitter.emit('peerAvailabilityChanged', peers);
});
