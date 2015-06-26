require('./mockmobile');
var assert = require('assert');
var ThaliEmitter = require('../www/thaliemitter');

describe('ThaliEmitter', function () {
  describe('#startBroadcasting', function () {
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
    })
  });
});
