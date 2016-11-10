'use strict';

var ThaliMobile = require('thali/NextGeneration/thaliMobile');
var ThaliMobileNativeWrapper = require('thali/NextGeneration/thaliMobileNativeWrapper');
var ThaliMobileNative = require('thali/NextGeneration/thaliMobileNative');
var USN = require('thali/NextGeneration/utils/usn');
var thaliConfig = require('thali/NextGeneration/thaliConfig');
var tape = require('../lib/thaliTape');
var testUtils = require('../lib/testUtils.js');
var express = require('express');
var validations = require('thali/validations');
var sinon = require('sinon');
var uuid = require('uuid');
var nodessdp = require('node-ssdp');
var randomstring = require('randomstring');
var logger = require('thali/ThaliLogger')('testThaliMobile');
var Promise = require('lie');
var PromiseQueue = require('thali/NextGeneration/promiseQueue');
var platform = require('thali/NextGeneration/utils/platform');
var net = require('net');

var radioState = ThaliMobileNative.radioState;
var connectionTypes = ThaliMobileNativeWrapper.connectionTypes;
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
  })
  .catch(function (error) {
    t.fail(error);
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

var generateLowerLevelPeers = function () {
  var nativePeer = {
    peerIdentifier: uuid.v4(),
    peerAvailable: true,
    generation: 0,
    portNumber: platform.isIOS ? null : 12345
  };
  var wifiPeer = {
    peerIdentifier: uuid.v4(),
    generation: 0,
    hostAddress: '127.0.0.1',
    portNumber: 54321
  };
  return {
    nativePeer: nativePeer,
    wifiPeer: wifiPeer
  };
};

var emitNativePeerAvailability = function (testPeer) {
  ThaliMobileNativeWrapper.emitter
    .emit('nonTCPPeerAvailabilityChangedEvent', testPeer);
};

var emitWifiPeerAvailability = function (testPeer) {
  ThaliMobile._getThaliWifiInfrastructure()
    .emit('wifiPeerAvailabilityChanged', testPeer);
};

var getNativeConnectionType = function () {
  return platform.isIOS ?
    connectionTypes.MULTI_PEER_CONNECTIVITY_FRAMEWORK :
    connectionTypes.BLUETOOTH;
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

test('#start - Causing native or wifi to fail will cause a promise reject ',
  function (t) {
    ThaliMobile.start(null, {}, ThaliMobile.networkTypes.BOTH)
      .then(function () {
        t.fail('We should have failed');
      })
      .catch(function (result) {
        t.notOk(result.wifiResult, 'This should not cause wifi to fail');
        t.equal(result.nativeResult.message, 'Bad Router', 'native router ' +
          'should be bad');
      })
      .then(function () {
        t.end();
      });
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

test('#stop should clear watchers and change peers', function (t) {
  var somePeerIdentifier = 'urn:uuid:' + uuid.v4();

  var connectionType =
    platform.isAndroid ?
      ThaliMobileNativeWrapper.connectionTypes.BLUETOOTH :
      ThaliMobileNativeWrapper
        .connectionTypes.MULTI_PEER_CONNECTIVITY_FRAMEWORK;

  ThaliMobile.start(express.Router(), new Buffer('foo'),
    ThaliMobile.networkTypes.NATIVE)
    .then(function () {
      return ThaliMobile.startListeningForAdvertisements();
    })
    .then(function () {
      return ThaliMobileNativeWrapper._handlePeerAvailabilityChanged({
        peerIdentifier: somePeerIdentifier,
        peerAvailable: true,
        pleaseConnect: false
      });
    })
    .then(function () {
      t.equal(Object.getOwnPropertyNames(
        ThaliMobile._peerAvailabilityWatchers[connectionType]).length, 1,
        'Watchers have one entry for our connection type');
      t.equal(Object.getOwnPropertyNames(
        ThaliMobile._peerAvailabilities[connectionType]).length, 1,
        'Peer availabilities has one entry for our connection type');
      return ThaliMobile.stop();
    })
    .then(function () {
      Object.getOwnPropertyNames(ThaliMobileNativeWrapper.connectionTypes)
        .forEach(function (connectionKey) {
          var connectionType = ThaliMobileNativeWrapper
            .connectionTypes[connectionKey];
          t.equal(Object.getOwnPropertyNames(
            ThaliMobile._peerAvailabilityWatchers[connectionType]).length,
            0,'No watchers');
          t.equal(Object.getOwnPropertyNames(
            ThaliMobile._peerAvailabilities[connectionType]).length,
            0,'No peers');
        });
      t.end();
    })
    .catch(function (err) {
      t.fail('Failed out with ' + err);
      t.end();
    });
});

test('does not emit duplicate discoveryAdvertisingStateUpdate',
  function () {
    // test is not for native transport because it fires artificial events from
    // the native layer
    return global.NETWORK_TYPE !== ThaliMobile.networkTypes.WIFI;
  },
  function (t) {
    var spy = sinon.spy();
    ThaliMobile.start(express.Router()).then(function () {
      return ThaliMobile.startListeningForAdvertisements();
    }).then(function () {
      return ThaliMobile.startUpdateAdvertisingAndListening();
    }).then(function () {
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
        'discoveryAdvertisingStateUpdateNonTCP', testStatus
      );
      ThaliMobileNativeWrapper.emitter.emit(
        'discoveryAdvertisingStateUpdateNonTCP', testStatus
      );
    });
  }
);

test('does not send duplicate availability changes', function (t) {
  var nativePeer = generateLowerLevelPeers().nativePeer;
  var spy = sinon.spy(ThaliMobile.emitter, 'emit');
  emitNativePeerAvailability(nativePeer);
  process.nextTick(function () {
    t.equals(spy.callCount, 1, 'should be called once');
    emitNativePeerAvailability(nativePeer);
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
      [
        'wifi',
        'bluetooth',
        'bluetoothLowEnergy',
        'cellular'
      ]
      .forEach(function (requiredProperty) {
        validations.ensureNonNullOrEmptyString(
          networkChangedValue[requiredProperty]
        );
      });
    }, 'network status should have certain non-empty properties');
    t.end();
  });
});

test('wifi peer is marked unavailable if announcements stop',
  function () {
    return global.NETWORK_TYPE !== ThaliMobile.networkTypes.WIFI;
  },
  function (t) {
    // Store the original threshold so that it can be restored
    // at the end of the test.
    var originalThreshold = thaliConfig.TCP_PEER_UNAVAILABILITY_THRESHOLD;
    // Make the threshold a bit shorter so that the test doesn't
    // have to wait for so long.
    thaliConfig.TCP_PEER_UNAVAILABILITY_THRESHOLD =
      thaliConfig.SSDP_ADVERTISEMENT_INTERVAL * 2;
    var testPeerIdentifier = uuid.v4();
    var testServerHostAddress = randomstring.generate({
      charset: 'hex', // to get lowercase chars for the host address
      length: 8
    });
    var testServerPort = 8080;
    var testServer = new nodessdp.Server({
      location: 'http://' + testServerHostAddress + ':' + testServerPort,
      udn: thaliConfig.SSDP_NT,
      // Make the interval 10 times longer than expected
      // to make sure we determine the peer is gone while
      // waiting for the advertisement.
      adInterval: thaliConfig.SSDP_ADVERTISEMENT_INTERVAL * 10
    });
    testServer.setUSN(USN.stringify({
      peerIdentifier: testPeerIdentifier,
      generation: 0
    }));

    var spy = sinon.spy();
    var availabilityChangedHandler = function (peer) {
      if (peer.peerIdentifier !== testPeerIdentifier) {
        return;
      }

      // TODO Apply changes from #904 to tests
      spy();
      if (spy.calledOnce) {
        t.equal(peer.peerAvailable, true, 'peer should be available');
      } else if (spy.calledTwice) {
        t.equal(peer.peerAvailable, false, 'peer should become unavailable');

        ThaliMobile.emitter.removeListener('peerAvailabilityChanged',
          availabilityChangedHandler);
        testServer.stop(function () {
          thaliConfig.TCP_PEER_UNAVAILABILITY_THRESHOLD = originalThreshold;
          t.end();
        });
      }
    };
    ThaliMobile.emitter.on('peerAvailabilityChanged',
      availabilityChangedHandler);

    ThaliMobile.start(express.Router())
    .then(function () {
      return ThaliMobile.startListeningForAdvertisements();
    })
    .then(function () {
      testServer.start(function () {
        // Handler above should get called.
      });
    });
  }
);

test('native peer should be removed if no availability updates ' +
'were received during availability timeout',
  function (t) {
    var originalThreshold = thaliConfig.NON_TCP_PEER_UNAVAILABILITY_THRESHOLD;
    // Make the threshold a bit shorter so that the test doesn't
    // have to wait for so long.
    thaliConfig.NON_TCP_PEER_UNAVAILABILITY_THRESHOLD = 100;

    t.timeoutAfter(thaliConfig.NON_TCP_PEER_UNAVAILABILITY_THRESHOLD * 3);

    var nativePeer = generateLowerLevelPeers().nativePeer;
    var callCount = 0;

    var availabilityHandler = function (peerStatus) {
      if (peerStatus.peerIdentifier !== nativePeer.peerIdentifier) {
        return;
      }
      callCount++;

      switch (callCount) {
        case 1:
          t.equal(peerStatus.peerAvailable, true, 'peer is available');
          break;
        case 2:
          t.equal(peerStatus.peerAvailable, false,
            'peer is not availabel because it was too silent');
          //restore everything
          thaliConfig.NON_TCP_PEER_UNAVAILABILITY_THRESHOLD = originalThreshold;
          ThaliMobile.emitter
              .removeListener('peerAvailabilityChanged', availabilityHandler);
          t.end();
          break;
      }
    };
    ThaliMobile.emitter.on('peerAvailabilityChanged', availabilityHandler);

    ThaliMobile.start(express.Router()).then(function () {
      emitNativePeerAvailability(nativePeer);
    });
  }
);

test('peerAvailabilityChanged - peer added/removed to/from cache (native)',
  function (t) {
    var timeout = Math.min(
      thaliConfig.NON_TCP_PEER_UNAVAILABILITY_THRESHOLD / 2,
      30 * 1000
    );
    t.timeoutAfter(timeout);

    var nativePeer = generateLowerLevelPeers().nativePeer;
    var callCount = 0;
    var connectionType = getNativeConnectionType();

    var availabilityHandler = function (peerStatus) {
      if (peerStatus.peerIdentifier !== nativePeer.peerIdentifier) {
        return;
      }
      callCount++;

      var cache = ThaliMobile._getPeerAvailabilities();
      var nativePeers = cache[connectionType];

      switch (callCount) {
        case 1:
          t.equal(peerStatus.peerAvailable, true,
            'peer should be available');
          t.ok(nativePeers[nativePeer.peerIdentifier],
            'cache contains native peer');
          nativePeer.peerAvailable = false;
          nativePeer.portNumber = null;
          emitNativePeerAvailability(nativePeer);
          break;
        case 2:
          t.equal(peerStatus.peerAvailable, false,
            'peer should be unavailable');
          t.notOk(nativePeers[nativePeer.peerIdentifier],
            'peer has been removed from cache');
          setImmediate(end);
          break;
        default:
          t.fail('should not be called more than twice');
          break;
      }
    };

    ThaliMobile.emitter.on('peerAvailabilityChanged', availabilityHandler);

    // jshint latedef:false
    function end() {
      ThaliMobile.emitter
        .removeListener('peerAvailabilityChanged', availabilityHandler);
      t.end();
    }
    // jshint latedef:true

    var cache = ThaliMobile._getPeerAvailabilities();
    var nativePeers = cache[connectionType];
    t.notOk(nativePeers[nativePeer.peerIdentifier],
      'we have not added peer to the cache yet');
    emitNativePeerAvailability(nativePeer);
  }
);

test('peerAvailabilityChanged - peer added/removed to/from cache (wifi)',
  function (t) {
    t.timeoutAfter(thaliConfig.TCP_PEER_UNAVAILABILITY_THRESHOLD / 2);

    var wifiPeer = generateLowerLevelPeers().wifiPeer;
    var callCount = 0;

    var availabilityHandler = function (peerStatus) {
      if (peerStatus.peerIdentifier !== wifiPeer.peerIdentifier) {
        return;
      }
      callCount++;

      var cache = ThaliMobile._getPeerAvailabilities();
      var wifiPeers = cache[connectionTypes.TCP_NATIVE];

      switch (callCount) {
        case 1:
          t.equal(peerStatus.peerAvailable, true,
            'peer should be available');
          t.ok(wifiPeers[wifiPeer.peerIdentifier],
            'cache contains wifi peer');
          wifiPeer.peerHost = null;
          wifiPeer.portNumber = null;
          emitWifiPeerAvailability(wifiPeer);
          break;
        case 2:
          t.equal(peerStatus.peerAvailable, false,
            'peer should be unavailable');
          t.notOk(wifiPeers[wifiPeer.peerIdentifier],
            'peer has been removed from cache');
          setImmediate(end);
          break;
        default:
          t.fail('should not be called more than twice');
          break;
      }
    };

    ThaliMobile.emitter.on('peerAvailabilityChanged', availabilityHandler);

    // jshint latedef:false
    function end() {
      ThaliMobile.emitter
        .removeListener('peerAvailabilityChanged', availabilityHandler);
      t.end();
    }
    // jshint latedef:true

    var cache = ThaliMobile._getPeerAvailabilities();
    var wifiPeers = cache[connectionTypes.TCP_NATIVE];
    t.notOk(wifiPeers[wifiPeer.peerIdentifier],
      'we have not added peer to the cache yet');
    emitWifiPeerAvailability(wifiPeer);
  }
);

test('peerAvailabilityChanged - peer with the same id, conn type, host, port ' +
'and generation is ignored',
  function (t) {
    var testPeers = generateLowerLevelPeers();
    var callCount = 0;
    var discoveredPeerIds = [];

    var isTestPeer = function (peer) {
      return (
        peer.peerIdentifier !== testPeers.wifiPeer.peerIdentifier ||
        peer.peerIdentifier !== testPeers.nativePeer.peerIdentifier
      );
    };

    var availabilityHandler = function (peerStatus) {
      if (!isTestPeer(peerStatus)) {
        return;
      }
      callCount++;

      switch (callCount) {
        case 1:
          t.equal(peerStatus.peerAvailable, true, 'first peer is available');
          discoveredPeerIds.push(peerStatus.peerIdentifier);
          break;
        case 2:
          t.equal(peerStatus.peerAvailable, true, 'second peer is available');
          discoveredPeerIds.push(peerStatus.peerIdentifier);
          t.notEqual(discoveredPeerIds[0], discoveredPeerIds[1],
            'first and second peers are different');
          setImmediate(end);
          break;
        default:
          t.fail('should not be called more than twice');
          break;
      }
    };

    ThaliMobile.emitter.on('peerAvailabilityChanged', availabilityHandler);

    // jshint latedef:false
    function end() {
      ThaliMobile.emitter
        .removeListener('peerAvailabilityChanged', availabilityHandler);
      t.end();
    }
    // jshint latedef:true

    emitNativePeerAvailability(testPeers.nativePeer);
    emitWifiPeerAvailability(testPeers.wifiPeer);
    emitNativePeerAvailability(testPeers.nativePeer);
    emitWifiPeerAvailability(testPeers.wifiPeer);
  }
);

test('native available - new peer is cached',
  function (t) {
    t.timeoutAfter(50);
    var nativePeer = generateLowerLevelPeers().nativePeer;
    var connectionType = getNativeConnectionType();

    var availabilityHandler = function (peerStatus) {
      if (peerStatus.peerIdentifier === nativePeer.peerIdentifier) {
        t.equal(peerStatus.peerAvailable, true, 'peer is available');
        end();
      }
    };

    ThaliMobile.emitter.on('peerAvailabilityChanged', availabilityHandler);

    // jshint latedef:false
    function end() {
      ThaliMobile.emitter
        .removeListener('peerAvailabilityChanged', availabilityHandler);
      t.end();
    }
    // jshint latedef:true

    var cache = ThaliMobile._getPeerAvailabilities();
    var nativePeers = cache[connectionType];
    t.notOk(nativePeers[nativePeer.peerIdentifier],
      'should not be in cache at start');

    emitNativePeerAvailability(nativePeer);
  }
);

test('native available - peer with same port and different generation is ' +
'cached (BLUETOOTH)',
  function () {
    return !platform.isAndroid;
  },
  function (t) {
    var nativePeer = generateLowerLevelPeers().nativePeer;
    var callCount = 0;

    var availabilityHandler = function (peerStatus) {
      if (peerStatus.peerIdentifier !== nativePeer.peerIdentifier) {
        return;
      }
      callCount++;

      switch(callCount) {
        case 1:
          t.equal(peerStatus.peerAvailable, true, 'peer should be available');
          nativePeer.generation = 3;
          emitNativePeerAvailability(nativePeer);
          break;
        case 2:
          t.equal(peerStatus.peerAvailable, true, 'peer should be available');
          nativePeer.generation = 1;
          emitNativePeerAvailability(nativePeer);
          break;
        case 3:
          t.equal(peerStatus.peerAvailable, true, 'peer should be available');
          emitNativePeerAvailability(nativePeer);
          setImmediate(end);
          break;
        default:
          t.fail('should not be called again');
          break;
      }
    };

    ThaliMobile.emitter.on('peerAvailabilityChanged', availabilityHandler);

    // jshint latedef:false
    function end() {
      ThaliMobile.emitter
        .removeListener('peerAvailabilityChanged', availabilityHandler);
      t.end();
    }
    // jshint latedef:true

    nativePeer.generation = 2;
    emitNativePeerAvailability(nativePeer);
  }
);

test('native available - peer with the same port and generation but with ' +
'enough time for generation to wrap around is cached (BLUETOOTH)',
  function () {
    return !platform.isAndroid;
  },
  function (t) {
    var nativePeer = generateLowerLevelPeers().nativePeer;
    var callCount = 0;

    // make update window shorter because nobody wants to wait 51 seconds for
    // test to complete
    var originalUpdateWindow = thaliConfig.UPDATE_WINDOWS_FOREGROUND_MS;
    thaliConfig.UPDATE_WINDOWS_FOREGROUND_MS = 0.1;

    t.timeoutAfter(thaliConfig.UPDATE_WINDOWS_FOREGROUND_MS * 1000);

    var availabilityHandler = function (peerStatus) {
      if (peerStatus.peerIdentifier !== nativePeer.peerIdentifier) {
        return;
      }
      callCount++;

      switch(callCount) {
        case 1:
          t.equal(peerStatus.peerAvailable, true, 'peer should be available');
          setTimeout(function () {
            emitNativePeerAvailability(nativePeer);
          }, thaliConfig.UPDATE_WINDOWS_FOREGROUND_MS * 500);
          break;
        case 2:
          t.equal(peerStatus.peerAvailable, true, 'peer should be available');
          setImmediate(end);
          break;
        default:
          t.fail('should not be called again');
          break;
      }
    };

    ThaliMobile.emitter.on('peerAvailabilityChanged', availabilityHandler);

    // jshint latedef:false
    function end() {
      thaliConfig.UPDATE_WINDOWS_FOREGROUND_MS = originalUpdateWindow;
      ThaliMobile.emitter
        .removeListener('peerAvailabilityChanged', availabilityHandler);
      t.end();
    }
    // jshint latedef:true

    nativePeer.generation = 2;
    emitNativePeerAvailability(nativePeer);
  }
);

test('native available - peer with greater generation is cached (MPCF)',
  function () {
    return !platform.isIOS;
  },
  function (t) {
    var nativePeer = generateLowerLevelPeers().nativePeer;
    var callCount = 0;
    var generationIncreased = false;

    var availabilityHandler = function (peerStatus) {
      if (peerStatus.peerIdentifier !== nativePeer.peerIdentifier) {
        return;
      }
      callCount++;

      switch(callCount) {
        case 1:
          t.equal(peerStatus.peerAvailable, true, 'peer should be available');
          nativePeer.generation = 1;
          // lower generation should be ignored
          emitNativePeerAvailability(nativePeer);
          setImmediate(function () {
            nativePeer.generation = 3;
            generationIncreased = true;
            emitNativePeerAvailability(nativePeer);
          });
          break;
        case 2:
          t.equal(peerStatus.peerAvailable, true, 'peer should be available');
          if (!generationIncreased) {
            t.fail('should not be called for lower generation');
          }
          var cache = ThaliMobile._getPeerAvailabilities();
          var cachedPeer =
            cache[getNativeConnectionType()][peerStatus.peerIdentifier];
          t.equal(cachedPeer.generation, 3, 'should store correct generation');
          setImmediate(end);
          break;
        default:
          t.fail('should not be called again');
          break;
      }
    };

    ThaliMobile.emitter.on('peerAvailabilityChanged', availabilityHandler);

    // jshint latedef:false
    function end() {
      ThaliMobile.emitter
        .removeListener('peerAvailabilityChanged', availabilityHandler);
      t.end();
    }
    // jshint latedef:true

    nativePeer.generation = 2;
    emitNativePeerAvailability(nativePeer);
  }
);

test('native available - peer with same or older generation is ignored (MPCF)',
  function () {
    return !platform.isIOS;
  },
  function (t) {
    t.skip('NOT IMPLEMENTED');
    t.end();
  }
);

test('native unavailable - new peer is ignored',
  function (t) {
    t.skip('NOT IMPLEMENTED');
    t.end();
  }
);

test('native unavailable - cached peer is removed',
  function (t) {
    t.skip('NOT IMPLEMENTED');
    t.end();
  }
);

test('networkChanged - fires peerAvailabilityChanged event for wifi peers',
  function (t) {
    // Scenario:
    // 1. wifi and native layers discover peers (1 native and 1 wifi)
    //
    // Expected result: fire peerAvailabilityChanged twice with peerAvailable
    // set to true
    //
    // 2. got networkChangedNonTCP from mobileNativeWrapper with wifi: OFF
    //
    // Expected result: fire peerAvailabilityChanged with wifi peer's id and
    // peerAvailable set to false

    var testPeers = generateLowerLevelPeers();
    var callCount = 0;

    var isTestPeer = function (peer) {
      return (
        peer.peerIdentifier === testPeers.nativePeer.peerIdentifier ||
        peer.peerIdentifier === testPeers.wifiPeer.peerIdentifier
      );
    };

    function disableWifi() {
      ThaliMobileNativeWrapper.emitter.emit('networkChangedNonTCP', {
        wifi: radioState.OFF,
        bssidName: null,
        bluetoothLowEnergy: radioState.ON,
        bluetooth: radioState.ON,
        cellular: radioState.ON
      });
    }

    var availabilityHandler = function (peerStatus) {
      if (!isTestPeer(peerStatus)) {
        return;
      }
      callCount++;

      switch (callCount) {
        case 1:
          t.equals(peerStatus.peerAvailable, true,
            'first peer is expected to be available');
          emitWifiPeerAvailability(testPeers.wifiPeer);
          break;
        case 2:
          t.equals(peerStatus.peerAvailable, true,
            'second peer is expected to be available');
          disableWifi();
          break;
        case 3:
          t.equals(peerStatus.peerAvailable, false,
            'peer became unavailable');
          t.equals(peerStatus.peerIdentifier, testPeers.wifiPeer.peerIdentifier,
            'it was wifi peer');
          setImmediate(end);
          break;
        default:
          t.fail('should not be called again');
          break;
      }
    };

    ThaliMobile.emitter.on('peerAvailabilityChanged', availabilityHandler);

    // jshint latedef:false
    function end() {
      ThaliMobile.emitter
        .removeListener('peerAvailabilityChanged', availabilityHandler);
      t.end();
    }
    // jshint latedef:true

    // Add initial peers
    ThaliMobile.start(express.Router()).then(function () {
      emitNativePeerAvailability(testPeers.nativePeer);
    }).catch(end);
  }
);

test('networkChanged - fires peerAvailabilityChanged event for native peers ' +
'(BLUETOOTH)',
  function () {
    return !platform.isAndroid;
  },
  function (t) {
    // Scenario:
    // 1. wifi and native layers discover peers (1 native and 1 wifi)
    //
    // Expected result: fire peerAvailabilityChanged twice with peerAvailable
    // set to true
    //
    // 2. got networkChangedNonTCP from mobileNativeWrapper with bluetooth: OFF
    //
    // Expected result: fire peerAvailabilityChanged with native peer's id and
    // peerAvailable set to false

    var timeout = Math.min(
      thaliConfig.NON_TCP_PEER_UNAVAILABILITY_THRESHOLD / 2,
      30 * 1000
    );
    t.timeoutAfter(timeout);

    var testPeers = generateLowerLevelPeers();
    var callCount = 0;

    var isTestPeer = function (peer) {
      return (
        peer.peerIdentifier === testPeers.nativePeer.peerIdentifier ||
        peer.peerIdentifier === testPeers.wifiPeer.peerIdentifier
      );
    };

    function disableBluetooth() {
      ThaliMobileNativeWrapper.emitter.emit('networkChangedNonTCP', {
        wifi: radioState.ON,
        bssidName: null,
        bluetoothLowEnergy: radioState.OFF,
        bluetooth: radioState.OFF,
        cellular: radioState.ON
      });
    }

    var availabilityHandler = function (peerStatus) {
      if (!isTestPeer(peerStatus)) {
        return;
      }
      callCount++;

      switch (callCount) {
        case 1:
          t.equals(peerStatus.peerAvailable, true,
            'first peer is expected to be available');
          emitWifiPeerAvailability(testPeers.wifiPeer);
          break;
        case 2:
          t.equals(peerStatus.peerAvailable, true,
            'second peer is expected to be available');
          disableBluetooth();
          break;
        case 3:
          t.equals(peerStatus.peerAvailable, false,
            'peer became unavailable');
          t.equals(
            peerStatus.peerIdentifier,
            testPeers.nativePeer.peerIdentifier,
            'it was a native peer');
          setImmediate(end);
          break;
        default:
          t.fail('should not be called again');
          break;
      }
    };

    ThaliMobile.emitter.on('peerAvailabilityChanged', availabilityHandler);

    // jshint latedef:false
    function end() {
      ThaliMobile.emitter
        .removeListener('peerAvailabilityChanged', availabilityHandler);
      t.end();
    }
    // jshint latedef:true

    // Add initial peers
    ThaliMobile.start(express.Router()).then(function () {
      emitNativePeerAvailability(testPeers.nativePeer);
    });
  }
);

test('networkChanged - fires peerAvailabilityChanged event for native peers ' +
'(MPCF)',
  function () {
    return !platform.isIOS;
  },
  function (t) {
    // Scenario:
    // 1. wifi and native layers discover peers (1 native and 1 wifi)
    //
    // Expected result: fire peerAvailabilityChanged twice with peerAvailable
    // set to true
    //
    // 2. got networkChangedNonTCP from mobileNativeWrapper with
    //    bluetooth: OFF, wifi: ON
    //
    // Expected result: nothing changed
    //
    // 3. got networkChangedNonTCP from mobileNativeWrapper with
    //    bluetooth: OFF, wifi: OFF
    //
    // Expected result: fire peerAvailabilityChanged twice with peerAvailable
    // set to false

    var testPeers = generateLowerLevelPeers();
    var callCount = 0;
    var disableWifiCalled = false;

    var isTestPeer = function (peer) {
      return (
        peer.peerIdentifier === testPeers.nativePeer.peerIdentifier ||
        peer.peerIdentifier === testPeers.wifiPeer.peerIdentifier
      );
    };

    function disableBluetooth() {
      ThaliMobileNativeWrapper.emitter.emit('networkChangedNonTCP', {
        wifi: radioState.ON,
        bssidName: null,
        bluetoothLowEnergy: radioState.ON,
        bluetooth: radioState.OFF,
        cellular: radioState.ON
      });
    }

    function disableWifi() {
      disableWifiCalled = true;
      ThaliMobileNativeWrapper.emitter.emit('networkChangedNonTCP', {
        wifi: radioState.OFF,
        bssidName: null,
        bluetoothLowEnergy: radioState.ON,
        bluetooth: radioState.OFF,
        cellular: radioState.ON
      });
    }

    var availabilityHandler = function (peerStatus) {
      if (!isTestPeer(peerStatus)) {
        return;
      }
      callCount++;

      switch (callCount) {
        case 1:
          t.equals(peerStatus.peerAvailable, true,
            'first peer is expected to be available');
          emitWifiPeerAvailability(testPeers.wifiPeer);
          break;
        case 2:
          t.equals(peerStatus.peerAvailable, true,
            'second peer is expected to be available');
          disableBluetooth();
          setTimeout(function () {
            // disabling bluetooth only should not fire peerAvailabilityChanged.
            disableWifi();
          });
          break;
        case 3:
          if (!disableWifiCalled) {
            t.fail('Got peerAvailabilityChanged before wifi was disabled');
          }
          t.equals(peerStatus.peerAvailable, false, 'peer became unavailable');
          setImmediate(end);
          break;
        default:
          t.fail('should not be called again');
          break;
      }
    };

    ThaliMobile.emitter.on('peerAvailabilityChanged', availabilityHandler);

    // jshint latedef:false
    function end() {
      ThaliMobile.emitter
        .removeListener('peerAvailabilityChanged', availabilityHandler);
      t.end();
    }
    // jshint latedef:true

    // Add initial peers
    emitNativePeerAvailability(testPeers.nativePeer);
  }
);

test('multiconnect failure - new peer is ignored (MPCF)',
  function () {
    return !platform.isIOS;
  },
  function (t) {
    t.skip('NOT IMPLEMENTED');
    t.end();
  }
);

test('multiconnect failure - cached peer fires peerAvailabilityChanged (MPCF)',
  function () {
    return !platform.isIOS;
  },
  function (t) {
    t.skip('NOT IMPLEMENTED');
    t.end();
  }
);

test('newAddressPort field (TCP_NATIVE)', function (t) {
  t.timeoutAfter(thaliConfig.TCP_PEER_UNAVAILABILITY_THRESHOLD / 2);

  var wifiPeer = generateLowerLevelPeers().wifiPeer;
  var callCount = 0;

  var availabilityHandler = function (peerStatus) {
    if (peerStatus.peerIdentifier !== wifiPeer.peerIdentifier) {
      return;
    }
    callCount++;

    switch(callCount) {
      case 1:
        t.equals(peerStatus.newAddressPort, false,
          'peer discovered first time does not have new address');
        wifiPeer.generation = 20;
        emitWifiPeerAvailability(wifiPeer);
        break;
      case 2:
        t.equals(peerStatus.newAddressPort, false,
          'address has not been changed');
        wifiPeer.portNumber += 1;
        emitWifiPeerAvailability(wifiPeer);
        break;
      case 3:
        t.equals(peerStatus.newAddressPort, true,
          'new port handled correctly');
        wifiPeer.hostAddress += '1';
        emitWifiPeerAvailability(wifiPeer);
        break;
      case 4:
        t.equals(peerStatus.newAddressPort, true,
          'new host handled correctly');
        wifiPeer.hostAddress = null;
        wifiPeer.portNumber = null;
        emitWifiPeerAvailability(wifiPeer);
        break;
      case 5:
        t.equals(peerStatus.newAddressPort, null,
          'newAddressPort is null for unavailable peers');
        setImmediate(end);
        break;
      default:
        t.fail('should not be called again');
    }
  };


  ThaliMobile.emitter.on('peerAvailabilityChanged', availabilityHandler);
  // jshint latedef:false
  function end() {
    ThaliMobile.emitter
      .removeListener('peerAvailabilityChanged', availabilityHandler);
    t.end();
  }
  // jshint latedef:true

  emitWifiPeerAvailability(wifiPeer);
});

test('newAddressPort field (BLUETOOTH)',
  function () {
    return !platform.isAndroid;
  },
  function (t) {
    var timeout = Math.min(
      thaliConfig.NON_TCP_PEER_UNAVAILABILITY_THRESHOLD / 2,
      30 * 1000
    );
    t.timeoutAfter(timeout);

    var nativePeer = generateLowerLevelPeers().nativePeer;
    var callCount = 0;

    var availabilityHandler = function (peerStatus) {
      if (peerStatus.peerIdentifier !== nativePeer.peerIdentifier) {
        return;
      }
      callCount++;

      switch(callCount) {
        case 1:
          t.equals(peerStatus.newAddressPort, false,
            'peer discovered first time does not have new address');
          nativePeer.generation = 20;
          emitNativePeerAvailability(nativePeer);
          break;
        case 2:
          t.equals(peerStatus.newAddressPort, false,
            'address has not been changed');
          nativePeer.portNumber += 1;
          emitNativePeerAvailability(nativePeer);
          break;
        case 3:
          t.equals(peerStatus.newAddressPort, true,
            'new port handled correctly');
          nativePeer.peerAvailable = false;
          emitNativePeerAvailability(nativePeer);
          break;
        case 4:
          t.equals(peerStatus.newAddressPort, null,
            'newAddressPort is null for unavailable peers');
          setImmediate(end);
          break;
        default:
          t.fail('should not be called again');
      }
    };


    ThaliMobile.emitter.on('peerAvailabilityChanged', availabilityHandler);
    // jshint latedef:false
    function end() {
      ThaliMobile.emitter
        .removeListener('peerAvailabilityChanged', availabilityHandler);
      t.end();
    }
    // jshint latedef:true

    emitNativePeerAvailability(nativePeer);
  }
);

test('newAddressPort field (MPCF)',
  function () {
    return !platform.isIOS;
  },
  function (t) {
    // newAddressPort should be checked after multiConnectConnectionFailure
    t.skip('NOT IMPLEMENTED');
    t.end();
  }
);

test('newAddressPort after listenerRecreatedAfterFailure event (BLUETOOTH)',
  function () {
    return !platform.isAndroid;
  },
  function (t) {
    // Scenario:
    // 1. bluetooth peer in availability cache
    // 2. tcpServerManager fires 'listenerRecreatedAfterFailure' with the SAME
    //    port as an old one (before recreation)
    //
    // Expected result: peerAvailabilityChanged event fired with newAddressPort
    // set tot true
    t.skip('NOT IMPLEMENTED');
    t.end();
  }
);

test('#getPeerHostInfo - error when peer has not been discovered yet',
function (t) {
  var connectionType = ThaliMobileNativeWrapper.connectionTypes.TCP_NATIVE;
  ThaliMobile.getPeerHostInfo('foo', connectionType)
    .then(function () {
      t.fail('should never be called');
      t.end();
    })
    .catch(function (err) {
      t.equal(err.message, 'peer not available');
      t.end();
    });
});

function checkPeerHostInfoProperties(t, peerHostInfo, peer) {
  var expectedKeys = ['hostAddress', 'portNumber', 'suggestedTCPTimeout'];
  var actualKeys = Object.keys(peerHostInfo);
  expectedKeys.sort();
  actualKeys.sort();
  t.deepEqual(actualKeys, expectedKeys, 'contains expected properties');
}

test('#getPeerHostInfo - returns discovered cached native peer', function (t) {
  var peer = {
    peerIdentifier: 'foo',
    peerAvailable: true,
    generation: 0,
    portNumber: 9999
  };

  ThaliMobileNativeWrapper.emitter.emit(
    'nonTCPPeerAvailabilityChangedEvent',
    peer
  );

  var connectionType = platform.isIOS ?
    ThaliMobileNativeWrapper.connectionTypes.MULTI_PEER_CONNECTIVITY_FRAMEWORK :
    ThaliMobileNativeWrapper.connectionTypes.BLUETOOTH;

  ThaliMobile.getPeerHostInfo(peer.peerIdentifier, connectionType)
  .then(function (peerHostInfo) {
    checkPeerHostInfoProperties(t, peerHostInfo, peer);
    t.equal(peerHostInfo.hostAddress, '127.0.0.1', 'the same hostAddress');
    t.equal(peerHostInfo.portNumber, peer.portNumber, 'the same portNumber');
    t.end();
  }).catch(t.end);
});

test('#getPeerHostInfo - returns discovered cached wifi peer',
  function (t) {
    var peer = {
      peerIdentifier: 'foo',
      generation: 0,
      hostAddress: 'someaddress',
      portNumber: 9999
    };

    var thaliWifiInfrastructure = ThaliMobile._getThaliWifiInfrastructure();
    thaliWifiInfrastructure.emit('wifiPeerAvailabilityChanged', peer);

    var connectionType = ThaliMobileNativeWrapper.connectionTypes.TCP_NATIVE;

    ThaliMobile.getPeerHostInfo(peer.peerIdentifier, connectionType)
    .then(function (peerHostInfo) {
      checkPeerHostInfoProperties(t, peerHostInfo, peer);
      t.equal(peerHostInfo.hostAddress, peer.hostAddress,
        'the same hostAddress');
      t.equal(peerHostInfo.portNumber, peer.portNumber, 'the same portNumber');
      t.end();
    }).catch(t.end);
  }
);

test('network changes emitted correctly',
  function () {
    return global.NETWORK_TYPE !== ThaliMobile.networkTypes.WIFI;
  },
  function (t) {
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

test('network changes not emitted in stopped state',
  function (t) {
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

test('calls correct starts when network changes',
  function () {
    // works only in wifi mode because it fires non-tcp network changes
    return global.NETWORK_TYPE !== ThaliMobile.networkTypes.WIFI;
  },
  function (t) {
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
  }
);

test('We properly fire peer unavailable and then available when ' +
'connection fails', function(t) {

  // Scenario:
  // 1. We got peerAvailabilityChanged event (peerAvailable: true).
  // 2. We are trying to connect to this peer.
  // 3. Connection fails for some reason (it happens with Bluetooth)
  //
  // Expected result:
  // 1. thaliMobile gets peerAvailabilityChanged event for the same peer and
  //    peerAvailable set to false
  // 2. After peer listener is recreated in mux layer we are getting new
  //    peerAvailabilityChanged event with peerAvailable set to true
  //
  // To emulate failing non-TCP connection we fire artificial
  // peerAvailabilityChanged event with some unknown peer id.

  var somePeerIdentifier = uuid.v4();

  var callCounter = 0;
  var connectionErrorReceived = false;

  var failedConnectionHandler = function (peer) {
    t.equal(peer.peerIdentifier, somePeerIdentifier, 'Failed on right peer');
    t.equal(peer.recreated, true, 'Marked as recreated');
    connectionErrorReceived = true;
  };

  var peerAvailabilityChangedHandler = function (peer) {
    ++callCounter;
    switch(callCounter) {
      case 1: {
        t.equal(peer.peerIdentifier, somePeerIdentifier, 'peerIds match');
        t.equal(peer.peerAvailable, true, 'peer is available');
        t.equal(peer.newAddressPort, false, 'newAddressPort is false');
        ThaliMobile.getPeerHostInfo(peer.peerIdentifier, peer.connectionType)
        .then(function (peerHostInfo) {
          var socket = net.connect({
            port: peerHostInfo.portNumber,
            host: peerHostInfo.hostAddress
          });
          socket.on('connect', function () {
            t.ok(true, 'We should have connected');
            // We are connected to the peer listener
            // At this point mux layer is going to call Mobile('connect') and
            // fail
          });
        });
        return;
      }
      case 2: {
        t.equal(peer.peerIdentifier, somePeerIdentifier, 'still same peer IDs');
        t.equal(peer.peerAvailable, false, 'peer should not be available');
        return;
      }
      case 3: {
        t.equal(peer.peerIdentifier, somePeerIdentifier, 'peerIds match again');
        t.equal(peer.peerAvailable, true, 'peer is available again');
        t.equal(peer.newAddressPort, false, 'newAddressPort is false');
        t.ok(connectionErrorReceived, 'We got the error we expected');
        return cleanUp();
      }
    }
  };

  var cleanUpCalled = false;
  function cleanUp() {
    if (cleanUpCalled) {
      return;
    }
    cleanUpCalled = true;
    ThaliMobileNativeWrapper.emitter.removeListener('failedNativeConnection',
      failedConnectionHandler);
    ThaliMobileNativeWrapper.emitter.removeListener(
      'peerAvailabilityChanged', peerAvailabilityChangedHandler);
    t.end();
  }

  ThaliMobileNativeWrapper.emitter.on('failedNativeConnection',
    failedConnectionHandler);

  ThaliMobile.emitter.on('peerAvailabilityChanged',
    peerAvailabilityChangedHandler);

  ThaliMobile.start(express.Router(), new Buffer('foo'),
    ThaliMobile.networkTypes.NATIVE)
    .then(function () {
      return ThaliMobile.startListeningForAdvertisements();
    })
    .then(function () {
      return ThaliMobileNativeWrapper._handlePeerAvailabilityChanged({
        peerIdentifier: somePeerIdentifier,
        generation: 0,
        peerAvailable: true
      });
    })
    .catch(function (err) {
      t.fail(err);
      return cleanUp();
    });
});

test('If a peer is not available (and hence is not in the thaliMobile cache)' +
  ' but we already started trying to connect make sure recreate does not ' +
  'happen',
  function () {
    return !platform.isAndroid ||
      global.NETWORK_TYPE !== ThaliMobile.networkTypes.NATIVE;
  },
  function (t) {
    var somePeerIdentifier = uuid.v4();

    var peerAvailabilityChangedHandler = function (peer) {
      t.fail('We should not have gotten a peer ' + JSON.stringify(peer));
      return cleanUp();
    };

    var connectionErrorReceived = false;
    var failedConnectionHandler = function (peer) {
      t.equal(peer.peerIdentifier, somePeerIdentifier, 'Failed on right peer');
      connectionErrorReceived = true;
    };

    var cleanUpCalled = false;
    function cleanUp() {
      if (cleanUpCalled) {
        return;
      }
      cleanUpCalled = true;
      ThaliMobile.emitter.removeListener('peerAvailabilityChanged',
        peerAvailabilityChangedHandler);
      ThaliMobileNativeWrapper.emitter.removeListener('failedNativeConnection',
        failedConnectionHandler);
      t.end();
    }

    ThaliMobile.emitter.on('peerAvailabilityChanged',
      peerAvailabilityChangedHandler);

    ThaliMobileNativeWrapper.emitter.on('failedNativeConnection',
      failedConnectionHandler);

    var originalListener = ThaliMobileNativeWrapper.terminateListener;
    ThaliMobileNativeWrapper.terminateListener = function(peerIdentifier) {
      t.equal(peerIdentifier, somePeerIdentifier, 'Peer still matches');
      t.ok(connectionErrorReceived, 'We got the connection error');
      ThaliMobileNativeWrapper.terminateListener = originalListener;
      cleanUp();
      return Promise.resolve();
    };

    ThaliMobile.start(
      express.Router(),
      new Buffer('foo'),
      ThaliMobile.networkTypes.NATIVE
    )
    .then(function () {
      return ThaliMobile.startListeningForAdvertisements();
    })
    .then(function () {
      // This creates a listener for our bogus peer but without ever firing
      // a nonTCPPeerAvailabilityChanged event that would put this peer into
      // thaliMobile's cache.
      return ThaliMobileNativeWrapper._getServersManager().
        createPeerListener(somePeerIdentifier, false);
    })
    .then(function (port) {
      var socket = net.createConnection(port, '127.0.0.1');
      socket.on('connect', function () {
        t.ok(true, 'We should have connected');
      });
    })
    .catch(function (err) {
      t.fail(err);
      ThaliMobileNativeWrapper.terminateListener = originalListener;
      cleanUp();
    });
  }
);


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
function () {
  return global.NETWORK_TYPE !== ThaliMobile.networkTypes.WIFI;
},
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
  setupDiscoveryAndFindPeers(t, express.Router(), function (peerStatus, done) {
    if (peerFound) {
      return;
    }
    peerFound = true;
    t.equal(peerStatus.peerAvailable, true, 'peer is available');

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

var participantState = {
  running: 'running',
  notRunning: 'notRunning',
  finished: 'finished'
};

test('can get data from all participants',
  function () {
    return global.NETWORK_TYPE === ThaliMobile.networkTypes.WIFI;
  },
  function (t) {
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
      remainingParticipants[participant.uuid] = participantState.notRunning;
    });
    setupDiscoveryAndFindPeers(t, router, function (peer, done) {
      // Try to get data only from non-TCP peers so that the test
      // works the same way on desktop on CI where Wifi is blocked
      // between peers.
      if (peer.connectionType ===
          ThaliMobileNativeWrapper.connectionTypes.TCP_NATIVE) {
        return;
      }
      ThaliMobile.getPeerHostInfo(peer.peerIdentifier, peer.connectionType)
      .then(function (peerHostInfo) {
        return testUtils.get(
          peerHostInfo.hostAddress, peerHostInfo.portNumber,
          uuidPath, pskIdentity, pskKey
        );
      })
      .then(function (responseBody) {
      if (remainingParticipants[responseBody] !== participantState.notRunning) {
        return Promise.resolve(true);
      }
      remainingParticipants[responseBody] = participantState.finished;
      var areWeDone = Object.getOwnPropertyNames(remainingParticipants)
        .every(
          function (participant) {
            return remainingParticipants[participant] ===
              participantState.finished;
          });
      if (areWeDone) {
          t.ok(true, 'received all uuids');
          done();
        }
      })
      .catch(function (error) {
        t.fail(error);
        done();
      });
    });
  }
);

// Taken from https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random
// This is not cryptographically secure and for our purposes it doesn't matter
function getRandomInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min)) + min;
}

function twoSerialRequests(t, hostAddress, portNumber, echoPath, pskIdentity,
                       pskKey) {
  var randomMessageLength = getRandomInt(4000, 10000);
  var randomString = randomstring.generate(randomMessageLength);
  return testUtils.put(hostAddress, portNumber, echoPath,
    pskIdentity, pskKey, randomString)
    .then(function (responseBody) {
      t.equal(responseBody, randomString, 'Strings must match');
      randomMessageLength = getRandomInt(4000, 10000);
      randomString = randomstring.generate(randomMessageLength);
      return testUtils.put(hostAddress, portNumber, echoPath, pskIdentity,
        pskKey, randomString);
    })
    .then(function (responseBody) {
      t.equal(responseBody, randomString, 'Second strings must match');
      return null;
    });
}

function numberOfParallelRequests(t, hostAddress, portNumber, echoPath,
  pskIdentity, pskKey) {
  var numberOfConnections = getRandomInt(2, 10);
  logger.debug('Number of connections for hostAddress ' + hostAddress +
    ', portNumber ' + portNumber + ', is ' + numberOfConnections);
  var promises = [];
  for(var i = 0; i < numberOfConnections; ++i) {
    promises.push(twoSerialRequests(t, hostAddress, portNumber, echoPath,
      pskIdentity, pskKey));
  }
  return Promise.all(promises);
}

var uuidPath = '/uuid';
var echoPath = '/echo';

function setUpRouter() {
  var router = express.Router();
  // Register a handler that returns the UUID of this
  // test instance to an HTTP GET request.
  router.get(uuidPath, function (req, res) {
    res.send(tape.uuid);

    res.on('error', function (err) {
      logger.error('Received error on sending GET response ' + err);
    });

    res.on('close', function() {
      logger.error('GET request connection was closed');
    });
  });

  router.put(echoPath, function (req, res) {
    logger.debug('Got a put request');
    var requestBody = [];
    req.on('data', function (chunk) {
      requestBody.push(chunk);
    });
    req.on('end', function () {
      var body = Buffer.concat(requestBody).toString();
      res.end(body);
    });
    req.on('error', function (err) {
      logger.error('Received error on incoming server request, PUT - ' + err);
    });

    res.on('close', function () {
      logger.error('TCP/IP connection for server was terminated before we ' +
        'could send a response');
    });
    res.on('finish', function () {
      logger.debug('Completed sending response to OS');
    });
  });

  return router;
}

test('test for data corruption', function () {
  // We don't have platform properly set up on desktop to emulate Android or
  // iOS. Those fixes are in the iOS branch. So until they make it to master
  // we just check for Wifi. If it is wifi then we don't run. If it isn't wifi
  // then we must be Android because iOS native doesn't work in master.
  //
  // FIXME: temporarily disabled (iOS branch is not complete)
  return true || global.NETWORK_TYPE === ThaliMobile.networkTypes.WIFI;
},
function (t) {
  var router = setUpRouter();
  var participantsState = {};
  var peerIDToUUIDMap = {};
  var areWeDone = false;
  var promiseQueue = new PromiseQueue();
  t.participants.forEach(function (participant) {
    if (participant.uuid === tape.uuid) {
      return;
    }
    participantsState[participant.uuid] = participantState.notRunning;
  });
  setupDiscoveryAndFindPeers(t, router, function (peer, done) {
    // Try to get data only from non-TCP peers so that the test
    // works the same way on desktop on CI where Wifi is blocked
    // between peers.
    if (peer.connectionType ===
      ThaliMobileNativeWrapper.connectionTypes.TCP_NATIVE) {
      return;
    }
    if (peerIDToUUIDMap[peer.peerIdentifier] &&
        participantsState[peerIDToUUIDMap[peer.peerIdentifier] ===
          participantState.finished]) {
      return;
    }
    promiseQueue.enqueue(function (resolve) {
      if (areWeDone) {
        return resolve(null);
      }

      logger.debug('Found peer - ' + JSON.stringify(peer));

      var uuid = null;
      testUtils.get(
        peer.hostAddress, peer.portNumber,
        uuidPath, pskIdentity, pskKey
      )
      .then(function (responseBody) {
        uuid = responseBody;
        peerIDToUUIDMap[peer.peerIdentifier] = uuid;
        logger.debug('Got uuid back from GET - ' + uuid);
        if (participantsState[uuid] !== participantState.notRunning) {
          logger.debug('Participant is already done - ' + uuid);
          return false;
        } else {
          logger.debug('Participants state is ' + participantsState[uuid]);
        }

        participantsState[uuid] = participantState.running;

        return numberOfParallelRequests(t, peer.hostAddress, peer.portNumber,
          echoPath, pskIdentity, pskKey)
        .then(function () {
          logger.debug('Got back from parallel requests - ' + uuid);
          participantsState[uuid] = participantState.finished;
          areWeDone = Object.getOwnPropertyNames(participantsState)
            .every(
              function (participant) {
                return participantsState[participant] ===
                  participantState.finished;
              });
          if (areWeDone) {
            t.ok(true, 'received all uuids');
            done();
          }
          return false;
        });
      })
      .catch(function (error) {
        logger.debug('Got an error on HTTP requests: ' + error);
        return true;
      })
      .then(function (isError) {
        if (areWeDone) {
          return resolve(null);
        }
        ThaliMobileNativeWrapper._getServersManager()
          .terminateOutgoingConnection(peer.peerIdentifier, peer.portNumber);
        // We have to give Android enough time to notice the killed connection
        // and recycle everything
        setTimeout(function () {
          if (isError) {
            participantsState[uuid] = participantState.notRunning;
          }
          return resolve(null);
        }, 1000);
      });
    });
  });
});
