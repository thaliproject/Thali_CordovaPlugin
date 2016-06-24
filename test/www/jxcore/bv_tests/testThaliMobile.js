'use strict';

var ThaliMobile = require('thali/NextGeneration/thaliMobile');
var ThaliMobileNativeWrapper = require('thali/NextGeneration/thaliMobileNativeWrapper');
var thaliConfig = require('thali/NextGeneration/thaliConfig');
var tape = require('../lib/thaliTape');
var testUtils = require('../lib/testUtils.js');
var express = require('express');
var validations = require('thali/validations');
var sinon = require('sinon');
var uuid = require('node-uuid');
var nodessdp = require('node-ssdp');
var randomstring = require('randomstring');

var verifyCombinedResultSuccess = testUtils.verifyCombinedResultSuccess;

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

var checkPeer = function (t, peer, available) {
  t.doesNotThrow(function () {
    validations.ensureNonNullOrEmptyString(peer.peerIdentifier);
  }, 'peer should have a non-empty identifier');

  if (available) {
    t.doesNotThrow(function () {
      validations.ensureNonNullOrEmptyString(peer.hostAddress);
    }, 'peer should have a non-empty host address');
    t.equals(typeof peer.portNumber, 'number',
      'peer should have port number');
  } else {
    t.equals(peer.hostAddress, null, 'host address should be null');
    t.equals(peer.portNumber, null, 'port number should be null');
  }

  t.equals(typeof peer.suggestedTCPTimeout, 'number',
    'peer should have suggested timeout');
  t.ok(peer.connectionType,
    'peer should have a connection type');
  var connectionTypeKey;
  for (var key in ThaliMobile.connectionTypes) {
    if (peer.connectionType === ThaliMobile.connectionTypes[key]) {
      connectionTypeKey = key;
    }
  }
  t.equals(peer.connectionType, ThaliMobile.connectionTypes[connectionTypeKey],
    'connection type should match one of the pre-defined types');
};

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

test('#startListeningForAdvertisements should fail if start not called',
  function (t) {
    testFunctionBeforeStart(t, 'startListeningForAdvertisements');
  }
);

test('#startUpdateAdvertisingAndListening should fail if start not called',
  function (t) {
    testFunctionBeforeStart(t, 'startUpdateAdvertisingAndListening');
  }
);

test('should be able to call #stopListeningForAdvertisements many times',
  function (t) {
    testIdempotentFunction(t, 'stopListeningForAdvertisements');
  }
);

test('should be able to call #startListeningForAdvertisements many times',
  function (t) {
    testIdempotentFunction(t, 'startListeningForAdvertisements');
  }
);

test('should be able to call #startUpdateAdvertisingAndListening many times',
  function (t) {
    testIdempotentFunction(t, 'startUpdateAdvertisingAndListening');
  }
);

test('should be able to call #stopAdvertisingAndListening many times',
  function (t) {
    testIdempotentFunction(t, 'stopAdvertisingAndListening');
  }
);

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

test('does not emit duplicate discoveryAdvertisingStateUpdate', function (t) {
  var spy = sinon.spy();
  ThaliMobile.start(express.Router())
  .then(function () {
    return ThaliMobile.startListeningForAdvertisements();
  })
  .then(function () {
    return ThaliMobile.startUpdateAdvertisingAndListening();
  })
  .then(function () {
    var stateUpdateHandler = function (discoveryAdvertisingStatus) {
      spy();
      t.equals(spy.callCount, 1, 'called only once');
      t.equals(discoveryAdvertisingStatus.nonTCPDiscoveryActive, true,
        'discovery state matches');
      t.equals(discoveryAdvertisingStatus.nonTCPAdvertisingActive, true,
        'advertising state matches');
      process.nextTick(function () {
        ThaliMobile.emitter.removeListener(
          'discoveryAdvertisingStateUpdate', stateUpdateHandler
        );
        t.end();
      });
    };
    ThaliMobile.emitter.on('discoveryAdvertisingStateUpdate',
      stateUpdateHandler);
    var testStatus = {
      discoveryActive: true,
      advertisingActive: true
    };
    // Emit the same status twice.
    ThaliMobileNativeWrapper.emitter.emit(
      'discoveryAdvertisingStateUpdateNonTCPEvent', testStatus
    );
    ThaliMobileNativeWrapper.emitter.emit(
      'discoveryAdvertisingStateUpdateNonTCPEvent', testStatus
    );
  });
});

