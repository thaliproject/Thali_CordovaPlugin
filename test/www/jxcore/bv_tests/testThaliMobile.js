'use strict';

var ThaliMobile = require('thali/NextGeneration/thaliMobile');
var ThaliMobileNativeWrapper = require('thali/NextGeneration/thaliMobileNativeWrapper');
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
var Promise = require('bluebird');
var PromiseQueue = require('thali/NextGeneration/promiseQueue');
var net = require('net');
var Platform =require('thali/NextGeneration/utils/platform');

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
  for (var key in ThaliMobileNativeWrapper.connectionTypes) {
    if (peer.connectionType === ThaliMobileNativeWrapper.connectionTypes[key]) {
      connectionTypeKey = key;
    }
  }
  t.equals(peer.connectionType, ThaliMobileNativeWrapper.connectionTypes[connectionTypeKey],
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

test('#stop should clear watchers and change peers', function (t) {
  var somePeerIdentifier = 'urn:uuid:' + uuid.v4();

  var connectionType =
    Platform.isAndroid ?
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
        peerAvailable: true
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

test('network changes emitted correctly', function (t) {
  testUtils.ensureWifi(true)
  .then(function () {
    return ThaliMobile.start(express.Router());
  })
  .then(function () {
    return new Promise(function (resolve) {
      function networkChangedHandler (networkStatus) {
        t.equals(networkStatus.wifi, 'off', 'wifi should be off');
        t.equals(networkStatus.bssidName, null, 'bssid should be null');
        t.equals(networkStatus.ssidName,  null, 'ssid should be null');
        resolve();
      }
      ThaliMobile.emitter.once('networkChanged', networkChangedHandler);
      testUtils.toggleWifi(false);
    });
  })
  .then(function () {
    return new Promise(function (resolve) {
      function networkChangedHandler (networkStatus) {
        t.equals(networkStatus.wifi, 'on', 'wifi should be on');
        t.ok(
          testUtils.validateBSSID(networkStatus.bssidName),
          'bssid should be valid'
        );
        t.ok(
          networkStatus.ssidName && networkStatus.ssidName.length > 0,
          'ssid should exist'
        );
        resolve();
      }
      ThaliMobile.emitter.once('networkChanged', networkChangedHandler);
      testUtils.toggleWifi(true);
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
    function networkChangedHandler (networkStatus) {
      console.trace();
      isEmitted = true;
    }
    ThaliMobile.emitter.once('networkChanged', networkChangedHandler);

    toggle()
    .then(function () {
      setImmediate(function () {
        t.notOk(isEmitted, 'event should not be emitted');
        ThaliMobile.emitter.removeListener('networkChanged', networkChangedHandler);
        resolve();
      });
    });
  });
}

test('network changes not emitted in started state', function (t) {
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

test('network changes not emitted in stopped state', function (t) {
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

test('calls correct starts when network changes', function (t) {
  var listeningSpy   = null;
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

test('We properly fire peer unavailable and then available when ' +
  'connection fails', function(t) {
  var somePeerIdentifier = 'urn:uuid:' + uuid.v4();

  var callCounter = 0;
  var connectionErrorReceived = false;

  var failedConnectionHandler = function (peer) {
    t.equal(peer.peerIdentifier, somePeerIdentifier, 'Failed on right peer');
    t.ok(peer.recreated, 'Marked as recreated');
    connectionErrorReceived = true;
  };

  var peerAvailabilityChangedHandler = function (peer) {
    ++callCounter;
    switch(callCounter) {
      case 1: {
        t.equal(peer.peerIdentifier, somePeerIdentifier, 'peerIds match');
        t.ok(peer.portNumber, 'peer has a portNumber');
        t.ok(peer.hostAddress, 'peer has a host address');
        var socket = net.createConnection(peer.portNumber, peer.hostAddress);
        socket.on('connect', function () {
          t.ok(true, 'We should have connected');
        });
        return;
      }
      case 2: {
        t.equal(peer.peerIdentifier, somePeerIdentifier, 'still same peer IDs');
        t.notOk(peer.portNumber, 'peer should not have a portNumber');
        t.notOk(peer.hostAddress, 'peer should not have a host address');
        return;
      }
      case 3: {
        t.equal(peer.peerIdentifier, somePeerIdentifier, 'peerIds match again');
        t.ok(peer.portNumber, 'peer has a portNumber again');
        t.ok(peer.hostAddress, 'peer has a host address again');
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
    ThaliMobileNativeWrapper.emitter.removeListener('failedConnection',
      failedConnectionHandler);
    ThaliMobileNativeWrapper.emitter.removeListener(
      'peerAvailabilityChanged', peerAvailabilityChangedHandler);
    t.end();
  }

  ThaliMobileNativeWrapper.emitter.on('failedConnection',
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
  'happen', function (t) {
  var somePeerIdentifier = 'urn:uuid:' + uuid.v4();

  var peerAvailabilityChangedHandler = function (peer) {
    t.fail('We should not have gotten a peer ' + JSON.stringify(peer));
    return cleanUp();
  };

  var failedConnectionHandler = function (peer) {
    t.equal(peer.peerIdentifier, somePeerIdentifier, 'Failed on right peer');
    t.ok(peer.recreated, 'Marked as recreated');
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
    ThaliMobileNativeWrapper.emitter.removeListener('failedConnection',
      failedConnectionHandler);
    t.end();
  }

  ThaliMobile.emitter.on('peerAvailabilityChanged',
    peerAvailabilityChangedHandler);

  var connectionErrorReceived = false;
  ThaliMobileNativeWrapper.emitter.on('failedConnection',
    failedConnectionHandler);

  var originalListener = ThaliMobileNativeWrapper.terminateListener;
  ThaliMobileNativeWrapper.terminateListener = function(peerIdentifier) {
    t.equal(peerIdentifier, somePeerIdentifier, 'Peer still matches');
    t.ok(connectionErrorReceived, 'We got the connection error');
    ThaliMobileNativeWrapper.terminateListener = originalListener;
    cleanUp();
  };

  ThaliMobile.start(express.Router(), new Buffer('foo'),
    ThaliMobile.networkTypes.NATIVE)
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

var participantState = {
  running: 'running',
  notRunning: 'notRunning',
  finished: 'finished'
};

test('can get data from all participants', function () {
  return global.NETWORK_TYPE === ThaliMobile.networkTypes.WIFI;
}, function (t) {
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
    testUtils.get(
      peer.hostAddress, peer.portNumber,
      uuidPath, pskIdentity, pskKey
    )
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
});

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
  return global.NETWORK_TYPE === ThaliMobile.networkTypes.WIFI;
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

test('Discovered peer should be removed if no availability updates ' +
  'were received during availability timeout', function (t) {
    var peerIdentifier = 'urn:uuid:' + uuid.v4();
    var portNumber = 8080;

    var originalThreshold = thaliConfig.NON_TCP_PEER_UNAVAILABILITY_THRESHOLD;
    thaliConfig.NON_TCP_PEER_UNAVAILABILITY_THRESHOLD = 500;

    var finalizeTest = function (error) {
      thaliConfig.NON_TCP_PEER_UNAVAILABILITY_THRESHOLD =
        originalThreshold;
      t.end(error);
    };

    ThaliMobile.start(express.Router())
    .then(function () {
      var availabilityHandler = function (peer) {
        if (peer.peerIdentifier !== peerIdentifier) {
          return;
        }

        ThaliMobile.emitter.removeListener('peerAvailabilityChanged',
          availabilityHandler);

        var unavailabilityHandler = function (peer) {
          if (peer.peerIdentifier !== peerIdentifier) {
            return;
          }

          ThaliMobile.emitter.removeListener('peerAvailabilityChanged',
            unavailabilityHandler);

          finalizeTest(null);
        };

        ThaliMobile.emitter.on('peerAvailabilityChanged',
          unavailabilityHandler);
      };

      ThaliMobile.emitter.on('peerAvailabilityChanged', availabilityHandler);

      ThaliMobileNativeWrapper.emitter.emit('nonTCPPeerAvailabilityChangedEvent',
        {
          peerIdentifier: peerIdentifier,
          portNumber: portNumber
        }
      );
    })
    .catch(function (error) {
      finalizeTest(error);
    });
});
