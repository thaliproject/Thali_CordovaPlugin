
'use strict';

var ThaliMobile = require('thali/NextGeneration/thaliMobile');
if (global.NETWORK_TYPE === ThaliMobile.networkTypes.WIFI) {
  return;
}

var express = require('express');
var net = require('net');
var Promise = require('lie');
var testUtils = require('../lib/testUtils.js');

if (typeof Mobile === 'undefined') {
  return;
}

var platform = require('thali/NextGeneration/utils/platform');
var thaliMobileNativeWrapper =
  require('thali/NextGeneration/thaliMobileNativeWrapper');
var thaliMobileNativeTestUtils = require('../lib/thaliMobileNativeTestUtils');
var validations = require('thali/validations');
var tape = require('../lib/thaliTape');
var uuid = require('node-uuid');

var peerIdsToBeClosed = [];

var test = tape({
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    thaliMobileNativeWrapper.stop()
      .then(function () {
        t.equals(thaliMobileNativeWrapper._isStarted(), false,
          'must be stopped');
        thaliMobileNativeTestUtils.stopListeningAndAdvertising()
          .then(function () {
            if (!platform.isAndroid) {
              return thaliMobileNativeTestUtils.killAllMultiConnectConnections(peerIdsToBeClosed);
            }
          })
          .catch(function (err) {
            t.fail(err);
          })
          .then(function () {
            peerIdsToBeClosed = [];
            thaliMobileNativeWrapper._registerToNative();
            t.end();
          });
      })
      .catch(function (err) {
        t.fail('teardown failed with ' + JSON.stringify(err));
        t.end();
      });
  }
});

var testIdempotentFunction = function (t, functionName) {
  thaliMobileNativeWrapper.start(express.Router())
  .then(function () {
    return thaliMobileNativeWrapper[functionName]();
  })
  .then(function (error) {
    t.notOk(error, 'no errors');
    return thaliMobileNativeWrapper[functionName]();
  })
  .then(function (error) {
    t.notOk(error, 'still no errors');
    t.end();
  })
  .catch(function (error) {
    t.fail('testIdempotentFunction failed with ' + JSON.stringify(error));
    t.end();
  });
};