test('does not send duplicate availability changes', function (t) {
  var dummyPeer = {
    peerIdentifier: 'dummy',
    hostAddress: 'dummy',
    portNumber: 8080
  };
  var spy = sinon.spy(ThaliMobile.emitter, 'emit');
  ThaliMobileNativeWrapper.emitter.emit('nonTCPPeerAvailabilityChangedEvent',
                                        dummyPeer);
  process.nextTick(function () {
    t.equals(spy.callCount, 1, 'should be called once');
    ThaliMobileNativeWrapper.emitter.emit('nonTCPPeerAvailabilityChangedEvent',
                                          dummyPeer);
    process.nextTick(function () {
      t.equals(spy.callCount, 1, 'should not have been called more than once');
      ThaliMobile.emitter.emit.restore();
      t.end();
    });
  });
});

test('can get the network status', function (t) {
  ThaliMobile.getNetworkStatus()
  .then(function (networkChangedValue) {
    t.doesNotThrow(function () {
      var requiredProperties = [
        'wifi',
        'bluetooth',
        'bluetoothLowEnergy',
        'cellular'
      ];
      for (var index in requiredProperties) {
        validations.ensureNonNullOrEmptyString(
          networkChangedValue[requiredProperties[index]]);
      }
    }, 'network status should have certain non-empty properties');
    t.end();
  });
});

test('wifi peer is marked unavailable if announcements stop', function (t) {
  // Store the original threshold so that it can be restored
  // at the end of the test.
  var originalThreshold = thaliConfig.TCP_PEER_UNAVAILABILITY_THRESHOLD;
  // Make the threshold a bit shorter so that the test doesn't
  // have to wait for so long.
  thaliConfig.TCP_PEER_UNAVAILABILITY_THRESHOLD =
    thaliConfig.SSDP_ADVERTISEMENT_INTERVAL * 2;
  var testPeerIdentifier = 'urn:uuid:' + uuid.v4();
  var testSeverHostAddress = randomstring.generate({
    charset: 'hex', // to get lowercase chars for the host address
    length: 8
  });
  var testServerPort = 8080;
  var testServer = new nodessdp.Server({
    location: 'http://' + testSeverHostAddress + ':' + testServerPort,
    udn: thaliConfig.SSDP_NT,
    // Make the interval 10 times longer than expected
    // to make sure we determine the peer is gone while
    // waiting for the advertisement.
    adInterval: thaliConfig.SSDP_ADVERTISEMENT_INTERVAL * 10
  });
  testServer.setUSN(testPeerIdentifier);

  var spy = sinon.spy();
  var availabilityChangedHandler = function (peer) {
    if (peer.peerIdentifier !== testPeerIdentifier) {
      return;
    }
    spy();
    if (spy.calledOnce) {
      t.equal(peer.hostAddress, testSeverHostAddress,
        'host address should match');
      t.equal(peer.portNumber, testServerPort, 'port should match');
    } else if (spy.calledTwice) {
      t.equal(peer.hostAddress, null, 'host address should be null');
      t.equal(peer.portNumber, null, 'port should should be null');

      ThaliMobile.emitter.removeListener('peerAvailabilityChanged',
        availabilityChangedHandler);
      testServer.stop(function () {
        thaliConfig.TCP_PEER_UNAVAILABILITY_THRESHOLD = originalThreshold;
        t.end();
      });
    }
  };
  ThaliMobile.emitter.on('peerAvailabilityChanged', availabilityChangedHandler);

  ThaliMobile.start()
  .then(function () {
    return ThaliMobile.startListeningForAdvertisements();
  })
  .then(function () {
    testServer.start(function () {
      // Handler above should get called.
    });
  });
});

// From here onwards, tests work only with the mocked
// up Mobile, because with real devices in CI, the Wifi
// network is configured in a way that it doesn't allow
// routing between peers.
if (jxcore.utils.OSInfo().isMobile) {
  return;
}

test('network changes emitted correctly', function (t) {
  ThaliMobile.start(express.Router())
  .then(function () {
    ThaliMobile.emitter.once('networkChanged', function (networkChangedValue) {
      t.equals(networkChangedValue.wifi, 'off', 'wifi is off');
      ThaliMobile.emitter.once('networkChanged',
      function (networkChangedValue) {
        t.equals(networkChangedValue.wifi, 'on', 'wifi is on');
        t.end();
      });
      testUtils.toggleWifi(true);
    });
    testUtils.toggleWifi(false);
  });
});

