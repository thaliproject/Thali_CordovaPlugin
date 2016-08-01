'use strict';

var tape = require('../lib/thaliTape');
//var PromiseQueue = require('../node_modules/thali/NextGeneration/promiseQueue');

var registerToNative = function (methodName, callback) {
    Mobile(methodName).registerToNative(callback);
};

//var states = {
//  started: false
//};
//var logger = require('../node_modules/thali/thalilogger')('thaliMobileNativeWrapper');
//var gServersManager = null;
//
//module.exports.emitter = new EventEmitter();
//
//var peerAvailabilityChangedQueue = new PromiseQueue();
//var handlePeerAvailabilityChanged = function (peer) {
//  if (!states.started) {
//    logger.debug('Filtered out nonTCPPeerAvailabilityChangedEvent ' +
//                 'due to not being in started state');
//    return;
//  }
//  return peerAvailabilityChangedQueue.enqueue(function (resolve) {
//    var handlePeerUnavailable = function () {
//      // TODO: Should the created peer listener be cleaned up when
//      // peer becomes unavailable and which function should be used
//      // for that?
//      module.exports.emitter.emit('nonTCPPeerAvailabilityChangedEvent', {
//        peerIdentifier: peer.peerIdentifier,
//        portNumber: null
//      });
//      resolve();
//    };
//    if (peer.peerAvailable) {
//      gServersManager.createPeerListener(peer.peerIdentifier,
//                                         peer.pleaseConnect)
//      .then(function (portNumber) {
//        module.exports.emitter.emit('nonTCPPeerAvailabilityChangedEvent', {
//          peerIdentifier: peer.peerIdentifier,
//          portNumber: portNumber
//        });
//        resolve();
//      })
//      .catch(function (error) {
//        logger.warn('Received error from createPeerListener: ' + error);
//        // In case there is an error creating a peer listener,
//        // handle the peer as if we would have received an unavailability
//        // message since the upper layers couldn't connect to the peer
//        // anyways.
//        handlePeerUnavailable();
//      });
//    } else {
//      handlePeerUnavailable();
//    }
//  });
//};

var callbackPeer;
var callbackIsAvailable;

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
           t.equal(callbackPeer.peerAvailable, false)
           t.end();
  });
});

test('onPeerDiscovered calls jxcore', function (t) {
  Mobile('testNativeMethod').callNative("onPeerDiscovered", function (result) {
           console.log(result.Testing_);
           t.notEqual(callbackPeer.peerIdentifier, "33:44:55:44:33");
           t.equal(callbackPeer.peerAvailable, true)
           t.end();
  });
});