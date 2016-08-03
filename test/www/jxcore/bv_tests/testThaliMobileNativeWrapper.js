'use strict';

var express = require('express');
var net = require('net');
var Promise = require('lie');
var sinon = require('sinon');
var testUtils = require('../lib/testUtils.js');

if (typeof Mobile === 'undefined') {
  return;
}

var thaliMobileNativeWrapper = require('thali/NextGeneration/thaliMobileNativeWrapper');
var validations = require('thali/validations');
var tape = require('../lib/thaliTape');

var test = tape({
  setup: function (t) {
    // Make sure right handlers are registered in case
    // some other test has overwritten them.
    thaliMobileNativeWrapper._registerToNative();
    t.end();
  },
  teardown: function (t) {
    thaliMobileNativeWrapper.stop()
    .then(function () {
      t.equals(thaliMobileNativeWrapper._isStarted(), false,
        'must be stopped');
      t.end();
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
function trivialEndToEndTestScaffold(t, needManualNotify,
                                     pskIdtoSecret, pskIdentity, pskKey,
                                     testData, callback) {
  var router = express.Router();
  router.get(testPath, function (req, res) {
    res.send(testData);
  });

  var end = function (peerId, fail) {
    callback ? callback(peerId, fail) : t.end();
  };

  testUtils.getSamePeerWithRetry(testPath, pskIdentity, pskKey)
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
    })
    .then(function () {
      if (needManualNotify) {
        Mobile.wifiPeerAvailabilityChanged('foo');
      }
    });
}

var pskIdentity = 'I am me!';
var pskKey = new Buffer('I am a reasonable long string');
var testData = 'foobar';
function trivialEndToEndTest(t, needManualNotify, callback) {
  function pskIdToSecret(id) {
    t.equal(id, pskIdentity, 'Should only get expected id');
    return id === pskIdentity ? pskKey : null;
  }

  trivialEndToEndTestScaffold(t, needManualNotify,
    pskIdToSecret, pskIdentity, pskKey, testData, callback);
}

function trivialBadEndToEndTest(t, needManualNotify, callback) {
  var pskIdentity = 'Yo ho ho';
  var pskKey = new Buffer('It really does not matter');
  var testData = 'Not important';

  function pskIdToSecret() {
    return null;
  }

  trivialEndToEndTestScaffold(t, needManualNotify,
    pskIdToSecret, pskIdentity, pskKey, testData, callback);
}

var connectionTester = function (port, callback) {
  var returned = false;
  var connection = net.createConnection(port, function () {
    connection.destroy();
    if (!returned) {
      returned = true;
      callback(true);
    }
  });
  connection.on('error', function () {
    connection.destroy();
    if (!returned) {
      returned = true;
      callback(false);
    }
  });
};

test('all services are stopped when we call stop', function (t) {
  var stopped = false;
  var serversManagerLocalPort = 0;
  var routerServerPort = 0;
  var stopAndCheck = function () {
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
          connectionTester(
            serversManagerLocalPort,
            function (success) {
              t.equals(success, false,
                'connection to servers manager should fail after stopping');
              connectionTester(
                routerServerPort,
                function () {
                  t.equals(success, false,
                    'connection to router server should fail after stopping');
                  t.end();
                }
              );
            }
          );
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
  };
  thaliMobileNativeWrapper.start(express.Router())
  .then(function () {
    return thaliMobileNativeWrapper.startListeningForAdvertisements();
  })
  .then(function () {
    return thaliMobileNativeWrapper.startUpdateAdvertisingAndListening();
  })
  .then(function () {
    serversManagerLocalPort =
      thaliMobileNativeWrapper._getServersManagerLocalPort();
    routerServerPort =
      thaliMobileNativeWrapper._getRouterServerPort();
    connectionTester(
      serversManagerLocalPort,
      function (success) {
        t.equals(success, true,
          'connection to servers manager should succeed after starting');
        connectionTester(
          routerServerPort,
          function () {
            t.equals(success, true,
              'connection to router server should succeed after starting');
            stopAndCheck();
          }
        );
      }
    );
  });
});

var verifyCallWithArguments = function (t, callName, parameters) {
  var mockServersManager = {};
  var spy = sinon.spy();
  mockServersManager[callName] = function () {
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

test('make sure terminateConnection is properly hooked up', function (t) {
  verifyCallWithArguments(t, 'terminateConnection', ['connection-id']);
});

test('make sure terminateListener is properly hooked up', function (t) {
  verifyCallWithArguments(t, 'terminateListener', ['peer-id', 8080]);
});

test('make sure we actually call kill connections properly', function (t) {
  thaliMobileNativeWrapper.killConnections()
  .then(function () {
    if (jxcore.utils.OSInfo().isAndroid) {
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
    if (jxcore.utils.OSInfo().isIOS) {
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

test('We repeat failedConnection event when we get it from ' +
  'thaliTcpServersManager',
  function (t) {
    thaliMobileNativeWrapper.start(express.Router())
    .then(function () {
      var peerIdentifier = 'some-identifier';
      var errorDescription = 'Dummy Error';
      thaliMobileNativeWrapper.emitter.once(
        'failedConnection',
        function (failedConnection) {
          t.equals(failedConnection.peerIdentifier, peerIdentifier,
            'peerIdentifier matches');
          t.equals(failedConnection.error.message, errorDescription,
            'error description matches');
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

if (!jxcore.utils.OSInfo().isMobile) {
  // This test primarily exists to make sure that we can easily debug the full
  // connection life cycle from the HTTP client through thaliMobileNativeWrapper
  // down through the mux layer down to mobile and back up all the way to the
  // HTTP server we are hosting for the user. Since it is just meant for
  // debugging it is only intended to be run on a desktop. So this test really
  // needs to stay not running when we are on mobile.
  test('can do HTTP requests between peers without coordinator', function (t) {
    trivialEndToEndTest(t, true);
  });

  test('make sure bad PSK connections fail', function (t) {
    //trivialBadEndtoEndTest(t, true);
    // TODO: Re-enable and fix
    t.ok(true, 'FIX ME, PLEASE!!!');
    t.end();
  });

  test('peer changes handled from a queue', function (t) {
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
            pleaseConnect: false
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

  test('relaying discoveryAdvertisingStateUpdateNonTCP', function (t) {
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
        routerPort = thaliMobileNativeWrapper._getServersManagerLocalPort();
        return thaliMobileNativeWrapper.startUpdateAdvertisingAndListening();
      })
      .then(function () {
        Mobile.fireIncomingConnectionToPortNumberFailed(routerPort);
      });
    }
  );
}

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
  trivialEndToEndTest(t, false, function () {
    t.equals(thaliMobileNativeWrapper._isStarted(), true, 'must be started');
    t.end();
  });
};

test('can do HTTP requests between peers', function (t) {
  endToEndWithStateCheck(t);
});

test('can still do HTTP requests between peers', function (t) {
  endToEndWithStateCheck(t);
});

// The connection cut is implemented as a separate test instead
// of doing it in the middle of the actual test so that the
// step gets coordinated between peers.
test('test to coordinate connection cut', function (t) {
  // This cuts connections on Android.
  testUtils.toggleBluetooth(false)
  .then(function () {
    // This cuts connections on iOS.
    return thaliMobileNativeWrapper.killConnections();
  })
  .then(function () {
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

  if (jxcore.utils.OSInfo().isAndroid) {
    var networkChangeHandler = function(networkChangedValue) {
      t.pass('Delete me - we got a network changed value ' + networkChangedValue);
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
  //trivialBadEndtoEndTest(t, true);
  // TODO: Re-enable and fix
  t.ok(true, 'FIX ME, PLEASE!!!');
  t.end();
});

test('We provide notification when a listener dies and we recreate it',
  function (t) {
    var recreatedPort = null;
    trivialEndToEndTest(t, false, function (peerId) {
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
        /*if (!recreatedPort ||
          recreatedPort && record.portNumber !== recreatedPort) {
          logger.debug('No recreated port or port numbers do not match: '
            + record.portNumber + ' !== ' + recreatedPort);
          return;
        }*/
      }

      testUtils.getSamePeerWithRetry(testPath, pskIdentity, pskKey, peerId)
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