test('network changes not emitted in stopped state', function (t) {
  var networkChangedHandler = function () {
    t.fail('network change should not be emitted');
    ThaliMobile.emitter.removeListener('networkChanged', networkChangedHandler);
    t.end();
  };
  ThaliMobile.emitter.on('networkChanged', networkChangedHandler);
  testUtils.toggleWifi(false);
  process.nextTick(function () {
    t.ok(true, 'event was not emitted');
    ThaliMobile.emitter.removeListener('networkChanged', networkChangedHandler);
    testUtils.toggleWifi(true)
    .then(function () {
      t.end();
    });
  });
});

test('calls correct starts when network changes', function (t) {
  var listeningSpy = null;
  var advertisingSpy = null;

  var networkChangedHandler = function (networkChangedValue) {
    if (networkChangedValue.wifi !== 'off') {
      return;
    }
    ThaliMobileNativeWrapper.emitter.removeListener('networkChangedNonTCP',
      networkChangedHandler);
    ThaliMobile.startListeningForAdvertisements()
    .then(function (combinedResult) {
      t.equals(combinedResult.wifiResult.message, 'Radio Turned Off',
              'specific error expected');
      return ThaliMobile.startUpdateAdvertisingAndListening();
    })
    .then(function (combinedResult) {
      t.equals(combinedResult.wifiResult.message, 'Radio Turned Off',
            'specific error expected');
      listeningSpy = sinon.spy(ThaliMobile,
        'startListeningForAdvertisements');
      advertisingSpy = sinon.spy(ThaliMobile,
        'startUpdateAdvertisingAndListening');
      return testUtils.toggleWifi(true);
    })
    .then(function () {
      t.equals(listeningSpy.callCount, 1,
        'startListeningForAdvertisements should have been called');
      t.equals(advertisingSpy.callCount, 1,
        'startUpdateAdvertisingAndListening should have been called');
      ThaliMobile.startListeningForAdvertisements.restore();
      ThaliMobile.startUpdateAdvertisingAndListening.restore();
      t.end();
    });
  };
  ThaliMobile.start(express.Router())
  .then(function () {
    ThaliMobileNativeWrapper.emitter.on('networkChangedNonTCP',
      networkChangedHandler);
    testUtils.toggleWifi(false);
  });
});

test('peer is marked unavailable if port number changes', function (t) {
  var somePeerIdentifier = 'urn:uuid:' + uuid.v4();
  var somePort = 8080;
  var spy = sinon.spy();

  ThaliMobile.start(express.Router())
  .then(function () {
    var availabilityHandler = function (peer) {
      if (peer.peerIdentifier !== somePeerIdentifier) {
        return;
      }
      spy();
      if (spy.calledOnce) {
        // First is the availability event
        checkPeer(t, peer, true);
        ThaliMobileNativeWrapper.emitter.emit(
          'nonTCPPeerAvailabilityChangedEvent',
          {
            peerIdentifier: somePeerIdentifier,
            portNumber: somePort + 1
          }
        );
      } else if (spy.calledTwice) {
        // Second is the unavailability event
        // since the portNumber has changed
        checkPeer(t, peer, false);
      } else if (spy.calledThrice) {
        // Third is the availability event
        // with the new port
        t.equals(peer.portNumber, somePort + 1,
          'port number must match');
        checkPeer(t, peer, true);
        ThaliMobile.emitter.removeListener(
          'peerAvailabilityChanged',
          availabilityHandler
        );
        t.end();
      }
    };
    ThaliMobile.emitter.on('peerAvailabilityChanged',
      availabilityHandler);
    ThaliMobileNativeWrapper.emitter.emit('nonTCPPeerAvailabilityChangedEvent',
      {
        peerIdentifier: somePeerIdentifier,
        portNumber: somePort
      }
    );
  });
});

