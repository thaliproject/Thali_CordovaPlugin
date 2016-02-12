'use strict';

var ThaliMobile = require('thali/NextGeneration/thaliMobile');
var ThaliMobileNativeWrapper = require('thali/NextGeneration/thaliMobileNativeWrapper');
var tape = require('../lib/thali-tape');
var testUtils = require('../lib/testUtils.js');
var express = require('express');
var validations = require('thali/validations');

var verifyCombinedResultSuccess = function (t, combinedResult, message) {
  t.equal(combinedResult.wifiResult, null, message || 'error should be null');
  // TODO: Add nativeResult check once it is returned
};

var test = tape({
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    ThaliMobile.stop()
    .then(function (combinedResult) {
      verifyCombinedResultSuccess(t, combinedResult);
      t.end();
    });
  }
});

var testIdempotentFunction = function (t, functionName) {
  ThaliMobile.start(express.Router())
  .then(function () {
    return ThaliMobile[functionName]();
  })
  .then(function (combinedResult) {
    verifyCombinedResultSuccess(t, combinedResult);
    return ThaliMobile[functionName]();
  })
  .then(function (combinedResult) {
    verifyCombinedResultSuccess(t, combinedResult);
    t.end();
  });
};

var testFunctionBeforeStart = function (t, functionName) {
  ThaliMobile[functionName]()
  .then(function () {
    t.fail('call should not succeed');
    t.end();
  })
  .catch(function (error) {
    t.equal(error.message, 'Call Start!', 'specific error should be returned');
    t.end();
  });
};

test('#startListeningForAdvertisements should fail if start not called', function (t) {
  testFunctionBeforeStart(t, 'startListeningForAdvertisements');
});

test('#startUpdateAdvertisingAndListening should fail if start not called', function (t) {
  testFunctionBeforeStart(t, 'startUpdateAdvertisingAndListening');
});

test('should be able to call #stopListeningForAdvertisements many times', function (t) {
  testIdempotentFunction(t, 'stopListeningForAdvertisements');
});

test('should be able to call #startListeningForAdvertisements many times', function (t) {
  testIdempotentFunction(t, 'startListeningForAdvertisements');
});

test('should be able to call #startUpdateAdvertisingAndListening many times', function (t) {
  testIdempotentFunction(t, 'startUpdateAdvertisingAndListening');
});

test('#start should fail if called twice in a row', function (t) {
  ThaliMobile.start(express.Router())
  .then(function (combinedResult) {
    verifyCombinedResultSuccess(t, combinedResult, 'first call should succeed');
    return ThaliMobile.start(express.Router());
  })
  .catch(function (error) {
    t.equal(error.message, 'Call Stop!', 'specific error should be returned');
    t.end();
  });
});

// From here onwards, tests work only with the mocked
// up Mobile, because with real devices in CI, the Wifi
// network is configured in a way that it doesn't allow
// routing between peers.
if (!(typeof Mobile !== 'undefined' && Mobile.iAmAMock)) {
  return;
}

var setupDiscoveryAndFindPeer = function (t, callback) {
  ThaliMobile.emitter.once('peerAvailabilityChanged', function (peers) {
    // Just pick the first peer from the list. In reality, it is possible that
    // if this test is run in environment with multiple Thali apps running, the
    // peer we get here isn't exactly the one with whom we are running these
    // tests with. However, even with any peer, this test vefifies that we do
    // get correctly formatted advertisements.
    var peer = peers[0];
    callback(peer, function () {
      ThaliMobile.stopListeningForAdvertisements()
      .then(function (combinedResult) {
        verifyCombinedResultSuccess(t, combinedResult);
        // On purpose not stopping advertising within the test
        // because another device might still be running the test
        // and waiting for advertisements. The stop happens in the
        // test teardown phase.
        t.end();
      });
    });
  });
  ThaliMobile.start(express.Router())
  .then(function (combinedResult) {
    verifyCombinedResultSuccess(t, combinedResult);
    return ThaliMobile.startUpdateAdvertisingAndListening();
  })
  .then(function (combinedResult) {
    verifyCombinedResultSuccess(t, combinedResult);
    return ThaliMobile.startListeningForAdvertisements();
  })
  .then(function (combinedResult) {
    verifyCombinedResultSuccess(t, combinedResult);
  });
};

test('a peer should be found after #startListeningForAdvertisements is called', function (t) {
  setupDiscoveryAndFindPeer(t, function (peer, done) {
    t.doesNotThrow(function () {
      validations.ensureNonNullOrEmptyString(peer.peerIdentifier);
    }, 'peer should have a non-empty identifier');
    t.doesNotThrow(function () {
      validations.ensureNonNullOrEmptyString(peer.hostAddress);
    }, 'peer should have a non-empty host address');
    t.equals(typeof peer.suggestedTCPTimeout, 'number', 'peer should have suggested timeout');
    t.equals(typeof peer.portNumber, 'number', 'peer should have port number');
    t.ok(peer.connectionType, 'peer should have a connection type');
    var connectionTypeKey;
    for (var key in ThaliMobile.connectionTypes) {
      if (peer.connectionType === ThaliMobile.connectionTypes[key]) {
        connectionTypeKey = key;
      }
    }
    t.equals(peer.connectionType, ThaliMobile.connectionTypes[connectionTypeKey],
             'connection type should match one of the pre-defined types');
    done();
  });
});

/* This is commented out since there are timing issue why this doesn't always pass
test('when network connection is lost a peer should be marked unavailable', function (t) {
  setupDiscoveryAndFindPeer(t, function (peer, done) {
    var availabilityChangedHandler = function (peers) {
      var matchingPeer = null;
      peers.forEach(function (peerCandidate) {
        if (peerCandidate.peerIdentifier === peer.peerIdentifier) {
          matchingPeer = peerCandidate;
        }
      });
      if (!matchingPeer) {
        return;
      }
      t.equals(matchingPeer.hostAddress, null, 'host address should be null');
      t.equals(matchingPeer.portNumber, null, 'port number should be null');
      ThaliMobileNativeWrapper.emitter.emit('networkChangedNonTCP',
        testUtils.getMockWifiNetworkStatus(true)
      );
      setTimeout(function () {
        done();
      }, 500);
    };
    ThaliMobile.emitter.on('peerAvailabilityChanged', availabilityChangedHandler);
    setTimeout(function () {
      ThaliMobileNativeWrapper.emitter.emit('networkChangedNonTCP',
        testUtils.getMockWifiNetworkStatus(false)
      );
    }, 500);
  });
});
*/