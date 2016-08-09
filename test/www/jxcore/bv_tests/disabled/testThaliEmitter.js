"use strict";

var originalMobile = typeof Mobile === "undefined" ? undefined : Mobile;
var mockMobile = require('./mockmobile');
var ThaliEmitter = require('thali/thaliemitter');
var tape = require('../lib/thaliTape');

function noop () { }

var test = tape({
  setup: function(t) {
    global.Mobile = mockMobile;
    t.end();
  },
  teardown: function(t) {
    global.Mobile = originalMobile;
    t.end();
  }
});

test('#init should register the peerAvailabilityChanged event', function (t) {
  var emitter = new ThaliEmitter();

  emitter.on(ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, function (data) {
    t.equal(data[0].peerIdentifier, '12345');
    t.equal(data[0].peerName, 'foo');
    t.equal(data[0].peerAvailable, true);
    t.end();
  });

  Mobile.invokeNative(ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, [{
    peerIdentifier: '12345',
    peerName: 'foo',
    peerAvailable: true
  }]);
});

test('#init should register the networkChanged event', function (t) {
  var emitter = new ThaliEmitter();

  emitter.on(ThaliEmitter.events.NETWORK_CHANGED, function (status) {
    t.equal(status.isAvailable, true);
    t.end();
  });

  Mobile.invokeNative(ThaliEmitter.events.NETWORK_CHANGED, {
    isAvailable: true
  });
});

test('#startBroadcasting should throw on null device name', function (t) {
  var emitter = new ThaliEmitter();

  var deviceName = null,
      port = 9001;

  t.throws(function () {
    emitter.startBroadcasting(deviceName, port, noop);
  });

  t.end();
});

test('#startBroadcasting should throw on empty string device name', function (t) {
  var emitter = new ThaliEmitter();

  var deviceName = '',
      port = 9001;

  t.throws(function () {
    emitter.startBroadcasting(deviceName, port, noop);
  });

  t.end();
});

test('#startBroadcasting should throw on non-number port', function (t) {
  var emitter = new ThaliEmitter();

  var deviceName = 'foo',
      port = '9001';

  t.throws(function () {
    emitter.startBroadcasting(deviceName, port, noop);
  });

  t.end();
});

test('#startBroadcasting should throw on NaN port', function (t) {
  var emitter = new ThaliEmitter();

  var deviceName = 'foo',
      port = NaN;

  t.throws(function () {
    emitter.startBroadcasting(deviceName, port, noop);
  });

  t.end();
});

test('#startBroadcasting should throw on negative port', function (t) {
  var emitter = new ThaliEmitter();

  var deviceName = 'foo',
      port = -1;

  t.throws(function () {
    emitter.startBroadcasting(deviceName, port, noop);
  });

  t.end();
});

test('#startBroadcasting should throw on too large port', function (t) {
  var emitter = new ThaliEmitter();

  var deviceName = 'foo',
      port = 65537;

  t.throws(function () {
    emitter.startBroadcasting(deviceName, port, noop);
  });

  t.end();
});

test('#startBroadcasting should call Mobile("StartBroadcasting") without an error', function (t) {
  var emitter = new ThaliEmitter();

  var deviceName = 'foo',
      port = 9001;

  emitter.startBroadcasting(deviceName, port, function (err) {
    t.equal(Mobile('StartBroadcasting').callNativeArguments[0], deviceName);
    t.equal(Mobile('StartBroadcasting').callNativeArguments[1], port);
    t.equal(err, undefined);
    t.end();
  });

  Mobile.invokeStartBroadcasting();
});

test('#startBroadcasting should call Mobile("StartBroadcasting") and handle an error', function (t) {
  var emitter = new ThaliEmitter();

  var deviceName = 'foo',
      port = 9001,
      errorMessage = 'fail';

  emitter.startBroadcasting(deviceName, port, function (err) {
    t.equal(Mobile('StartBroadcasting').callNativeArguments[0], deviceName);
    t.equal(Mobile('StartBroadcasting').callNativeArguments[1], port);
    t.equal(err.message, errorMessage);
    t.end();
  });

  Mobile.invokeStartBroadcasting(errorMessage);
});

test('#stopBroadcasting should call Mobile("StopBroadcasting") without an error', function (t) {
  var emitter = new ThaliEmitter();

  var deviceName = 'foo',
      port = 9001;

  emitter.startBroadcasting(deviceName, port, function (err) {

    emitter.stopBroadcasting(function (err) {
      t.equal(Mobile('StopBroadcasting').callNativeArguments.length, 1);
      t.equal(err, undefined);
      t.end();
    });

    Mobile.invokeStopBroadcasting();
  });

  Mobile.invokeStartBroadcasting();
});

test('#stopBroadcasting should call Mobile("StopBroadcasting") and handle an error', function (t) {
  var emitter = new ThaliEmitter();

  var deviceName = 'foo',
      port = 9001,
      errorMessage = 'fail';

  emitter.startBroadcasting(deviceName, port, function (err) {

    emitter.stopBroadcasting(function (err) {
      t.equal(Mobile('StopBroadcasting').callNativeArguments.length, 1);
      t.equal(err.message, errorMessage);
      t.end();
    });

    Mobile.invokeStopBroadcasting(errorMessage);
  });

  Mobile.invokeStartBroadcasting();
});

test('#connect should call Mobile("Connect") with a port and without an error', function (t) {
  var emitter = new ThaliEmitter();

  var peerIdentifier = '123',
      errorMessage = null,
      port = 9001;

  emitter.connect(peerIdentifier, function (err, localPort) {
    t.equal(Mobile('Connect').callNativeArguments[0], peerIdentifier);
    t.equal(port, localPort);
    t.equal(err, null);
    t.end();
  });

  Mobile.invokeConnect(errorMessage, port);
});

test('#connect should call Mobile("Connect") and handle an error', function (t) {
  var emitter = new ThaliEmitter();

  var peerIdentifier = '123',
      errorMessage = 'fail',
      port = 9001;

  emitter.connect(peerIdentifier, function (err) {
    t.equal(Mobile('Connect').callNativeArguments[0], peerIdentifier);
    t.equal(err.message, errorMessage);
    t.end();
  });

  Mobile.invokeConnect(errorMessage, port);
});

test('should call Mobile("Disconnect") without an error', function (t) {
  var emitter = new ThaliEmitter();

  var peerIdentifier = '123',
      port = 9001;

  emitter.connect(peerIdentifier, function () {

    emitter.disconnect(peerIdentifier, function (err) {
      t.equal(Mobile('Disconnect').callNativeArguments[0], peerIdentifier);
      t.equal(err, undefined);
      t.end();
    });

    Mobile.invokeDisconnect && Mobile.invokeDisconnect();
  });

  Mobile.invokeConnect(null, port);
});

test('should call Mobile("Disconnect") and handle an error', function (t) {
  var emitter = new ThaliEmitter();

  var peerIdentifier = '123',
      port = 9001,
      errorMessage = 'fail';

  emitter.connect(peerIdentifier, function () {

    emitter.disconnect(peerIdentifier, function (err) {
      t.equal(Mobile('Disconnect').callNativeArguments[0], peerIdentifier);
      t.equal(err.message, errorMessage);
      t.end();
    });

    Mobile.invokeDisconnect(errorMessage);
  });

  Mobile.invokeConnect(null, port);
});