test('when network connection is lost a peer should be marked unavailable',
function (t) {
  var somePeerIdentifier = 'urn:uuid:' + uuid.v4();
  ThaliMobile.start(express.Router())
  .then(function () {
    var availabilityHandler = function (peer) {
      if (peer.peerIdentifier !== somePeerIdentifier) {
        return;
      }
      ThaliMobile.emitter.removeListener('peerAvailabilityChanged',
        availabilityHandler);
      var unavailabilityHandler = function (peer) {
        if (peer.peerIdentifier !== somePeerIdentifier) {
          return;
        }
        checkPeer(t, peer, false);
        ThaliMobile.emitter.removeListener('peerAvailabilityChanged',
          unavailabilityHandler);

        testUtils.toggleRadios(true);
        t.end();
      };
      ThaliMobile.emitter.on('peerAvailabilityChanged',
        unavailabilityHandler);
      testUtils.toggleRadios(false);
    };
    ThaliMobile.emitter.on('peerAvailabilityChanged',
      availabilityHandler);
    ThaliMobileNativeWrapper.emitter.emit('nonTCPPeerAvailabilityChangedEvent',
      {
        peerIdentifier: somePeerIdentifier,
        portNumber: 8080
      }
    );
  });
});

if (!tape.coordinated) {
  return;
}

var pskIdentity = 'I am me!';
var pskKey = new Buffer('I am a reasonable long string');

var pskIdToSecret = function (id) {
  return id === pskIdentity ? pskKey : null;
};

var setupDiscoveryAndFindPeers = function (t, router, callback) {
  var availabilityHandler = function (peer) {
    if (peer.hostAddress === null || peer.portNumber === null) {
      return;
    }
    callback(peer, function () {
      ThaliMobile.emitter.removeListener(
        'peerAvailabilityChanged',
        availabilityHandler
      );
      // On purpose not stopping anything within the test
      // because another device might still be running the test
      // and waiting for advertisements. The stop happens in the
      // test teardown phase.
      t.end();
    });
  };
  ThaliMobile.emitter.on('peerAvailabilityChanged', availabilityHandler);

  ThaliMobile.start(router, pskIdToSecret)
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

test('peer should be found once after listening and discovery started',
function (t) {
  var spy = sinon.spy();
  var availabilityChangedHandler = function (peer) {
    // Only count changes that mark peer becoming available.
    if (peer.hostAddress !== null && peer.portNumber !== null) {
      spy();
    }
  };
  var peerFound = false;
  ThaliMobile.emitter.on('peerAvailabilityChanged',
    availabilityChangedHandler);
  setupDiscoveryAndFindPeers(t, express.Router(), function (peer, done) {
    if (peerFound) {
      return;
    }
    peerFound = true;
    checkPeer(t, peer, true);
    // The timeout is the unavailability threshold plus a bit extra
    // so that our test verifies the peer is not marked unavailable
    // too soon. The reason the peer should not be marked unavailable
    // is that we advertise over SSDP every 500 milliseconds so the
    // unavailability threshold should never be met when all works
    // normally.
    var timeout = thaliConfig.TCP_PEER_UNAVAILABILITY_THRESHOLD + 500;
    setTimeout(function () {
      ThaliMobile.emitter.removeListener('peerAvailabilityChanged',
        availabilityChangedHandler);
      // The maximum amount is the participants count minues ourseld times 2,
      // because the same participant may be reached via Wifi and non-TCP.
      var maxAvailabilityChanges = (t.participants.length - 1) * 2;
      t.ok(spy.callCount <= maxAvailabilityChanges,
        'must not receive too many peer availabilities');
      done();
    }, timeout);
  });
});

test('can get data from all participants', function (t) {
  var uuidPath = '/uuid';
  var router = express.Router();
  // Register a handler that returns the UUID of this
  // test instance to an HTTP GET request.
  router.get(uuidPath, function (req, res) {
    res.send(tape.uuid);
  });

  var remainingParticipants = {};
  t.participants.forEach(function (participant) {
    if (participant.uuid === tape.uuid) {
      return;
    }
    remainingParticipants[participant.uuid] = true;
  });
  setupDiscoveryAndFindPeers(t, router, function (peer, done) {
    // Try to get data only from non-TCP peers so that the test
    // works the same way on desktop on CI where Wifi is blocked
    // between peers.
    if (peer.connectionType === ThaliMobile.connectionTypes.TCP_NATIVE) {
      return;
    }
    testUtils.get(
      peer.hostAddress, peer.portNumber,
      uuidPath, pskIdentity, pskKey
    )
    .then(function (responseBody) {
      t.ok(remainingParticipants[responseBody],
        'received uuid must be in remaining list');
      delete remainingParticipants[responseBody];
      if (Object.keys(remainingParticipants).length === 0) {
        t.ok(true, 'received all uuids');
        done();
      }
    })
    .catch(function (error) {
      t.fail(error);
      done();
    });
  });
});
