require('./mockmobile');
var ThaliEmitter = require('../../thali/thaliemitter');

describe('ThaliEmitter', function () {
  describe('#init', function () {
    it('should register the peerAvailabilityChanged event', function () {
      var emitter = new ThaliEmitter();
      emitter.on(ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, function (data) {
        expect(data[0].peerIdentifier).toEqual(12345);
        expect(data[0].peerName).toEqual('foo');
        expect(data[0].peerAvailable).toBeTruthy();
      });

      Mobile.invokeNative(ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, [{
        peerIdentifier: 12345,
        peerName: 'foo',
        peerAvailable: true
      }]);
    });

    it('should register the networkChanged event', function () {
      var emitter = new ThaliEmitter();

      emitter.on(ThaliEmitter.events.NETWORK_CHANGED, function (status) {
        expect(status.isAvailable).toBeTruthy();
      });

      Mobile.invokeNative(ThaliEmitter.events.NETWORK_CHANGED, {
        isAvailable: true
      });
    });
  });

  describe('#startBroadcasting', function () {
    it('should call Mobile("StartBroadcasting") without an error', function () {
      var emitter = new ThaliEmitter();

      var deviceName = 'foo',
          port = 9001;

      emitter.startBroadcasting(deviceName, port, function (err) {
        expect(Mobile('StartBroadcasting').callNativeArguments[0], deviceName);
        expect(Mobile('StartBroadcasting').callNativeArguments[1], port);
        expect(err).toBeFalsy();
      });

      Mobile.invokeStartBroadcasting();
    });

    it('should call Mobile("StartBroadcasting") and handle an error', function () {
      var emitter = new ThaliEmitter();

      var deviceName = 'foo',
          port = 9001,
          errorMessage = 'fail';

      emitter.startBroadcasting(deviceName, port, function (err) {
        expect(Mobile('StartBroadcasting').callNativeArguments[0]).toEqual(deviceName);
        expect(Mobile('StartBroadcasting').callNativeArguments[1]).toEqual(port);
        expect(err.message).toEqual(errorMessage);
      });

      Mobile.invokeStartBroadcasting(errorMessage);
    });
  });

  describe('#stopBroadcasting', function () {
    it('should call Mobile("StopBroadcasting") without an error', function () {
      var emitter = new ThaliEmitter();

      emitter.stopBroadcasting(function (err) {
        expect(Mobile('StopBroadcasting').callNativeArguments.length).toEqual(1);
        expect(err).toBeFalsy();
      });

      Mobile.invokeStopBroadcasting();
    });

    it('should call Mobile("StopBroadcasting") and handle an error', function () {
      var emitter = new ThaliEmitter();

      var errorMessage = 'fail';

      emitter.stopBroadcasting(function (err) {
        expect(Mobile('StopBroadcasting').callNativeArguments.length).toEqual(1);
        expect(err.message).toEqual(errorMessage);
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
        expect(Mobile('Connect').callNativeArguments[0]).toEqual(peerIdentifier);
        expect(err).toBeFalsy();
      });

      Mobile.invokeConnect(errorMessage, port);
    });

    it('should call Mobile("Connect") and handle an error', function () {
      var emitter = new ThaliEmitter();

      var peerIdentifier = 123,
          errorMessage = 'fail',
          port = 9001;

      emitter.connect(peerIdentifier, function (err) {
        expect(Mobile('Connect').callNativeArguments[0]).toEqual(peerIdentifier);
        expect(err.message).toEqual(errorMessage);
      });

      Mobile.invokeConnect(errorMessage, port);
    });
  });

  describe('#disconnect', function () {
    it('should call Mobile("Disconnect") without an error', function () {
      var emitter = new ThaliEmitter();

      var peerIdentifier = 123;

      emitter.disconnect(peerIdentifier, function (err) {
        expect(Mobile('Disconnect').callNativeArguments[0]).toEqual(peerIdentifier);
        expect(err).toBeFalsy();
      });

      Mobile.invokeDisconnect(null);
    });

    it('should call Mobile("Disconnect") and handle an error', function () {
      var emitter = new ThaliEmitter();

      var peerIdentifier = 123,
          errorMessage = 'fail';

      emitter.disconnect(peerIdentifier, function (err) {
        expect(Mobile('Disconnect').callNativeArguments[0]).toEqual(peerIdentifier);
        expect(err.message).toEqual(errorMessage);
      });

      Mobile.invokeDisconnect(errorMessage);
    });
  });
});
