'use strict';

var ThaliMobile = require('thali/NextGeneration/thaliMobile');
var ThaliMobileNativeWrapper = require('thali/NextGeneration/thaliMobileNativeWrapper');
var ThaliConfig = require('thali/NextGeneration/thaliConfig');
var tape = require('../lib/thali-tape');
var testUtils = require('../lib/testUtils.js');
var express = require('express');
var validations = require('thali/validations');
var sinon = require('sinon');
var uuid = require('node-uuid');
var nodessdp = require('node-ssdp');
var randomstring = require('randomstring');

var verifyCombinedResultSuccess = function (t, combinedResult, message) {
  t.equal(combinedResult.wifiResult, null, message || 'error should be null');
  t.equal(combinedResult.nativeResult, null, message || 'error should be null');
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
  var testPeerIdentifier = 'urn:uuid:' + uuid.v4();
  var testSeverHostAddress = randomstring.generate({
    charset: 'hex', // to get lowercase chars for the host address
    length: 8
  });
  var testServerPort = 8080;
  var testServer = new nodessdp.Server({
    location: 'http://' + testSeverHostAddress + ':' + testServerPort,
    udn: ThaliConfig.SSDP_NT,
    // Make the interval 10 times longer than expected
    // to make sure we determine the peer is gone while
    // waiting for the advertisement.
    adInterval: ThaliConfig.SSDP_ADVERTISEMENT_INTERVAL * 10
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

test('when network connection is lost a peer should be marked unavailable',
function (t) {
  ThaliMobile.start(express.Router())
  .then(function () {
    var dummyPeerIdentifier = 'dummyPeer';
    var availabilityHandler = function (peer) {
      if (peer.peerIdentifier !== dummyPeerIdentifier) {
        return;
      }
      ThaliMobile.emitter.removeListener('peerAvailabilityChanged',
        availabilityHandler);
      var unavailabilityHandler = function (peer) {
        if (peer.peerIdentifier !== dummyPeerIdentifier) {
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
        peerIdentifier: dummyPeerIdentifier,
        hostAddress: 'dummy',
        portNumber: 8080
      }
    );
  });
});

if (!tape.coordinated) {
  return;
}

var setupDiscoveryAndFindPeer = function (t, callback) {
  ThaliMobile.emitter.once('peerAvailabilityChanged', function (peer) {
    // Just use the first peer that is changed. In reality, it is possible that
    // if this test is run in environment with multiple Thali apps running, the
    // peer we get here isn't exactly the one with whom we are running these
    // tests with. However, even with any peer, this test vefifies that we do
    // get correctly formatted advertisements.
    callback(peer, function () {
      // On purpose not stopping anything within the test
      // because another device might still be running the test
      // and waiting for advertisements. The stop happens in the
      // test teardown phase.
      t.end();
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

test('a peer should be found after #startListeningForAdvertisements is called',
function (t) {
  setupDiscoveryAndFindPeer(t, function (peer, done) {
    checkPeer(t, peer, true);
    done();
  });
});
