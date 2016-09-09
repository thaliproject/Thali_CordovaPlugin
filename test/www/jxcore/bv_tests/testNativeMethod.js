'use strict';

if (process.platform === 'android' || process.platform === 'ios') {

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

  test('onPeerLost calls jxcore', function (t) {
    var timeOut = setTimeout(function () {
      t.fail('No callback after calling registerToNative');
    }, 5000);

    Mobile('peerAvailabilityChanged').registerToNative(function (peers) {
      clearTimeout(timeOut);

      if (typeof peers.forEach !== 'function') {
        peers = [peers];
      } else {
        t.fail('Peers object is not an array!');
        t.end();
      }

      peers.forEach(function (peer) {
        callbackPeer = peer;
      });

      setImmediate(function () {
        Mobile('TestNativeMethod').callNative('onPeerLost', function (result) {
          console.log(result.Testing_);
          setImmediate(function () {
            t.equal(callbackPeer.peerIdentifier, '11:22:33:22:11:00-0',
              'check if callback was fired by onPeerLost');
            t.notOk(callbackPeer.peerAvailable, 'check if peerAvailable is false');
          });
        });
      });
    });
    t.end();
  });

  test('onPeerDiscovered calls jxcore', function (t) {
    var timeOut = setTimeout(function () {
      t.fail('No callback after calling registerToNative');
    }, 5000);

    Mobile('peerAvailabilityChanged').registerToNative(function (peers) {
      clearTimeout(timeOut);

      if (typeof peers.forEach !== 'function') {
        peers = [peers];
      } else {
        t.fail('Peers object is not an array!');
        t.end();
      }

      peers.forEach(function (peer) {
        callbackPeer = peer;
      });

      setImmediate(function () {
        Mobile('TestNativeMethod').callNative('onPeerDiscovered', function (result) {
          console.log(result.Testing_);
          setImmediate(function () {
            t.equal(callbackPeer.peerIdentifier, '33:44:55:44:33:22-0',
              'check if callback was fired by onPeerDiscovered');
            t.ok(callbackPeer.peerAvailable, 'check if peerAvailable is true');
          });
        });
      });
    });
    t.end();
  });
}
