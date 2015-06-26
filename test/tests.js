require('./mockmobile');
var assert = require('assert');
var ThaliEmitter = require('../www/thaliemitter');

describe('ThaliEmitter', function () {
  describe('#init', function () {
    it('should register the peerAvailabilityChanged event', function () {
      var emitter = new ThaliEmitter();
      emitter.on(ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, function (data) {
        assert.equal(data[0].peerIdentifier, 12345);
        assert.equal(data[0].peerName, 'foo');
        assert.equal(data[0].peerAvailable, true);
      });

      Mobile.invokeNative(ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, JSON.stringify([{
        peerIdentifier: 12345,
        peerName: 'foo',
        peerAvailable: true
      }]));
    });

    it('should register the networkChanged event', function () {
      var emitter = new ThaliEmitter();

      emitter.on(ThaliEmitter.events.NETWORK_CHANGED, function (status) {
        assert.equal(status.isAvailable, true);
      });

      Mobile.invokeNative(ThaliEmitter.events.NETWORK_CHANGED, JSON.stringify({
        isAvailable: true
      }));
    });
  });

  describe('#startBroadcasting', function () {
    it('should call Mobile("StartBroadcasting") without an error', function () {
      var emitter = new ThaliEmitter();

      var deviceName = 'foo',
          port = 9001;

      emitter.startBroadcasting(deviceName, port, function (err) {
        assert.equal(Mobile('StartBroadcasting').callNativeArguments[0], deviceName);
        assert.equal(Mobile('StartBroadcasting').callNativeArguments[1], port);
        assert.equal(err, undefined);
      });

      Mobile.invokeStartBroadcasting();
    });

    it('should call Mobile("StartBroadcasting") and handle an error', function () {
      var emitter = new ThaliEmitter();

      var deviceName = 'foo',
          port = 9001,
          errorMessage = 'fail';

      emitter.startBroadcasting(deviceName, port, function (err) {
        assert.equal(Mobile('StartBroadcasting').callNativeArguments[0], deviceName);
        assert.equal(Mobile('StartBroadcasting').callNativeArguments[1], port);
        assert.equal(err.message, errorMessage);
      });

      Mobile.invokeStartBroadcasting(errorMessage);
    });
  });

  describe('#stopBroadcasting', function () {
    it('should call Mobile("StopBroadcasting") without an error', function () {
      var emitter = new ThaliEmitter();

      emitter.stopBroadcasting(function (err) {
        assert.equal(Mobile('StopBroadcasting').callNativeArguments.length, 1);
        assert.equal(err, undefined);
      });

      Mobile.invokeStopBroadcasting();
    });

    it('should call Mobile("StopBroadcasting") and handle an error', function () {
      var emitter = new ThaliEmitter();

      var errorMessage = 'fail';

      emitter.stopBroadcasting(function (err) {
        assert.equal(Mobile('StopBroadcasting').callNativeArguments.length, 1);
        assert.equal(err.message, errorMessage);
      });

      Mobile.invokeStopBroadcasting(errorMessage);
    });
  });

  describe('#connect', function () {
    it('should call Mobile("Connect") with a port and without an error', function () {
      var emitter = new ThaliEmitter();

      var peerIdentifier = 123,
          errorMessage = null,
          port = 9001;

      emitter.connect(peerIdentifier, function (err) {
        assert.equal(Mobile('Connect').callNativeArguments[0], peerIdentifier);
        assert.equal(err, null);
      });

      Mobile.invokeConnect(errorMessage, port);
    });

    it('should call Mobile("Connect") and handle an error', function () {
      var emitter = new ThaliEmitter();

      var peerIdentifier = 123,
          errorMessage = 'fail',
          port = 9001;

      emitter.connect(peerIdentifier, function (err) {
        assert.equal(Mobile('Connect').callNativeArguments[0], peerIdentifier);
        assert.equal(err.message, errorMessage);
      });

      Mobile.invokeConnect(errorMessage, port);
    });
  });

  describe('#disconnect', function () {
    it('should call Mobile("Disconnect") without an error', function () {
      var emitter = new ThaliEmitter();

      var peerIdentifier = 123;

      emitter.disconnect(peerIdentifier, function (err) {
        assert.equal(Mobile('Disconnect').callNativeArguments[0], peerIdentifier);
        assert.equal(err, undefined);
      });

      Mobile.invokeDisconnect();
    });

    it('should call Mobile("Disconnect") and handle an error', function () {
      var emitter = new ThaliEmitter();

      var peerIdentifier = 123,
          errorMessage = 'fail';

      emitter.disconnect(peerIdentifier, function (err) {
        assert.equal(Mobile('Disconnect').callNativeArguments[0], peerIdentifier);
        assert.equal(err.message, errorMessage);
      });

      Mobile.invokeDisconnect(errorMessage);
    });
  });
});