var testFunctionBeforeStart = function (t, functionName) {
  thaliMobileNativeWrapper[functionName]()
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

test('can get the network status before starting', function (t) {
  thaliMobileNativeWrapper.getNonTCPNetworkStatus()
  .then(function (networkChangedValue) {
    t.doesNotThrow(function () {
      var requiredProperties = [
        'wifi',
        'bluetooth',
        'bluetoothLowEnergy',
        'cellular'
      ];
      requiredProperties.forEach(function (requiredProperty) {
        validations.ensureNonNullOrEmptyString(
          networkChangedValue[requiredProperty]
        );
      });
    }, 'network status should have certain non-empty properties');
    t.end();
  });
});

test('error returned with bad router', function (t) {
  thaliMobileNativeWrapper.start('bad router')
  .then(function () {
    t.fail('should not succeed');
    t.end();
  })
  .catch(function (error) {
    t.equals(error.message, 'Bad Router', 'specific error expected');
    t.end();
  });
});

var testPath = '/test';
function trivialEndToEndTestScaffold(t, pskIdtoSecret, pskIdentity, pskKey,
                                     testData, callback) {
  var router = express.Router();
  router.get(testPath, function (req, res) {
    res.send(testData);
  });

  var end = function (peerId, fail) {
    peerIdsToBeClosed.push(peerId);
    return callback ? callback(peerId, fail) : t.end();
  };

  thaliMobileNativeTestUtils.getSamePeerWithRetry(testPath, pskIdentity, pskKey)
    .then(function (response) {
      t.equal(response.httpResponseBody, testData,
        'response body should match testData');
      end(response.peerId);
    })
    .catch(function (error) {
      t.fail('fail in trivialEndtoEndTestScaffold - ' + error);
      end(null, error);
    });

  thaliMobileNativeWrapper.start(router, pskIdtoSecret)
    .then(function () {
      return thaliMobileNativeWrapper.startListeningForAdvertisements();
    })
    .then(function () {
      return thaliMobileNativeWrapper.startUpdateAdvertisingAndListening();
    });
}

var pskIdentity = 'I am me!';
var pskKey = new Buffer('I am a reasonable long string');
var testData = 'foobar';
function trivialEndToEndTest(t, callback) {
  function pskIdToSecret(id) {
    // There is a race condition where we could still get an incoming
    // request even after we think we are done with the test. This will cause
    // us to do a test but it will be a test called after we called end and
    // thus causes an unexpected error. To prevent this race condition we will
    // pre-vet the result and only if it's wrong will we call t.fail. That
    // way any extraneous connections won't cause us to fail just because we
    // did a test after we had called end.
    if (id !== pskIdentity) {
      t.fail('Should only get expected id');
    }
    return id === pskIdentity ? pskKey : null;
  }

  trivialEndToEndTestScaffold(
    t, pskIdToSecret, pskIdentity, pskKey, testData, callback
  );
}

var connectionTester = function(port, reversed) {
  return new Promise(function(resolve, reject) {
    var connection = net.createConnection(port, function () {
      connection.destroy();
      if (reversed) {
        reject(new Error('Unexpectedly successful connection'));
      } else {
        resolve();
      }
    });
    connection.on('error', function (error) {
      connection.destroy();
      if (reversed) {
        resolve();
      } else {
        reject(error);
      }
    });
  });
};

test('all services are started when we call start', function (t) {
  var serversManagerLocalPort = 0;
  var routerServerPort = 0;
  var connections = [];
  thaliMobileNativeWrapper.start(express.Router())
  .then(function () {
    return thaliMobileNativeWrapper.startListeningForAdvertisements();
  })
  .then(function () {
    return thaliMobileNativeWrapper.startUpdateAdvertisingAndListening();
  })
  .then(function () {
    routerServerPort = thaliMobileNativeWrapper._getRouterServerPort();

    connections.push(connectionTester(routerServerPort));

    if (platform.isAndroid) {
      serversManagerLocalPort =
        thaliMobileNativeWrapper._getServersManagerLocalPort();
      connections.push(connectionTester(serversManagerLocalPort));
    }

    return Promise.all(connections);
  })
  .then(function (connection) {
    t.pass('all connection succeed');
    t.end();
  })
  .catch(function (error) {
    t.fail(error);
    t.end();
  });
});

test('TCP Servers Manager should be null when we call start on iOS',
testUtils.skipOnAndroid,
function (t) {
  thaliMobileNativeWrapper.start(express.Router())
  .then(function () {
    return thaliMobileNativeWrapper.startListeningForAdvertisements();
  })
  .then(function () {
    return thaliMobileNativeWrapper.startUpdateAdvertisingAndListening();
  })
  .then(function () {
    var serversManager = thaliMobileNativeWrapper._getServersManager();
    t.equals(serversManager, null, 'TCP Servers Manager doesn\'t exists');
    t.end();
  })
  .catch(function (error) {
    t.fail(error);
    t.end();
  });
});

test('all services are stopped when we call stop', function (t) {
  var stopped = false;
  var serversManagerLocalPort = 0;
  var routerServerPort = 0;
  var connections = [];
  thaliMobileNativeWrapper.start(express.Router())
  .then(function () {
    return thaliMobileNativeWrapper.startListeningForAdvertisements();
  })
  .then(function () {
    return thaliMobileNativeWrapper.startUpdateAdvertisingAndListening();
  })
  .then(function() {
    var discoveryStopped = false;
    var advertisingStopped = false;
    var stateChangeHandler = function (state) {
      discoveryStopped = !state.discoveryActive;
      advertisingStopped = !state.advertisingActive;
      if (discoveryStopped && advertisingStopped) {
        thaliMobileNativeWrapper.emitter.removeListener(
          'discoveryAdvertisingStateUpdateNonTCP',
          stateChangeHandler
        );
        var doConnectTest = function () {
          // It is possible that the state changes
          // are emitted before the stop call has been
          // completed so don't proceed with the checks
          // until the stop has been done.
          if (stopped === false) {
            setImmediate(doConnectTest);
            return;
          }

          routerServerPort = thaliMobileNativeWrapper._getRouterServerPort();

          connections.push(connectionTester(routerServerPort, true));

          if (platform.isAndroid) {
            serversManagerLocalPort =
              thaliMobileNativeWrapper._getServersManagerLocalPort();
            connections.push(connectionTester(serversManagerLocalPort, true));
          }

          Promise.all(connections)
          .then(function (response) {
            t.pass('connection should fail after stopping');
            t.end();
          })
          .catch(function () {
            t.fail('connection should fail after stopping');
            t.end();
          });

        };
        doConnectTest();
      }
    };
    thaliMobileNativeWrapper.emitter.on(
      'discoveryAdvertisingStateUpdateNonTCP',
      stateChangeHandler
    );
    thaliMobileNativeWrapper.stop()
    .then(function () {
      t.equals(thaliMobileNativeWrapper._isStarted(), false,
        'is stopped after calling stop');
      stopped = true;
      // stateChangeHandler above should get called
    });
  });
});

var verifyCallWithArguments = function (t, callName, parameters) {
  var mockServersManager = {};
  var spy = this.spy();
  var serversManagerEquivalentCallName = callName === '_terminateConnection' ?
    'terminateIncomingConnection' : 'terminateOutgoingConnection';
  mockServersManager[serversManagerEquivalentCallName] = function () {
    spy.apply(this, arguments);
    return Promise.resolve();
  };
  var oldServersManager = thaliMobileNativeWrapper._getServersManager();
  thaliMobileNativeWrapper._setServersManager(mockServersManager);
  thaliMobileNativeWrapper[callName].apply(this, parameters)
  .then(function () {
    t.equals(
      JSON.stringify(parameters),
      JSON.stringify(spy.args[0]),
      'called with right arguments'
    );
    thaliMobileNativeWrapper._setServersManager(oldServersManager);
    t.end();
  });
};

test('make sure terminateConnection is properly hooked up',
  testUtils.skipOnIOS,
  tape.sinonTest(function (t) {
    verifyCallWithArguments.call(this, t, '_terminateConnection', ['connection-id']);
  })
);

test('make sure terminateConnection is return error if we get called on iOS',
  testUtils.skipOnAndroid,
  function (t) {
    var error = 'Not connect platform';

    thaliMobileNativeWrapper._terminateConnection()
    .then(function() {
      t.fail('should not succeed on iOS');
      t.end();
    })
    .catch(function(err) {
      t.equal(err.message, error, 'error description matches');
      t.end();
    });
  }
);

test('make sure terminateListener is properly hooked up',
  testUtils.skipOnIOS,
  tape.sinonTest(function (t) {
    verifyCallWithArguments.call(this, t, '_terminateListener', ['peer-id', 8080]);
  })
);

test('make sure terminateListener is return error if we get called on iOS',
  testUtils.skipOnAndroid,
  function (t) {
    var error = 'Not connect platform';

    thaliMobileNativeWrapper._terminateListener()
    .then(function() {
      t.fail('should not succeed on iOS');
      t.end();
    })
    .catch(function(err) {
      t.equal(err.message, error, 'error description matches');
      t.end();
    });
  }
);

test('make sure we actually call kill connections properly', function (t) {
  thaliMobileNativeWrapper.killConnections()
  .then(function () {
    if (platform.isAndroid) {
      t.fail('should not succeed on Android');
      t.end();
    } else {
      // TODO: Do right checks on iOS.
      // Also implement the right behavior in the Wifi-based mock.
      t.ok(true, 'IMPLEMENT ME!!!!!!');
      t.end();
    }
  })
  .catch(function (error) {
    if (platform._isRealIOS) {
      t.fail('should not fail on iOS');
      t.end();
    } else {
      t.equals(error.message, 'Not Supported', 'specific error expected');
      t.end();
    }
  });
});

test('thaliMobileNativeWrapper is stopped when routerPortConnectionFailed ' +
  'is received',
  testUtils.skipOnIOS,
  function (t) {
    thaliMobileNativeWrapper.start(express.Router())
    .then(function () {
      var routerServerPort = thaliMobileNativeWrapper._getRouterServerPort();
      var errorDescription = 'Dummy Error';
      thaliMobileNativeWrapper.emitter.once(
        'incomingConnectionToPortNumberFailed',
        function (routerFailureReason) {
          t.equals(
            routerFailureReason.reason,
            thaliMobileNativeWrapper.routerFailureReason.APP_LISTENER,
            'failure reason is as expected'
          );
          t.equals(
            routerFailureReason.errors[0].message,
            errorDescription,
            'error description is as expected'
          );
          t.equals(thaliMobileNativeWrapper._isStarted(), false,
            'must be stopped');
          t.end();
        }
      );
      thaliMobileNativeWrapper._getServersManager().emit(
        'routerPortConnectionFailed',
        {
          routerPort: routerServerPort,
          error: new Error(errorDescription)
        }
      );
    });
  }
);

test('We fire failedNativeConnection event when we get failedConnection from ' +
  'thaliTcpServersManager',
  testUtils.skipOnIOS,
  function (t) {
    thaliMobileNativeWrapper.start(express.Router())
    .then(function () {
      var peerIdentifier = 'some-identifier';
      var errorDescription = 'Dummy Error';
      thaliMobileNativeWrapper.emitter.once(
        'failedNativeConnection',
        function (failedConnection) {
          t.equals(failedConnection.peerIdentifier, peerIdentifier,
            'peerIdentifier matches');
          t.equals(failedConnection.error.message, errorDescription,
            'error description matches');
          t.equals(
            failedConnection.connectionType,
            thaliMobileNativeWrapper.connectionTypes.BLUETOOTH,
            'connection type is tcp');
          t.end();
        }
      );
      thaliMobileNativeWrapper._getServersManager().emit(
        'failedConnection',
        {
          peerIdentifier: peerIdentifier,
          error: new Error(errorDescription)
        }
      );
    });
  }
);

test('We fire failedNativeConnection event when we get failedConnection from ' +
  'multiConnectConnection',
  function() {
    // this test uses mock ability to fire events from native layer and it cant
    // work on real devices
    return platform._isRealMobile;
  },
  function (t) {
    thaliMobileNativeWrapper.start(express.Router())
    .then(function () {
      var peerIdentifier = 'some-identifier';
      var errorDescription = 'Dummy Error';
      thaliMobileNativeWrapper.emitter.once(
        'failedNativeConnection',
        function (failedConnection) {
          t.equals(failedConnection.peerIdentifier, peerIdentifier,
            'peerIdentifier matches');
          t.equals(failedConnection.error, errorDescription,
            'error description matches');
          t.equals(
            failedConnection.connectionType,
            thaliMobileNativeWrapper.connectionTypes.
              MULTI_PEER_CONNECTIVITY_FRAMEWORK,
            'connection type is MPCF');
          t.end();
        }
      );
      Mobile.fireMultiConnectConnectionFailure({
        peerIdentifier: peerIdentifier,
        error: errorDescription
      });
    });
  }
);

test('We fire nonTCPPeerAvailabilityChangedEvent event when we get ' +
  'failedConnection from multiConnectConnection',
  function() {
    // We no longer do it, see discussion in #1924
    return true;
  },
  function (t) {
    thaliMobileNativeWrapper.start(express.Router())
    .then(function () {
      var peerIdentifier = 'some-identifier';
      var callCounter = 0;
      var errorMessage = 'Connection could not be established';
      var peer = {
        peerIdentifier: peerIdentifier,
        peerAvailable: true,
        generation: 5,
        portNumber: null
      };

      var peerAvailabilityHandler = function (peer) {
        ++callCounter;

        switch (callCounter) {
          case 1: {
            t.equal(peer.peerIdentifier, peerIdentifier, 'peerIds match');
            Mobile.fireMultiConnectConnectionFailure({
              peerIdentifier: peerIdentifier,
              error: errorMessage
            });
            return;
          }
          case 2: {
            t.equal(peer.peerIdentifier, peerIdentifier, 'peerIds match');
            t.equal(peer.peerAvailable, false, 'peer is unavailable');
            return;
          }
          case 3: {
            t.equal(peer.peerIdentifier, peerIdentifier, 'peerIds match');
            t.equal(peer.peerAvailable, true, 'peer should be available');
            t.equal(peer.recreated, true, 'peer is recreated');
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
        thaliMobileNativeWrapper.emitter.removeListener(
          'nonTCPPeerAvailabilityChangedEvent', peerAvailabilityHandler);
        t.end();
      }

      thaliMobileNativeWrapper.emitter.on('nonTCPPeerAvailabilityChangedEvent',
        peerAvailabilityHandler);

      thaliMobileNativeWrapper._handlePeerAvailabilityChanged(peer);
    });
  }
);

test('We fire nonTCPPeerAvailabilityChangedEvent event when we get ' +
  'fail from _multiConnectResolved',
  function (t) {
    t.skip('NOT IMPLEMENTED');
    t.end();
  }
);

test('make sure bad PSK connections fail',
function () {
  // #1587
  // return platform._isRealMobile;
  return true;
},
function (t) {
  // trivialBadEndtoEndTest(t, true);
  // TODO: Re-enable and fix
  t.ok(true, 'FIX ME, PLEASE!!!');
  t.end();
});

test('peer changes handled from a queue',
  function () {
    return platform.isMobile;
  },
  function (t) {
    thaliMobileNativeWrapper.start(express.Router())
    .then(function () {
      var peerAvailabilityHandler;
      var peerCount = 10;
      var getDummyPeers = function (peerAvailable) {
        var dummyPeers = [];
        for (var i = 1; i <= peerCount; i++) {
          dummyPeers.push({
            peerIdentifier: i + '',
            peerAvailable: peerAvailable,
            generation: 0
          });
        }
        return dummyPeers;
      };
      var endTest = function () {
        thaliMobileNativeWrapper.emitter.removeListener(
          'nonTCPPeerAvailabilityChangedEvent',
          peerAvailabilityHandler);
        Mobile.firePeerAvailabilityChanged(getDummyPeers(false));
        t.end();
      };
      var previousPeerNumber = 0;
      peerAvailabilityHandler = function (peer) {
        var peerNumber = parseInt(peer.peerIdentifier);
        if (peerNumber - 1 !== previousPeerNumber) {
          t.fail('peers should be handled in order');
          endTest();
        }
        previousPeerNumber = peerNumber;
        if (peerNumber === peerCount) {
          t.ok(true, 'peers were handled in the right order');
          endTest();
        }
      };
      thaliMobileNativeWrapper.emitter.on('nonTCPPeerAvailabilityChangedEvent',
        peerAvailabilityHandler);
      Mobile.firePeerAvailabilityChanged(getDummyPeers(true));
    });
  });

test('relaying discoveryAdvertisingStateUpdateNonTCP',
  function() {
    return platform._isRealMobile;
  },
  function (t) {
    thaliMobileNativeWrapper.start(express.Router())
      .then(function () {
        thaliMobileNativeWrapper.emitter.once(
          'discoveryAdvertisingStateUpdateNonTCP',
          function (discoveryAdvertisingStateUpdateValue) {
            t.ok(discoveryAdvertisingStateUpdateValue.discoveryActive,
              'discovery is active');
            t.ok(discoveryAdvertisingStateUpdateValue.advertisingActive,
              'advertising is active');
            t.end();
          }
        );
        Mobile.fireDiscoveryAdvertisingStateUpdateNonTCP({
          discoveryActive: true,
          advertisingActive: true
        });
      });
  });

test('thaliMobileNativeWrapper is stopped when ' +
  'incomingConnectionToPortNumberFailed is received',
  function () {
    return platform._isRealMobile;
  },
  function (t) {
    var routerPort = 0;
    thaliMobileNativeWrapper.emitter
      .once('incomingConnectionToPortNumberFailed', function (err) {
        t.equal(err.reason,
          thaliMobileNativeWrapper.routerFailureReason.NATIVE_LISTENER,
          'right error reason');
        t.ok(err.errors.length === 0, 'Stop should be fine');
        t.equal(err.routerPort, routerPort, 'same port');
        t.notOk(thaliMobileNativeWrapper._isStarted(), 'we should be off');
        t.end();
      });
    thaliMobileNativeWrapper.start(express.Router())
      .then(function () {
        routerPort = platform.isAndroid ?
                      thaliMobileNativeWrapper._getServersManagerLocalPort() :
                      thaliMobileNativeWrapper._getRouterServerPort();

        return thaliMobileNativeWrapper.startUpdateAdvertisingAndListening();
      })
      .then(function () {
        Mobile.fireIncomingConnectionToPortNumberFailed(routerPort);
      });
  });

test('we successfully receive and replay discoveryAdvertisingStateUpdate',
  function (t) {
    var doEqualsChecks = function (value, discoveryActive, advertisingActive) {
      t.equals(
        value.discoveryActive,
        discoveryActive,
        'discoveryActive matches'
      );
      t.equals(
        value.advertisingActive,
        advertisingActive,
        'advertisingActive matches'
      );
    };
    var doChecks = function (discoveryActive, advertisingActive, callback) {
      var previousStateUpdateValue = {};
      var checkingStopping = false;
      var stateUpdateHandler = function (stateUpdateValue) {
        // Ignore duplicates
        if (stateUpdateValue.advertisingActive ===
            previousStateUpdateValue.advertisingActive &&
            stateUpdateValue.discoveryActive ===
            previousStateUpdateValue.discoveryActive) {
          return;
        }
        previousStateUpdateValue = stateUpdateValue;
        if (!checkingStopping) {
          doEqualsChecks(
            stateUpdateValue,
            discoveryActive,
            advertisingActive
          );
          checkingStopping = true;
          thaliMobileNativeWrapper.stop();
        } else {
          doEqualsChecks(
            stateUpdateValue,
            false,
            false
          );
          thaliMobileNativeWrapper.start(express.Router())
          .then(function () {
            thaliMobileNativeWrapper.emitter.removeListener(
              'discoveryAdvertisingStateUpdateNonTCP',
              stateUpdateHandler
            );
            callback();
          });
        }
      };
      thaliMobileNativeWrapper.emitter.on(
        'discoveryAdvertisingStateUpdateNonTCP',
        stateUpdateHandler
      );
    };
    var checkDiscovery = function (callback) {
      doChecks(true, false, callback);
      thaliMobileNativeWrapper.startListeningForAdvertisements();
    };
    var checkAdvertising = function (callback) {
      doChecks(false, true, callback);
      thaliMobileNativeWrapper.startUpdateAdvertisingAndListening();
    };
    thaliMobileNativeWrapper.start(express.Router())
    .then(function () {
      checkDiscovery(function () {
        checkAdvertising(function () {
          t.end();
        });
      });
    });
  }
);

if (!tape.coordinated) {
  return;
}

var endToEndWithStateCheck = function (t) {
  trivialEndToEndTest(t, function () {
    t.equals(thaliMobileNativeWrapper._isStarted(), true, 'must be started');
    t.end();
  });
};

test('nonTCPPeerAvailabilityChangedEvent should return null' +
'for a portNumber on iOS',
testUtils.skipOnAndroid,
function (t) {
  thaliMobileNativeWrapper.start(express.Router())
  .then(function () {
    return thaliMobileNativeWrapper.startListeningForAdvertisements();
  })
  .then(function () {
    return thaliMobileNativeWrapper.startUpdateAdvertisingAndListening();
  })
  .then(function () {
    thaliMobileNativeWrapper.emitter.once('nonTCPPeerAvailabilityChangedEvent',
    function(res) {
      t.equals(res.portNumber, null, 'portNumber equal null');
      t.end();
    });
  })
  .catch(function (error) {
    t.fail(error);
    t.end();
  });
});

test('can do HTTP requests between peers', function (t) {
  endToEndWithStateCheck(t);
});

test('can still do HTTP requests between peers with coordinator', function (t) {
  endToEndWithStateCheck(t);
});

test('calls correct starts when network changes',
  testUtils.skipOnIOS, // uses toggleBluetooth
  tape.sinonTest(function (t) {
    var listeningSpy =
      this.spy(thaliMobileNativeWrapper, 'startListeningForAdvertisements');
    var advertisingSpy =
      this.spy(thaliMobileNativeWrapper, 'startUpdateAdvertisingAndListening');

    return thaliMobileNativeWrapper.start(express.Router())
      .then(function () {
        return testUtils.ensureBluetooth(false);
      })
      .then(function () {
        var validateStartResult = function (promise) {
          return promise
            .then(function () {
              t.fail('Should fail');
            })
            .catch(function (error) { // eslint-disable-line
              t.equals(error.message, 'Radio Turned Off',
                'specific error expected');
            });
        };
        var listen = validateStartResult(
          thaliMobileNativeWrapper.startListeningForAdvertisements()
        );
        var advertise = validateStartResult(
          thaliMobileNativeWrapper.startUpdateAdvertisingAndListening()
        );
        return Promise.all([ listen, advertise ]);
      })
      .then(function () {
        listeningSpy.reset();
        advertisingSpy.reset();
        return testUtils.ensureBluetooth(true);
      })
      .then(function () {
        return thaliMobileNativeWrapper._getPromiseQueue().enqueue(
          function (resolve) {
            t.ok(
              listeningSpy.calledOnce,
              'startListeningForAdvertisements should have been called once'
            );
            t.ok(
              advertisingSpy.calledOnce,
              'startUpdateAdvertisingAndListening should have been called once'
            );
            resolve();
          }
        );
      })
      .catch(function (err) {
        t.fail(err.message + '. ' + err.stack);
      })
      .then(function () {
        return thaliMobileNativeWrapper.stop();
      })
      .then(function () {
        t.end();
      });
  })
);

// The connection cut is implemented as a separate test instead
// of doing it in the middle of the actual test so that the
// step gets coordinated between peers.
test('test to coordinate connection cut', function (t) {
    // This cuts connections on Android or iOS
    var result = platform.isAndroid ?
      testUtils.toggleBluetooth(false):
      thaliMobileNativeWrapper.killConnections();

    result.then(function () {
      t.end();
    })
    .catch(function () {
      t.end();
    });
  });

test('can do HTTP requests after connections are cut', function (t) {
  // Turn Bluetooth back on so that Android can operate
  // (iOS does not require separate call to operate since
  // killConnections is more like a single-shot thing).

    if (platform.isAndroid) {
      var networkChangeHandler = function(networkChangedValue) {
        if (networkChangedValue.bluetoothLowEnergy &&
          networkChangedValue.bluetooth) {
          thaliMobileNativeWrapper.emitter.removeListener('networkChangedNonTCP',
         networkChangeHandler);
          endToEndWithStateCheck(t);
        }
      };
      thaliMobileNativeWrapper.emitter.on('networkChangedNonTCP',
      networkChangeHandler);

      t.pass('Turning bluetooth on');
      testUtils.toggleBluetooth(true);
    } else {
      endToEndWithStateCheck(t);
    }
  });

test('will fail bad PSK connection between peers', function (t) {
  // #1587
  // trivialBadEndtoEndTest(t, true);
  // TODO: Re-enable and fix
  t.ok(true, 'FIX ME, PLEASE!!!');
  t.end();
});

test('We provide notification when a listener dies and we recreate it',
  testUtils.skipOnIOS,
  function (t) {
    var recreatedPort = null;
    trivialEndToEndTest(t, function (peerId) {
      function recreatedHandler(record) {
        t.equal(record.peerIdentifier, peerId, 'same ids');
        recreatedPort = record.portNumber;
      }

      thaliMobileNativeWrapper._getServersManager()
        .on('listenerRecreatedAfterFailure', recreatedHandler);

      function exit() {
        thaliMobileNativeWrapper._getServersManager()
          .removeListener('listenerRecreatedAfterFailure', recreatedHandler);
        thaliMobileNativeWrapper.emitter
          .removeListener('nonTCPPeerAvailabilityChangedEvent',
            nonTCPAvailableHandler);
        t.end();
      }

      function nonTCPAvailableHandler(record) {
        // TODO:
        // There is a race condition when this test is ran on Android:
        // This function is called just before recreatedHandler leading
        // to recreatedPort being null.
        // Re-enable the check below once #719 is fixed.
        // Note that due to other changes we also need to add in a test to
        // make sure we are looking at an event for the right peerID
        /* if (!recreatedPort ||
          recreatedPort && record.portNumber !== recreatedPort) {
          logger.debug('No recreated port or port numbers do not match: '
            + record.portNumber + ' !== ' + recreatedPort);
          return;
        }*/
      }

      thaliMobileNativeTestUtils.getSamePeerWithRetry(testPath, pskIdentity, pskKey, peerId)
        .then(function (response) {
          t.equal(response.httpResponseBody, testData,
            'recreate - response body should match testData');
          exit();
        })
        .catch(function (error) {
          t.fail('fail in recreate test - ' + error);
          exit();
        });

      thaliMobileNativeWrapper.emitter.on('nonTCPPeerAvailabilityChangedEvent',
        nonTCPAvailableHandler);

      t.pass('About to destroy connection to peer');

      try {
        thaliMobileNativeWrapper._getServersManager().
          _peerServers[peerId].server._mux.destroy();
      } catch (err) {
        t.fail('destroy failed with - ' + err);
        exit();
      }
    });
  });

test('We fire nonTCPPeerAvailabilityChangedEvent with the same generation ' +
  'and different port when listener is recreated',
  function () {
    // #1597
    // FIXME: it looks like this test expects native layer to repeat
    // peerAvailabilityChanged events but it doesn't work this way anymore
    return true;
    // return platform.isIOS
  },
  tape.sinonTest(function (t) {
    trivialEndToEndTest(t, function (peerId) {
      var beforeRecreatePeer = null;
      var afterRecreatePeer = null;
      var isKilled = false;
      var serversManager = thaliMobileNativeWrapper._getServersManager();
      var smEmitSpy = this.spy(serversManager, 'emit');

      function finishTest() {
        t.ok(isKilled, 'mux must be destroyed');
        t.ok(beforeRecreatePeer, 'peer tracked before recreating');
        t.ok(afterRecreatePeer, 'peer tracked after recreating');
        t.equal(typeof beforeRecreatePeer.generation, 'number');
        t.equal(typeof afterRecreatePeer.generation, 'number');
        t.equal(
          beforeRecreatePeer.generation,
          afterRecreatePeer.generation,
          'the same generation before and after listener recreating'
        );

        var emittedRecreateEventForCurrentPeer =
          smEmitSpy.args.some(function (callArgs) {
            var eventName = callArgs[0];
            var announcement = callArgs[1];
            return (
              eventName === 'listenerRecreatedAfterFailure' &&
              announcement.peerIdentifier === peerId
            );
          });

        t.ok(smEmitSpy.callCount, 'servers manager emitted at least one event');
        t.ok(
          emittedRecreateEventForCurrentPeer,
          'servers manager emitted recreate event for our peer'
        );

        thaliMobileNativeWrapper.emitter.removeListener(
          'nonTCPPeerAvailabilityChangedEvent',
          nonTCPAvailableHandler
        );
        t.end();
      }

      function killMux() {
        if (isKilled) {
          return;
        }
        isKilled = true;
        try {
          serversManager._peerServers[peerId].server._mux.destroy();
        } catch (err) {
          t.fail('destroy failed with - ' + err);
          finishTest();
        }
      }

      function nonTCPAvailableHandler(peer) {
        if (peer.peerIdentifier !== peerId || peer.portNumber === null) {
          return;
        }
        if (!isKilled) {
          beforeRecreatePeer = peer;
          killMux();
        } else {
          afterRecreatePeer = peer;
          finishTest();
        }
      }

      thaliMobileNativeWrapper.emitter
        .on('nonTCPPeerAvailabilityChangedEvent', nonTCPAvailableHandler);
    });
  })
);
