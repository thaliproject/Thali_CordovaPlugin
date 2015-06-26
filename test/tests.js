require('./mockmobile');
var assert = require('assert');
var ThaliEmitter = require('../www/thaliemitter');

describe('ThaliEmitter', function() {
  describe('#startBroadcasting', function() {
    it('should register the peerAvailabilityChanged event', function() {
      var emitter = new ThaliEmitter();
      emitter.on('peerAvailabilityChanged', function (data) {
        assert.equal(data[0].peerIdentifier, 12345);
        assert.equal(data[0].peerName, 'foo');
        assert.equal(data[0].peerAvailable, true);
      });

      Mobile.invokeNative('peerAvailabilityChanged', JSON.stringify([{
        peerIdentifier: 12345,
        peerName: 'foo',
        peerAvailable: true
      }]));

      assert.equal(true, true);
    });
  });
});
