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
var uuid = require('uuid');
var nodessdp = require('node-ssdp');
var objectAssign = require('object-assign');
var randomstring = require('randomstring');
var logger = require('thali/ThaliLogger')('testThaliMobile');
var Promise = require('bluebird');
var PromiseQueue = require('thali/NextGeneration/promiseQueue');
var platform = require('thali/NextGeneration/utils/platform');
var net = require('net');

var radioState = ThaliMobileNative.radioState;
var connectionTypes = ThaliMobileNativeWrapper.connectionTypes;
var verifyCombinedResultSuccess = testUtils.verifyCombinedResultSuccess;

var test = tape({
  setup: function (t) {
    t.notOk(ThaliMobile.isStarted(), 'ThaliMobile should be stopped');
    t.end();
  },
  teardown: function (t) {
    ThaliMobile.stop()
    .then(function (combinedResult) {
      verifyCombinedResultSuccess(t, combinedResult);
      t.end();
    });
  },

  // These time outs are excessive because of issues we are having
  // with Bluetooth, see #1569. When #1569 is fixed we will be able
  // to reduce these time outs to a reasonable level.
  testTimeout:      5 * 60 * 1000,
  teardownTimeout:  5 * 60 * 1000
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

test('#start subscribes to the WiFi infrastructure events and #stop ' +
'unsubscribes from them (in WiFi-only mode)',
  function () {
    // TODO: requires #1453
    //
    // this test is for WIFI mode but for #1453 we also need similar tests for
    // NATIVE and for BOTH modes
    return true;
  },
  tape.sinonTest(function (t) {
    var wifiEmitter = ThaliMobile._getThaliWifiInfrastructure();
    var nativeEmitter = ThaliMobileNativeWrapper.emitter;

    var wifiOnSpy = this.spy(wifiEmitter, 'on');
    var nativeOnSpy = this.spy(nativeEmitter, 'on');
    var wifiOffSpy = this.spy(wifiEmitter, 'removeListener');
    var nativeOffSpy = this.spy(nativeEmitter, 'removeListener');

    function resetSpies() {
      wifiOnSpy.reset();
      nativeOnSpy.reset();
      wifiOffSpy.reset();
      nativeOffSpy.reset();
    }

    var expectedWifiEventNames = [
      'wifiPeerAvailabilityChanged',
      'discoveryAdvertisingStateUpdateWifiEvent',
      'networkChangedWifi',
    ].sort();

    var router = express.Router();

    ThaliMobile.start(router, null, ThaliMobile.networkTypes.WIFI)
    .then(function () {
      var wifiEventNames = wifiOnSpy.args.map(function (callArgs) {
        return callArgs[0];
      }).sort();
      t.deepEqual(wifiEventNames, expectedWifiEventNames,
        'listen to the correct wifi events');
      t.equals(nativeOnSpy.called, false,
        'does not listen to the native events');
      resetSpies();
      return ThaliMobile.stop();
    })
    .then(function () {
      var wifiEventNames = wifiOffSpy.args.map(function (callArgs) {
        return callArgs[0];
      }).sort();
      t.deepEqual(wifiEventNames, expectedWifiEventNames,
        'should remove wifi listeners');
    })
    .catch(t.fail)
    .then(function () {
      t.end();
    });
  })
);

test('does not emit duplicate discoveryAdvertisingStateUpdate',
  function () {
    // test is not for native transport because it fires artificial events from
    // the native layer
    return global.NETWORK_TYPE !== ThaliMobile.networkTypes.WIFI;
  },
  tape.sinonTest(function (t) {
    var spy = this.spy();
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
  })
);

test('does not send duplicate availability changes', tape.sinonTest(function (t) {
  var nativePeer = generateLowerLevelPeers().nativePeer;
  var spy = this.spy(ThaliMobile.emitter, 'emit');
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
}));

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

  
test('peerAvailabilityChanged - peer added/removed to/from cache (native)',
  function (t) {
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

    function end() {
      ThaliMobile.emitter
        .removeListener('peerAvailabilityChanged', availabilityHandler);
      t.end();
    }

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

    function end() {
      ThaliMobile.emitter
        .removeListener('peerAvailabilityChanged', availabilityHandler);
      t.end();
    }

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

    function end() {
      ThaliMobile.emitter
        .removeListener('peerAvailabilityChanged', availabilityHandler);
      t.end();
    }

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

    function end() {
      ThaliMobile.emitter
        .removeListener('peerAvailabilityChanged', availabilityHandler);
      t.end();
    }

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

      switch (callCount) {
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

    function end() {
      ThaliMobile.emitter
        .removeListener('peerAvailabilityChanged', availabilityHandler);
      t.end();
    }

    nativePeer.generation = 2;
    emitNativePeerAvailability(nativePeer);
  }
);

test('native available - peer with the same port and generation but with ' +
'enough time for generation to wrap around is cached (BLUETOOTH)',
  function () {
    return !platform.isAndroid;
  },
  tape.sinonTest(function (t) {
    var nativePeer = generateLowerLevelPeers().nativePeer;
    var callCount = 0;

    // make update window shorter because nobody wants to wait 51 seconds for
    // test to complete
    this.stub(thaliConfig, 'UPDATE_WINDOWS_FOREGROUND_MS', 0.1);
    t.timeoutAfter(thaliConfig.UPDATE_WINDOWS_FOREGROUND_MS * 1000);

    var availabilityHandler = function (peerStatus) {
      if (peerStatus.peerIdentifier !== nativePeer.peerIdentifier) {
        return;
      }
      callCount++;

      switch (callCount) {
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

    function end() {
      ThaliMobile.emitter
        .removeListener('peerAvailabilityChanged', availabilityHandler);
      t.end();
    }

    nativePeer.generation = 2;
    emitNativePeerAvailability(nativePeer);
  })
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

      switch (callCount) {
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

    function end() {
      ThaliMobile.emitter
        .removeListener('peerAvailabilityChanged', availabilityHandler);
      t.end();
    }

    nativePeer.generation = 2;
    emitNativePeerAvailability(nativePeer);
  }
);

test('native available - peer with same or older generation is ignored (MPCF)',
  testUtils.skipOnAndroid,
  function (t) {
    var nativePeer = generateLowerLevelPeers().nativePeer;
    var nativePeer1 = objectAssign({}, nativePeer, { generation: 1 });
    var nativePeer2 = objectAssign({}, nativePeer, { generation: 2 });
    var nativePeer3 = objectAssign({}, nativePeer, { generation: 3 });

    var callCount = 0;
    var availabilityHandler = function (peerStatus) {
      callCount++;
      switch (callCount) {
        case 1: {
          t.equal(peerStatus.peerIdentifier, nativePeer.peerIdentifier,
            'discovered correct peer');
          t.equal(peerStatus.generation, 2, 'got correct generation');

          emitNativePeerAvailability(nativePeer1);
          setImmediate(function () {
            emitNativePeerAvailability(nativePeer3);
          });
          return;
        }
        case 2: {
          // peer with generation 1 should be ignored
          t.equal(peerStatus.peerIdentifier, nativePeer.peerIdentifier,
            'discovered correct peer');
          t.equal(peerStatus.generation, 3, 'got correct generation');

          setImmediate(end);
          return;
        }
        default: {
          t.fail('should not be called more than twice');
          return;
        }
      }
    };

    ThaliMobile.emitter.on('peerAvailabilityChanged', availabilityHandler);

    function end() {
      ThaliMobile.emitter
        .removeListener('peerAvailabilityChanged', availabilityHandler);
      t.end();
    }

    ThaliMobile.start(express.Router()).then(function () {
      emitNativePeerAvailability(nativePeer2);
    });
  }
);

test('native unavailable - new peer is ignored',
  function (t) {
    var nativePeer1 = generateLowerLevelPeers().nativePeer;
    var nativePeer2 = generateLowerLevelPeers().nativePeer;

    nativePeer1.peerAvailable = false;
    nativePeer2.peerAvailable = true;

    // handler should be called only once with the second peer info
    var availabilityHandler = function (peerStatus) {
      t.equal(peerStatus.peerIdentifier, nativePeer2.peerIdentifier,
        'discovered available peer');
      t.equal(peerStatus.peerAvailable, true, 'peer is available');
      ThaliMobile.emitter
        .removeListener('peerAvailabilityChanged', availabilityHandler);
      t.end();
    };

    ThaliMobile.emitter.on('peerAvailabilityChanged', availabilityHandler);

    ThaliMobile.start(express.Router()).then(function () {
      emitNativePeerAvailability(nativePeer1);
      setImmediate(function () {
        emitNativePeerAvailability(nativePeer2);
      });
    });
  }
);

test('native unavailable - cached peer is removed',
  function (t) {
    var nativePeer = generateLowerLevelPeers().nativePeer;
    var callCount = 0;

    var availabilityHandler = function (peerStatus) {
      if (peerStatus.peerIdentifier !== nativePeer.peerIdentifier) {
        return;
      }
      callCount++;

      switch (callCount) {
        case 1:
          t.equal(peerStatus.peerAvailable, true, 'peer should be available');

          nativePeer.peerAvailable = false;
          emitNativePeerAvailability(nativePeer);
          break;
        case 2:
          t.equal(peerStatus.peerAvailable, false,
            'peer should be unavailable');
          var cache = ThaliMobile._getPeerAvailabilities();
          var cachedPeer =
            cache[getNativeConnectionType()][peerStatus.peerIdentifier];
          t.equal(cachedPeer, undefined, 'should be removed from cache');
          setImmediate(end);
          break;
        default:
          t.fail('should not be called again');
          break;
      }
    };

    ThaliMobile.emitter.on('peerAvailabilityChanged', availabilityHandler);

    function end() {
      ThaliMobile.emitter
        .removeListener('peerAvailabilityChanged', availabilityHandler);
      t.end();
    }

    emitNativePeerAvailability(nativePeer);
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

    function enableWifi() {
      ThaliMobileNativeWrapper.emitter.emit('networkChangedNonTCP', {
        wifi: radioState.ON,
        bssidName: '00:00:00:00:00:00',
        bluetoothLowEnergy: radioState.ON,
        bluetooth: radioState.ON,
        cellular: radioState.ON
      });
    }

    function disconnectWifi() {
      ThaliMobileNativeWrapper.emitter.emit('networkChangedNonTCP', {
        wifi: radioState.ON,
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
          enableWifi();
          emitWifiPeerAvailability(testPeers.wifiPeer);
          break;
        case 4:
          t.equals(peerStatus.peerAvailable, true, 'we found peer again');
          t.equals(peerStatus.peerIdentifier, testPeers.wifiPeer.peerIdentifier,
            'it was wifi peer');
          disconnectWifi();
          break;
        case 5:
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

    function end() {
      ThaliMobile.emitter
        .removeListener('peerAvailabilityChanged', availabilityHandler);
      t.end();
    }

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
        ssidName: 'WiFi Network SSID',
        bssidName: '00:00:00:00:00:00',
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

    function end() {
      ThaliMobile.emitter
        .removeListener('peerAvailabilityChanged', availabilityHandler);
      t.end();
    }

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

    function end() {
      ThaliMobile.emitter
        .removeListener('peerAvailabilityChanged', availabilityHandler);
      t.end();
    }

    // Add initial peers
    emitNativePeerAvailability(testPeers.nativePeer);
  }
);

test('multiconnect failure - new peer is ignored (MPCF)',
  function () {
    // This test does not make sense because thaliMobile does not listen to the
    // failedNativeConnection event. ThaliMobileNativeWrapper handles connection
    // failures by emitting "fake" peerAvailabilityChanged events to trigger
    // retry in the higher layers.
    //
    // See https://github.com/thaliproject/Thali_CordovaPlugin/issues/1527#issuecomment-261677036
    // for more details. We currently use the logic described in the "What we
    // shouldn't do" section.

    // return !platform.isIOS;
    return true;
  },
  tape.sinonTest(function (t) {
    var nativePeer = generateLowerLevelPeers().nativePeer;

    var failedPeer = {
      peerIdentifier: nativePeer.peerIdentifier,
      connectionType: getNativeConnectionType()
    };

    var availabilityHandler = this.spy();

    function end() {
      var cache = ThaliMobile._getPeerAvailabilities();
      var cachedPeer =
        cache[getNativeConnectionType()][failedPeer.peerIdentifier];

      t.equal(cachedPeer, undefined, 'should not be in the cache');
      t.equal(availabilityHandler.callCount, 0, 'should not be called');
      ThaliMobile.emitter
        .removeListener('peerAvailabilityChanged', availabilityHandler);
      t.end();
    }

    ThaliMobile.emitter.on('peerAvailabilityChanged', availabilityHandler);

    ThaliMobileNativeWrapper.emitter.emit('failedNativeConnection', failedPeer);

    end();
  })
);

test('multiconnect failure - cached peer fires peerAvailabilityChanged (MPCF)',
  function () {
    return platform._isRealMobile ||
           global.NETWORK_TYPE === ThaliMobile.networkTypes.WIFI ||
           platform.isAndroid;
  },
  function (t) {
    var nativePeer = generateLowerLevelPeers().nativePeer;
    var callCounter = 0;
    var errorMessage = 'Connection could not be established';

    var availabilityHandler = function (peer) {
      ++callCounter;

      switch (callCounter) {
        case 1: {
          var cache = ThaliMobile._getPeerAvailabilities();
          var cachedPeer =
            cache[getNativeConnectionType()][peer.peerIdentifier];

          t.equal(cachedPeer.peerIdentifier, nativePeer.peerIdentifier,
            'should be in the cache');
          Mobile.fireMultiConnectConnectionFailure({
            peerIdentifier: peer.peerIdentifier,
            error: errorMessage
          });
          return;
        }
        case 2: {
          t.equal(peer.peerIdentifier, nativePeer.peerIdentifier,
              'peerIds match');
          t.equal(peer.peerAvailable, false, 'peer is unavailable');
          return;
        }
        case 3: {
          t.equal(peer.peerIdentifier, nativePeer.peerIdentifier,
            'peerIds match');
          t.equal(peer.peerAvailable, true, 'peer should be available');
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
      ThaliMobile.emitter.removeListener(
        'peerAvailabilityChanged', availabilityHandler);
      t.end();
    }

    ThaliMobile.emitter.on('peerAvailabilityChanged', availabilityHandler);

    ThaliMobile.start(express.Router()).then(function () {
      emitNativePeerAvailability(nativePeer);
    });
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

    switch (callCount) {
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
  function end() {
    ThaliMobile.emitter
      .removeListener('peerAvailabilityChanged', availabilityHandler);
    t.end();
  }

  emitWifiPeerAvailability(wifiPeer);
});

test('newAddressPort field (BLUETOOTH)',
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

      switch (callCount) {
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
    function end() {
      ThaliMobile.emitter
        .removeListener('peerAvailabilityChanged', availabilityHandler);
      t.end();
    }

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
  var connectionType = connectionTypes.TCP_NATIVE;
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

function validatePeerHostInfo (t, peerHostInfo) {
  var expectedKeys = ['hostAddress', 'portNumber', 'suggestedTCPTimeout'];
  var actualKeys = Object.keys(peerHostInfo);
  expectedKeys.sort();
  actualKeys.sort();
  t.deepEqual(actualKeys, expectedKeys, 'contains expected properties');
}

test('#getPeerHostInfo - returns discovered cached native peer (BLUETOOTH)',
  function () {
    return !platform.isAndroid;
  },
  function (t) {
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

    var connectionType = connectionTypes.BLUETOOTH;

    ThaliMobile.getPeerHostInfo(peer.peerIdentifier, connectionType)
    .then(function (peerHostInfo) {
      validatePeerHostInfo(t, peerHostInfo);
      t.equal(peerHostInfo.hostAddress, '127.0.0.1', 'the same hostAddress');
      t.equal(peerHostInfo.portNumber, peer.portNumber, 'the same portNumber');
      t.end();
    }).catch(t.end);
  }
);

test('#getPeerHostInfo - returns discovered cached native peer and calls ' +
'`_multiConnect` to retrieve the port (MPCF)',
  function () {
    return !platform.isIOS;
  },
  tape.sinonTest(function (t) {
    var peer = {
      peerIdentifier: 'foo',
      peerAvailable: true,
      generation: 0,
      portNumber: null
    };
    var resolvedPortNumber = 12345;

    var multiConnectStub = this.stub(
      ThaliMobileNativeWrapper,
      '_multiConnect',
      function (peerId) {
        if (peerId !== peer.peerIdentifier) {
          return Promise.reject(new Error('Connection could not be established'));
        }
        return Promise.resolve(resolvedPortNumber);
      }
    );

    ThaliMobileNativeWrapper.emitter.emit(
      'nonTCPPeerAvailabilityChangedEvent',
      peer
    );

    var connectionType = connectionTypes.MULTI_PEER_CONNECTIVITY_FRAMEWORK;

    ThaliMobile.getPeerHostInfo(peer.peerIdentifier, connectionType)
    .then(function (peerHostInfo) {
      validatePeerHostInfo(t, peerHostInfo);
      t.equal(peerHostInfo.hostAddress, '127.0.0.1', 'the same hostAddress');
      t.equal(peerHostInfo.portNumber, resolvedPortNumber, 'the same portNumber');
    })
    .catch(t.fail)
    .then(function () {
      t.end();
    });
  })
);

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

    var connectionType = connectionTypes.TCP_NATIVE;

    ThaliMobile.getPeerHostInfo(peer.peerIdentifier, connectionType)
    .then(function (peerHostInfo) {
      validatePeerHostInfo(t, peerHostInfo);
      t.equal(peerHostInfo.hostAddress, peer.hostAddress,
        'the same hostAddress');
      t.equal(peerHostInfo.portNumber, peer.portNumber, 'the same portNumber');
      t.end();
    }).catch(t.end);
  }
);

test('#disconnect fails on wifi peers', function (t) {
  var wifiPeer = generateLowerLevelPeers().wifiPeer;

  var availabilityHandler = function (peerStatus) {
    if (peerStatus.peerIdentifier !== wifiPeer.peerIdentifier) {
      return;
    }
    ThaliMobile.emitter
      .removeListener('peerAvailabilityChanged', availabilityHandler);

    ThaliMobile
      .disconnect(wifiPeer.peerIdentifier, peerStatus.connectionType)
      .then(function () {
        t.fail('disconnect should not be successful');
      })
      .catch(function (error) {
        t.equal(error.message, 'Wifi does not support disconnect',
          'Got specific error message');
        return null;
      })
      .then(t.end);
  };

  ThaliMobile.emitter.on('peerAvailabilityChanged', availabilityHandler);

  ThaliMobile.start(express.Router()).then(function () {
    emitWifiPeerAvailability(wifiPeer);
  });
});

test('#disconnect delegates native peers to the native wrapper',
  function () {
    return global.NETWORK_TYPE === ThaliMobile.networkTypes.WIFI;
  },
  tape.sinonTest(function (t) {
    var nativePeer = generateLowerLevelPeers().nativePeer;
    var nativeDisconnectSpy =
        this.spy(ThaliMobileNativeWrapper, 'disconnect');

    var availabilityHandler = function (peerStatus) {
      if (peerStatus.peerIdentifier !== nativePeer.peerIdentifier) {
        return;
      }
      ThaliMobile.emitter
        .removeListener('peerAvailabilityChanged', availabilityHandler);

      ThaliMobile
        .disconnect(
          nativePeer.peerIdentifier,
          peerStatus.connectionType,
          nativePeer.portNumber
        )
        .catch(function () {
          t.fail('should not fail');
        })
        .then(function () {
          t.ok(nativeDisconnectSpy.calledOnce,
            'native wrapper `disconnect` called once');
          t.ok(nativeDisconnectSpy.calledWithExactly(
            nativePeer.peerIdentifier,
            nativePeer.portNumber
          ), 'native wrapper `disconnect` called with peer data');
        })
        .then(function () {
          t.end();
        });
    };

    ThaliMobile.emitter.on('peerAvailabilityChanged', availabilityHandler);

    ThaliMobile.start(express.Router()).then(function () {
      emitNativePeerAvailability(nativePeer);
    });
  })
);

test('network changes emitted correctly',
  function () {
    return (
      // iOS does not support toggleWifi
      platform.isIOS ||
      global.NETWORK_TYPE !== ThaliMobile.networkTypes.WIFI ||
      global.NETWORK_TYPE      !== ThaliMobile.networkTypes.BOTH
    );
  },
  function (t) {
    testUtils.ensureWifi(true)
      .then(function () {
        return ThaliMobile.start(express.Router());
      })
      .then(function () {
        return new Promise(function (resolve) {
          function networkChangedHandler (networkStatus) {
            // TODO Android can send event with 'wifi': 'off' and without
            // 'bssidName' and 'ssidName'.
            // t.equals(networkStatus.wifi, 'off', 'wifi should be off');
            t.ok(networkStatus.bssidName == null, 'bssid should be null');
            t.ok(networkStatus.ssidName  == null, 'ssid should be null');
            resolve();
          }
          ThaliMobile.emitter.once('networkChanged', networkChangedHandler);
          testUtils.toggleWifi(false);
        });
      })
      .then(function () {
        var networkChangedHandler;
        return new Promise(function (resolve) {
          networkChangedHandler = function (networkStatus) {
            t.equals(networkStatus.wifi, 'on', 'wifi should be on');

            if (networkStatus.bssidName && networkStatus.ssidName) {
              t.ok(
                testUtils.validateBSSID(networkStatus.bssidName),
                'bssid should be valid'
              );
              t.ok(
                networkStatus.ssidName && networkStatus.ssidName.length > 0,
                'ssid should exist'
              );
              resolve();
            } else {
              // Phone is still trying to connect to wifi.
              // We are waiting for 'ssidName' and 'bssidName'.
            }
          };
          ThaliMobile.emitter.on('networkChanged', networkChangedHandler);
          testUtils.toggleWifi(true);
        })
          .finally(function () {
            ThaliMobile.emitter.removeListener('networkChanged', networkChangedHandler);
          });
      })
      .then(function () {
        return testUtils.ensureWifi(true);
      })
      .then(function () {
        t.end();
      });
  });

function noNetworkChanged (t, toggle) {
  return new Promise(function (resolve) {
    var isEmitted = false;
    function networkChangedHandler () {
      isEmitted = true;
    }
    ThaliMobile.emitter.once('networkChanged', networkChangedHandler);

    toggle()
      .then(function () {
        setImmediate(function () {
          t.notOk(isEmitted, 'event should not be emitted');
          ThaliMobile.emitter.removeListener('networkChanged',
            networkChangedHandler);
          resolve();
        });
      });
  });
}

test('network changes not emitted in started state',
  function () {
    return (
      // iOS does not support toggleWifi
      platform.isIOS ||
      global.NETWORK_TYPE !== ThaliMobile.networkTypes.WIFI ||
      global.NETWORK_TYPE      !== ThaliMobile.networkTypes.BOTH
    );
  },
  function (t) {
    testUtils.ensureWifi(true)
      .then(function () {
        return noNetworkChanged(t, function () {
          return testUtils.toggleWifi(true);
        });
      })
      .then(function () {
        t.end();
      });
  });

test('network changes not emitted in stopped state',
  function () {
    return (
      // iOS does not support toggleWifi
      platform.isIOS ||
      global.NETWORK_TYPE !== ThaliMobile.networkTypes.WIFI ||
      global.NETWORK_TYPE      !== ThaliMobile.networkTypes.BOTH
    );
  },
  function (t) {
    testUtils.ensureWifi(false)
      .then(function () {
        return noNetworkChanged(t, function () {
          return testUtils.toggleWifi(false);
        });
      })
      .then(function () {
        return testUtils.ensureWifi(true);
      })
      .then(function () {
        t.end();
      });
  });

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

test('We properly fire peer unavailable and then available when ' +
'connection fails on Android',
function () {
  return !(platform.isAndroid &&
    global.NETWORK_TYPE === ThaliMobile.networkTypes.NATIVE);
},
function(t) {

  var somePeerIdentifier = uuid.v4();

  var socket;
  var callCounter = 0;
  var connectionErrorReceived = false;

  var failedConnectionHandler = function (peer) {
    t.equal(peer.peerIdentifier, somePeerIdentifier, 'Failed on right peer');
    t.equal(peer.recreated, true, 'Marked as recreated');
    connectionErrorReceived = true;
  };

  var peerAvailabilityChangedHandler = function (peer) {
    ++callCounter;
    switch (callCounter) {
      case 1: {
        t.equal(peer.peerIdentifier, somePeerIdentifier, 'peerIds match');
        t.equal(peer.peerAvailable, true, 'peer is available');
        ThaliMobile.getPeerHostInfo(peer.peerIdentifier, peer.connectionType)
        .then(function (peerHostInfo) {
          socket = net.connect({
            port: peerHostInfo.portNumber,
            host: peerHostInfo.hostAddress
          });
          socket.once('connect', function () {
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
    if (socket) {
      socket.destroy();
    }
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

test('We properly fire peer unavailable and then available when ' +
'connection fails on iOS',
function () {
  return !(platform.isIOS &&
    global.NETWORK_TYPE === ThaliMobile.networkTypes.NATIVE);
},
function(t) {

  var somePeerIdentifier = uuid.v4();
  var callCounter = 0;

  var peerAvailabilityChangedHandler = function (peer) {
    ++callCounter;
    switch (callCounter) {
      case 1: {
        t.equal(peer.peerIdentifier, somePeerIdentifier, 'peerIds match');
        t.equal(peer.peerAvailable, true, 'peer is available');
        ThaliMobile.getPeerHostInfo(peer.peerIdentifier, peer.connectionType)
        .then(function () {
          t.fail('peerHostInfo should failed');
        })
        .catch(function(e) {
          t.equal(e.message, 'Connection could not be established',
            'error description matches');
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
    ThaliMobileNativeWrapper.emitter.removeListener(
      'peerAvailabilityChanged', peerAvailabilityChangedHandler);
    t.end();
  }

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
  tape.sinonTest(function (t) {
    var somePeerIdentifier = uuid.v4();

    var socket;
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
      if (socket) {
        socket.destroy();
      }
      t.end();
    }

    ThaliMobile.emitter.on('peerAvailabilityChanged',
      peerAvailabilityChangedHandler);

    ThaliMobileNativeWrapper.emitter.on('failedNativeConnection',
      failedConnectionHandler);

    var originalListener = ThaliMobileNativeWrapper.terminateListener;

    function disconnect (peerIdentifier) {
      t.equal(peerIdentifier, somePeerIdentifier, 'Peer still matches');
      t.ok(connectionErrorReceived, 'We got the connection error');
      ThaliMobileNativeWrapper.disconnect.restore();
      cleanUp();
      return Promise.resolve();
    }
    this.stub(ThaliMobileNativeWrapper, 'disconnect', disconnect);

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
        createPeerListener(somePeerIdentifier);
    })
    .then(function (port) {
      socket = net.createConnection(port, '127.0.0.1');
      socket.once('connect', function () {
        t.ok(true, 'We should have connected');
      });
    })
    .catch(function (err) {
      t.fail(err);
      ThaliMobileNativeWrapper.terminateListener = originalListener;
      cleanUp();
    });
  })
);

test('does not fire duplicate events after peer listener recreation',
  function () {
    return !platform.isAndroid ||
      global.NETWORK_TYPE !== ThaliMobile.networkTypes.NATIVE;
  },
  function (t) {
    var peerId = 'peer-id';
    var generation = 0;
    var initialPort = 1234;
    var recreatedPort = 1235;
    var EVENT_NAME = 'nonTCPPeerAvailabilityChangedEvent';
    var BLUETOOTH = connectionTypes.BLUETOOTH;

    var callCount = 0;
    ThaliMobile.emitter.on('peerAvailabilityChanged', function listener(peer) {
      callCount++;
      switch (callCount) {
        case 1:
          t.deepEqual(peer, {
            peerIdentifier: peerId,
            connectionType: BLUETOOTH,
            peerAvailable: true,
            generation: generation,
            newAddressPort: false,
          }, '1st call - correct peer');

          // emulate peer listener recreation
          setImmediate(function () {
            ThaliMobileNativeWrapper.emitter.emit(EVENT_NAME, {
              peerIdentifier: peerId,
              peerAvailable: false,
              generation: null,
              portNumber: null,
              recreated: true,
            });
          });
          break;
        case 2:
          t.deepEqual(peer, {
            peerIdentifier: peerId,
            connectionType: BLUETOOTH,
            peerAvailable: false,
            generation: null,
            newAddressPort: null,
          });

          // emulate peer listener recreation
          setImmediate(function () {
            ThaliMobileNativeWrapper.emitter.emit(EVENT_NAME, {
              peerIdentifier: peerId,
              peerAvailable: true,
              generation: generation,
              portNumber: recreatedPort,
              recreated: true,
            });
          });
          break;
        case 3:
          t.deepEqual(peer, {
            peerIdentifier: peerId,
            connectionType: BLUETOOTH,
            peerAvailable: true,
            generation: generation,
            newAddressPort: false,
          });

          // This should never happen in reality. Native Android does not send
          // repeated 'peerAvailabilityChanged' events. But this test checks
          // that thaliMobile ignores repeated events after recreation anyway.
          setImmediate(function () {
            ThaliMobileNativeWrapper.emitter.emit(EVENT_NAME, {
              peerIdentifier: peerId,
              peerAvailable: true,
              generation: generation,
              portNumber: recreatedPort,
              recreated: false,
            });

            ThaliMobile.emitter
              .removeListener('peerAvailabilityChanged', listener);
            t.end();
          });
          break;
        case 4:
          t.fail('Got unexpected peerAvailabilityChanged event');
      }
    });

    ThaliMobile.start(express.Router(), null, ThaliMobile.networkTypes.NATIVE)
    .then(function () {
      ThaliMobileNativeWrapper.emitter.emit(EVENT_NAME, {
        peerIdentifier: peerId,
        peerAvailable: true,
        generation: generation,
        portNumber: initialPort,
        recreated: false,
      });
    })
    .catch(function (err) {
      t.end(err || new Error('test failed'));
    });
  }
);


test('#stop should change peers', tape.sinonTest(function (t) {
  var spy = this.spy();

  var availabilityHandler = function(peer) {
    spy();

    switch (spy.callCount) {
      case 1:
        t.equal(Object.getOwnPropertyNames(
          ThaliMobile._peerAvailabilities[peer.connectionType]).length, 1,
          'Peer availabilities has one entry for our connection type');
        break;
      case 2:
        t.equal(Object.getOwnPropertyNames(
          ThaliMobile._peerAvailabilities[peer.connectionType]).length, 1,
          'Peer availabilities has one entry for our connection type');
        ThaliMobile.stop().then(function(){
          Object.getOwnPropertyNames(connectionTypes)
          .forEach(function (connectionKey) {
            var connectionType = connectionTypes[connectionKey];
            t.equal(Object.getOwnPropertyNames(
              ThaliMobile._peerAvailabilities[connectionType]).length,
              0, 'No peers');
          });
          finishTest();
        });
        break;
      default:
        break;
    }
  };

  function finishTest() {
    ThaliMobile.emitter
      .removeListener('peerAvailabilityChanged', availabilityHandler);
    t.end();
  }

  ThaliMobile.start(express.Router(), new Buffer('foo'),
    ThaliMobile.networkTypes.BOTH)
    .then(function () {
      return ThaliMobile.startListeningForAdvertisements();
    })
    .then(function () {
      var nativePeer  = generateLowerLevelPeers().nativePeer;
      var wifiPeer =  generateLowerLevelPeers().wifiPeer;

      ThaliMobile.emitter.on('peerAvailabilityChanged', availabilityHandler);
      emitNativePeerAvailability(nativePeer);
      emitWifiPeerAvailability(wifiPeer);
    })
    .catch(function (err) {
      t.fail('Failed out with ' + err);
      finishTest();
    });
}));

test('If there are more then PEERS_LIMIT peers presented ' +
  'then `discoveryDOS` event should be emitted', function (t) {
    var PEERS_LIMIT = 1;

    var CURRENT_MULTI_PEER_CONNECTIVITY_FRAMEWORK_PEERS_LIMIT =
      ThaliMobile._connectionTypePeersLimits
        [connectionTypes.MULTI_PEER_CONNECTIVITY_FRAMEWORK];

    var CURRENT_BLUETOOTH_PEERS_LIMIT =
      ThaliMobile._connectionTypePeersLimits[connectionTypes.BLUETOOTH];

    var CURRENT_TCP_NATIVE_PEERS_LIMIT =
      ThaliMobile._connectionTypePeersLimits[connectionTypes.TCP_NATIVE];

    ThaliMobile._connectionTypePeersLimits
      [connectionTypes.MULTI_PEER_CONNECTIVITY_FRAMEWORK] = PEERS_LIMIT;
    ThaliMobile._connectionTypePeersLimits[connectionTypes.BLUETOOTH] =
      PEERS_LIMIT;
    ThaliMobile._connectionTypePeersLimits[connectionTypes.TCP_NATIVE] =
      PEERS_LIMIT;

    function finishTest (connectionType) {
      ThaliMobile._connectionTypePeersLimits
        [connectionTypes.MULTI_PEER_CONNECTIVITY_FRAMEWORK] = 
          CURRENT_MULTI_PEER_CONNECTIVITY_FRAMEWORK_PEERS_LIMIT;
      ThaliMobile._connectionTypePeersLimits[connectionTypes.BLUETOOTH] =
        CURRENT_BLUETOOTH_PEERS_LIMIT;
      ThaliMobile._connectionTypePeersLimits[connectionTypes.TCP_NATIVE] = 
        CURRENT_TCP_NATIVE_PEERS_LIMIT;
      t.end();
    }

    ThaliMobile.start(express.Router())
      .then(function () {
        ThaliMobile.emitter.on('discoveryDOS', function (info) {
          t.ok(info.limit, PEERS_LIMIT, 'DOS limit should be presented');
          t.ok(info.count, 2, 'Actual number of peers should be presented');
          finishTest();
        });

        var nativePeer = generateLowerLevelPeers().nativePeer;
        var additionalNativePeer = generateLowerLevelPeers().nativePeer;

        emitNativePeerAvailability(nativePeer);
        emitNativePeerAvailability(additionalNativePeer);
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
    if (!peer.peerAvailable) {
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
tape.sinonTest(function (t) {
  var spy = this.spy();
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
}));

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
      if (peer.connectionType === connectionTypes.TCP_NATIVE) {
        return;
      }

      ThaliMobile.getPeerHostInfo(peer.peerIdentifier, peer.connectionType)
      .then(function (peerHostInfo) {
        return testUtils.get(
          peerHostInfo.hostAddress, peerHostInfo.portNumber,
          uuidPath, pskIdentity, pskKey
        ).catch(function () {
          // Ignore request failures. After peer listener recreating we are
          // getting new peerAvailabilityChanged event and retrying this request
          return null;
        });
      })
      .then(function (uuid) {
        if (uuid === null) {
          return;
        }
        if (remainingParticipants[uuid] !== participantState.notRunning) {
          return Promise.resolve(true);
        }
        remainingParticipants[uuid] = participantState.finished;
        var areWeDone = Object.getOwnPropertyNames(remainingParticipants)
          .every(
            function (participant) {
              return remainingParticipants[participant] ===
                participantState.finished;
            });
        if (areWeDone) {
          t.pass('received all uuids');
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
  for (var i = 0; i < numberOfConnections; ++i) {
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

test('test for data corruption',
  function () {
    return global.NETWORK_TYPE === ThaliMobile.networkTypes.WIFI ||
      !platform.isAndroid;
  },
  function (t) {
    var router = setUpRouter();
    var participantsState = {};
    var peerIDToUUIDMap = {};
    var areWeDone = false;
    var promiseQueue = new PromiseQueue();

    // This timer purpose is to manually restart ThaliMobile every 60 seconds.
    // Whole test timeout is set to 5 minutes, so there will be at most 4
    // restart attempts.
    //
    // Timer is used because of possible race condition when stopping and
    // starting ThaliMobile every time error occurs, which led to test failure
    // because exception was thrown.
    //
    // This issue is tracked in #1719.
    var timer = setInterval(function() {
      logger.debug('Restarting test for data corruption');

      ThaliMobile.stop().then(function() {
        runTestFunction();
      });
    }, 60 * 1000);

    function runTestFunction () {
      t.participants.forEach(function (participant) {
        if (participant.uuid === tape.uuid) {
          return;
        }
        participantsState[participant.uuid] = participantState.notRunning;
      });

      setupDiscoveryAndFindPeers(t, router, function (peer, done) {
        testFunction(peer).then(function (result) {
          // Check if promise was resolved with true.
          if (result) {
            t.ok(true, 'Test for data corruption succeed');
            done();
            clearInterval(timer);
          }
        });
      });
    }

    function testFunction (peer) {
      // Try to get data only from non-TCP peers so that the test
      // works the same way on desktop on CI where Wifi is blocked
      // between peers.
      if (peer.connectionType === connectionTypes.TCP_NATIVE) {
        Promise.resolve(true);
      }

      if (peerIDToUUIDMap[peer.peerIdentifier] &&
        participantsState[peerIDToUUIDMap[peer.peerIdentifier] ===
        participantState.finished]) {
        Promise.resolve(true);
      }
      return promiseQueue.enqueue(function (resolve) {
        // To avoid multiple t.end() calls, just resolve here with null.
        // The areWeDone check will be called anyway in different section.
        if (areWeDone) {
          return resolve(null);
        }

        logger.debug('Found peer - ' + JSON.stringify(peer));

        var uuid = null;
        var hostAddress = null;
        var portNumber = null;

        ThaliMobile.getPeerHostInfo(peer.peerIdentifier, peer.connectionType)
          .then(function (peerHostInfo) {
            hostAddress = peerHostInfo.hostAddress;
            portNumber = peerHostInfo.portNumber;

            return testUtils.get(
              hostAddress, portNumber,
              uuidPath, pskIdentity, pskKey
            );
          })
          .then(function (responseBody) {
            uuid = responseBody;
            peerIDToUUIDMap[peer.peerIdentifier] = uuid;
            logger.debug('Got uuid back from GET - ' + uuid);

            if (participantsState[uuid] !== participantState.notRunning) {
              logger.debug('Participant is already done - ' + uuid);
              return resolve(null);
            } else {
              logger.debug('Participants state is ' + participantsState[uuid]);
            }

            participantsState[uuid] = participantState.running;

            return numberOfParallelRequests(t, hostAddress, portNumber,
              echoPath, pskIdentity, pskKey)
              .then(function () {
                logger.debug('Got back from parallel requests - ' + uuid);
                participantsState[uuid] = participantState.finished;
              });
          })
          .catch(function (error) {
            logger.debug('Got an error on HTTP requests: ' + error);
          })
          .then(function () {
            areWeDone = Object.getOwnPropertyNames(participantsState)
              .every(
                function (participant) {
                  return participantsState[participant] ===
                    participantState.finished;
                });

            if (areWeDone) {
              logger.debug('received all uuids');

              return resolve(true);
            }

            var serversManager = ThaliMobileNativeWrapper._getServersManager();
            serversManager.terminateOutgoingConnection(
              peer.peerIdentifier,
              peer.portNumber
            );

            // We have to give Android enough time to notice the killed
            // connection and recycle everything
            setTimeout(function () {
              return resolve(null);
            }, 1000);
          });
      });
    }

    runTestFunction();
  }
 );
