'use strict';

var platform = require('thali/NextGeneration/utils/platform');

var tape = require('../lib/thaliTape');
var thaliMobileNativeWrapper = require('../node_modules/thali/NextGeneration/thaliMobileNativeWrapper');

var callbackPeer;

var test = tape({
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    thaliMobileNativeWrapper._registerToNative();
    t.end();
  }
});

test('onPeerLost calls jxcore',
  function () {
    return !platform._isRealAndroid;
  },
  function (t) {
    Mobile('peerAvailabilityChanged').registerToNative(function (peers) {
      if (!Array.isArray(peers)) {
        peers = [peers];
        t.fail('peers callback should be an array!');
      }

      t.equals(peers.length, 1, 'There should be exactly one peer');
      callbackPeer = peers[0];

      t.equal(callbackPeer.peerIdentifier, '11:22:33:22:11:00',
        'check if callback was fired by onPeerLost');
      t.ok(callbackPeer.generation == null, 'check if generation is null');
      t.notOk(callbackPeer.peerAvailable, 'check if peerAvailable is false');

      t.end();
    });

    Mobile('testNativeMethod').callNative('onPeerLost', function (result) {
      t.pass(result.Testing_);
    });
  });

test('onPeerDiscovered calls jxcore',
  function () {
    return !platform._isRealAndroid;
  },
  function (t) {
    Mobile('peerAvailabilityChanged').registerToNative(function (peers) {

      if (!Array.isArray(peers)) {
        peers = [peers];
        t.fail('peers callback should be an array!');
      }

      t.equals(peers.length, 1, 'There should be exactly one peer');
      callbackPeer = peers[0];

      t.equal(callbackPeer.peerIdentifier, '33:44:55:44:33:22',
        'check if callback was fired by onPeerDiscovered');
      t.equal(callbackPeer.generation, 0, 'check if generation is 0');
      t.ok(callbackPeer.peerAvailable, 'check if peerAvailable is true');

      t.end();
    });

    Mobile('testNativeMethod').callNative('onPeerDiscovered', function (result) {
      t.pass(result.Testing_);
    });
  });
