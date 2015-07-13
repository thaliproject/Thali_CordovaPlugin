// Disable for on Android and iOS
if (process.platform !== 'android' && process.platform !== 'ios') {
  require('./mockmobile');
}
var ThaliEmitter = require('../../thali/thaliemitter');

function noop () { }

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

    it('should call Mobile("StartBroadcasting") twice and throw an error', function () {
      var emitter = new ThaliEmitter();

      var deviceName = 'foo',
          port = 9001;

      emitter.startBroadcasting(deviceName, port, function (err) {

        expect(function () {
          emitter.startBroadcasting(deviceName, port, noop);
          Mobile.invokeStartBroadcasting();
        }).toThrow();
      });

      Mobile.invokeStartBroadcasting();
    });
  });

  describe('#stopBroadcasting', function () {

    it('should call Mobile("StopBroadcasting") and throw an error without Mobile("StartBroadcasting")', function () {
      var emitter = new ThaliEmitter();

      expect(function () {
        emitter.stopBroadcasting(noop);
        Mobile.invokeStopBroadcasting();
      }).toThrow();
    });

    it('should call Mobile("StopBroadcasting") without an error', function () {
      var emitter = new ThaliEmitter();

      var deviceName = 'foo',
          port = 9001;

      emitter.startBroadcasting(deviceName, port, function (err) {

        emitter.stopBroadcasting(function (err) {
          expect(Mobile('StopBroadcasting').callNativeArguments.length).toEqual(1);
          expect(err).toBeFalsy();
        });

        Mobile.invokeStopBroadcasting();
      });

      Mobile.invokeStartBroadcasting();
    });

    it('should call Mobile("StopBroadcasting") and handle an error', function () {
      var emitter = new ThaliEmitter();

      var deviceName = 'foo',
          port = 9001,
          errorMessage = 'fail';

      emitter.startBroadcasting(deviceName, port, function (err) {

        emitter.stopBroadcasting(function (err) {
          expect(Mobile('StopBroadcasting').callNativeArguments.length).toEqual(1);
          expect(err.message).toEqual(errorMessage);
        });

        Mobile.invokeStopBroadcasting(errorMessage);
      });

      Mobile.invokeStartBroadcasting();
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

    it('should call Mobile("Connect") twice with same peer identifier and throw an error', function () {
      var emitter = new ThaliEmitter();

      var peerIdentifier = 123,
          errorMessage = null,
          port = 9001;

      emitter.connect(peerIdentifier, function (err) {

        expect(function () {
          emitter.connect(peerIdentifier, noop);
          Mobile.invokeConnect(errorMessage, port);
        }).toThrow();

      });

      Mobile.invokeConnect(errorMessage, port);
    });

    it('should call Mobile("Connect") twice with different peer identifier and not throw an error', function () {
      var emitter = new ThaliEmitter();

      var peerIdentifier1 = 123,
          peerIdentifier2 = 456,
          errorMessage = null,
          port = 9001;

      emitter.connect(peerIdentifier1, function (err) {

        expect(function () {
          emitter.connect(peerIdentifier2, noop);
          Mobile.invokeConnect(errorMessage, port);
        }).not.toThrow();

      });

      Mobile.invokeConnect(errorMessage, port);
    });

  });

  describe('#disconnect', function () {

    it('should call throw an error if Mobile("Disconnect") called before Mobile("Connects")', function () {
      var emitter = new ThaliEmitter();

      var peerIdentifier = 123;

      expect(function () {
        emitter.disconnect(peerIdentifier, noop);
        Mobile.invokeDisconnect();
      }).toThrow();

    });

    it('should call Mobile("Disconnect") without an error', function () {
      var emitter = new ThaliEmitter();

      var peerIdentifier = 123,
          port = 9001;

      emitter.connect(peerIdentifier, function () {

        emitter.disconnect(peerIdentifier, function (err) {
          expect(Mobile('Disconnect').callNativeArguments[0]).toEqual(peerIdentifier);
          expect(err).toBeFalsy();
        });

        Mobile.invokeDisconnect();
      });

      Mobile.invokeConnect(null, port);
    });

    it('should call Mobile("Disconnect") and handle an error', function () {
      var emitter = new ThaliEmitter();

      var peerIdentifier = 123,
          port = 9001,
          errorMessage = 'fail';

      emitter.connect(peerIdentifier, function () {

        emitter.disconnect(peerIdentifier, function (err) {
          expect(Mobile('Disconnect').callNativeArguments[0]).toEqual(peerIdentifier);
          expect(err.message).toEqual(errorMessage);
        });

        Mobile.invokeDisconnect(errorMessage);
      });

      Mobile.invokeConnect(null, port);
    });
  });
});
