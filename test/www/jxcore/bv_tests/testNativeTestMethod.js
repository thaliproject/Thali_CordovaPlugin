'use strict';

var tape = require('../lib/thaliTape');

var registerToNative = function (methodName, callback) {
    Mobile(methodName).registerToNative(callback);
};

var callbackPeer;

var test = tape({
  setup: function (t) {
    registerToNative('peerAvailabilityChanged', function (peers) {
       if (typeof peers.forEach !== 'function') {
          peers = [peers];
       }
       peers.forEach(function (peer) {
       console.log("peerID: " + peer.peerIdentifier);
       console.log("peerAvailable: " + peer.peerAvailable);
       callbackPeer = peer;
       });
    });
    t.end();
  },
  teardown: function (t) {
    require('../node_modules/thali/NextGeneration/thaliMobileNativeWrapper');
    t.end();
  }
});

test('onPeerLost calls jxcore', function (t) {
  Mobile('testNativeMethod').callNative("onPeerLost", function (result) {
           console.log(result.Testing_);
           t.equal(callbackPeer.peerIdentifier, "11:22:33:22:11");
           t.notOk(callbackPeer.peerAvailable, "onPeerLost: peerAvailable is false")
           t.end();
  });
});

test('onPeerDiscovered calls jxcore', function (t) {
  Mobile('testNativeMethod').callNative("onPeerDiscovered", function (result) {
           console.log(result.Testing_);
           t.notEqual(callbackPeer.peerIdentifier, "33:44:55:44:33");
           t.ok(callbackPeer.peerAvailable, "onPeerDiscovered: peerAvailable is true")
           t.end();
  });
});
