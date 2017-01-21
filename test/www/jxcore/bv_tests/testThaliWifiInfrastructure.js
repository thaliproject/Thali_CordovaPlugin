'use strict';

// Issue #419
var ThaliMobile = require('thali/NextGeneration/thaliMobile');
if (global.NETWORK_TYPE === ThaliMobile.networkTypes.NATIVE) {
  return;
}

var https = require('https');
var net = require('net');

var nodessdp = require('node-ssdp');
var express = require('express');
var uuid = require('uuid');
var sinon = require('sinon');
var randomstring = require('randomstring');
var Promise = require('bluebird');

var platform = require('thali/NextGeneration/utils/platform');
var ThaliWifiInfrastructure = require('thali/NextGeneration/thaliWifiInfrastructure');
var ThaliMobileNativeWrapper = require('thali/NextGeneration/thaliMobileNativeWrapper');
var thaliConfig = require('thali/NextGeneration/thaliConfig');
var tape = require('../lib/thaliTape');
var testUtils = require('../lib/testUtils.js');
var USN = require('thali/NextGeneration/utils/usn');


var wifiInfrastructure = new ThaliWifiInfrastructure();

var pskIdentity = 'I am an id!';
var pskKey = new Buffer('And I am a secret!!!!');

var pskIdToSecret = function (id) {
  return id === pskIdentity ? pskKey : null;
};

var pskIdToSecretHolder = function (id) {
  return pskIdToSecret(id);
};

var test = tape({
  setup: function (t) {
    wifiInfrastructure.start(express.Router(), pskIdToSecretHolder)
      .then(function () {
        t.equals(wifiInfrastructure._getCurrentState().started, true,
          'should be in started state');
        t.end();
      });
  },
  teardown: function (t) {
    // Stop everything at the end of tests to make sure
    // the next test starts from clean state
    wifiInfrastructure.stop().then(function () {
      t.equals(wifiInfrastructure._getCurrentState().started, false,
        'should not be in started state');
      t.end();
    });
  }
});

var testSeverHostAddress = randomstring.generate({
  charset: 'hex', // to get lowercase chars for the host address
  length: 8
});
var testServerPort = 8080;
var createTestServer = function (peerIdentifier) {
  var testLocation = 'http://' + testSeverHostAddress + ':' + testServerPort;
  var testServer = new nodessdp.Server({
    location: testLocation,
    ssdpIp: thaliConfig.SSDP_IP,
    udn: thaliConfig.SSDP_NT,
    adInterval: thaliConfig.SSDP_ADVERTISEMENT_INTERVAL
  });
  var usn = USN.stringify({
    peerIdentifier: peerIdentifier,
    generation: 0
  });
  testServer.setUSN(usn);
  return testServer;
};

test('After #startListeningForAdvertisements call should listen to SSDP ' +
'advertisements and emit wifiPeerAvailabilityChanged events', function (t) {
  var peerIdentifier = uuid.v4();
  var testServer = createTestServer(peerIdentifier);

  var peerUnavailableListener = function (peer) {
    if (peer.peerIdentifier !== peerIdentifier) {
      return;
    }
    t.equal(peer.generation, 0, 'generation should be 0');
    t.equal(peer.hostAddress, null, 'host address should be null');
    t.equal(peer.portNumber, null, 'port should should be null');
    wifiInfrastructure.removeListener('wifiPeerAvailabilityChanged',
      peerUnavailableListener);
    t.end();
  };

  var peerAvailableListener = function (peer) {
    if (peer.hostAddress !== testSeverHostAddress) {
      return;
    }
    t.equal(peer.peerIdentifier, peerIdentifier,
      'peer identifier should match');
    t.equal(peer.generation, 0, 'generation should be 0');
    t.equal(peer.hostAddress, testSeverHostAddress,
      'host address should match');
    t.equal(peer.portNumber, testServerPort, 'port should match');
    wifiInfrastructure.removeListener('wifiPeerAvailabilityChanged',
      peerAvailableListener);

    wifiInfrastructure.on('wifiPeerAvailabilityChanged',
      peerUnavailableListener);
    testServer.stop(function () {
      // When server is stopped, it shold trigger the byebye messages
      // that emit the wifiPeerAvailabilityChanged that we listen above.
    });
  };

  wifiInfrastructure.on('wifiPeerAvailabilityChanged', peerAvailableListener);

  testServer.start(function () {
    wifiInfrastructure.startListeningForAdvertisements()
    .catch(function (error) {
      t.fail('failed to start listening with error: ' + error);
      testServer.stop(function () {
        t.end();
      });
    });
  });
});

test('#startUpdateAdvertisingAndListening correctly updates USN',
function(t) {
  var firstUuid = null;
  wifiInfrastructure.startUpdateAdvertisingAndListening().then(function () {
    // first invocation - generate new UUID and set 0 generation
    var peer = wifiInfrastructure._getCurrentPeer();
    firstUuid = peer.peerIdentifier;
    t.deepEqual(peer, {
      peerIdentifier: firstUuid,
      generation: 0
    }, 'first invocation sets 0 generation');
    return wifiInfrastructure.startUpdateAdvertisingAndListening();
  }).then(function () {
    // second invocation - use the same UUID and increment generation
    var peer = wifiInfrastructure._getCurrentPeer();
    t.deepEqual(peer, {
      peerIdentifier: firstUuid,
      generation: 1
    }, 'second invocation doesn’t change UUID but increments generation');
    return wifiInfrastructure.startUpdateAdvertisingAndListening();
  }).then(function () {
    // third invocation - the same as the second one
    var peer = wifiInfrastructure._getCurrentPeer();
    t.deepEqual(peer, {
      peerIdentifier: firstUuid,
      generation: 2
    }, 'third invocation doesn’t change UUID but increments generation');
    t.end();
  }).catch(t.end);
});

test('#startUpdateAdvertisingAndListening generates new peerIdentifier after ' +
'#stopAdvertisingAndListening has been called', function (t) {
  var firstUuid = null;
  var secondUuid = null;
  wifiInfrastructure.startUpdateAdvertisingAndListening().then(function () {
    firstUuid = wifiInfrastructure._getCurrentPeer().peerIdentifier;
    return wifiInfrastructure.stopAdvertisingAndListening();
  }).then(function () {
    return wifiInfrastructure.startUpdateAdvertisingAndListening();
  }).then(function () {
    secondUuid = wifiInfrastructure._getCurrentPeer().peerIdentifier;
    t.notEqual(secondUuid, firstUuid, 'new UUID after advertising is stopped');
    t.end();
  }).catch(t.end);
});

test('#startUpdateAdvertisingAndListening sends correct requests', function (t) {
  var testClient = new nodessdp.Client({
    ssdpIp: thaliConfig.SSDP_IP
  });

  var ourUSN = null;
  var aliveCalled = false;
  var byeCalled = false;

  function finishTest() {
    testClient.stop();
    t.equals(aliveCalled, true, 'advertise-alive fired with expected usn');
    t.equals(byeCalled, true, 'advertise-bye fired with expected usn');
    t.end();
  }

  testClient.on('advertise-alive', function (data) {
    // Check for the Thali NT in case there is some other
    // SSDP traffic in the network.
    if (data.NT !== thaliConfig.SSDP_NT || data.USN !== ourUSN) {
      return;
    }
    aliveCalled = true;
    wifiInfrastructure.stopAdvertisingAndListening();
  });

  testClient.on('advertise-bye', function (data) {
    // Check for the Thali NT in case there is some other
    // SSDP traffic in the network.
    if (data.NT !== thaliConfig.SSDP_NT || data.USN !== ourUSN) {
      return;
    }
    byeCalled = true;

    finishTest();
  });

  testClient.start(function () {
    // This is the first call to the update function after which
    // some USN value should be advertised.
    wifiInfrastructure.startUpdateAdvertisingAndListening().then(function () {
      ourUSN = USN.stringify(wifiInfrastructure._getCurrentPeer());
    });
  });
});

test('messages with invalid location or USN should be ignored', function (t) {
  var usn = USN.stringify({
    peerIdentifier: uuid.v4(),
    generation: 0
  });
  var testMessage = {
    NT: thaliConfig.SSDP_NT,
    USN: usn,
    LOCATION: 'http://foo.bar:90000'
  };
  var handledMessage = wifiInfrastructure.listener
    ._handleMessage(testMessage, true);
  t.equals(handledMessage, false, 'should not have emitted with invalid port');
  testMessage.USN = 'foobar';
  testMessage.LOCATION = 'http://foo.bar:50000';
  handledMessage = wifiInfrastructure.listener
    ._handleMessage(testMessage, true);
  t.equals(handledMessage, false, 'should not have emitted with invalid USN');
  t.end();
});

test('Delayed own message are still ignored after advertisement has been ' +
'toggled on and off several times', function (t) {
  var sandbox = sinon.sandbox.create();

  var HISTORY_SIZE = 4;
  sandbox.stub(thaliConfig, 'SSDP_OWN_PEERS_HISTORY_SIZE', HISTORY_SIZE);

  function captureMessages (callback) {
    var captureSize = HISTORY_SIZE * 2; // capture both alive and bye messages
    var captureClient = new nodessdp.Client({
      ssdpIp: thaliConfig.SSDP_IP
    });
    var capturedMessages = [];

    sandbox.stub(
      wifiInfrastructure._getSSDPServer(),
      '_send',
      function (message) {
        // _parseMessage fires 'advertise-alive/bye' events
        captureClient._parseMessage(message);

        var callback = arguments[arguments.length - 1];
        if (typeof callback === 'function') {
          setImmediate(callback);
        }
      }
    );

    captureClient.on('advertise-alive', function (data) {
      capturedMessages.push(data);
      wifiInfrastructure.stopAdvertisingAndListening();
    });

    captureClient.on('advertise-bye', function (data) {
      capturedMessages.push(data);
      if (capturedMessages.length < captureSize) {
        wifiInfrastructure.startUpdateAdvertisingAndListening();
      } else {
        // use last `captureSize` messages
        callback(capturedMessages.slice(-captureSize));
      }
    });

    wifiInfrastructure.startUpdateAdvertisingAndListening();
  }

  captureMessages(function (messages) {
    sandbox.restore();
    var allMessagesIgnored = messages.every(function (message) {
      return !wifiInfrastructure.listener._handleMessage(message);
    });
    t.ok(allMessagesIgnored, 'all captured messages are not handled');
    t.end();
  });
});

test('verify that Thali-specific messages are filtered correctly',
function (t) {
  var usn = USN.stringify({
    peerIdentifier: uuid.v4(),
    generation: 4
  });

  var irrelevantNTMessage = {
    NT: 'foobar',
    USN: usn
  };
  t.equal(
    wifiInfrastructure.listener._shouldBeIgnored(irrelevantNTMessage),
    true,
    'messages with irrelevant NT should be ignored'
  );

  // own messages tested later

  var relevantMessage = {
    NT: thaliConfig.SSDP_NT,
    USN: usn
  };
  t.equal(
    wifiInfrastructure.listener._shouldBeIgnored(relevantMessage),
    false,
    'relevant messages should not be ignored'
  );

  t.end();
});

var testFunctionBeforeStart = function (t, functionName) {
  wifiInfrastructure.stop()
  .then(function () {
    return wifiInfrastructure[functionName]();
  })
  .catch(function (error) {
    t.equal(error.message, 'Call Start!', 'specific error should be returned');
    t.end();
  });
};

test('#startListeningForAdvertisements should fail if start not called',
function (t) {
  testFunctionBeforeStart(t, 'startListeningForAdvertisements');
});

test('#startUpdateAdvertisingAndListening should fail if start not called',
function (t) {
  testFunctionBeforeStart(t, 'startUpdateAdvertisingAndListening');
});

test('#start should fail if called twice in a row', function (t) {
  // The start here is already the second since it is being
  // done once in the setup phase
  wifiInfrastructure.start(express.Router())
  .then(function () {
    t.fail('call should not succeed');
    t.end();
  })
  .catch(function (error) {
    t.equal(error.message, 'Call Stop!', 'specific error should be received');
    t.end();
  });
});

test('should not be started after stop is called', function (t) {
  wifiInfrastructure.stop().then(function () {
    var currentState = wifiInfrastructure._getCurrentState();
    var targetState = wifiInfrastructure._getTargetState();
    t.notOk(currentState.started, 'should not be started');
    t.notOk(currentState.listening, 'should not be listening');
    t.notOk(currentState.advertising, 'should not be advertising');
    t.notOk(targetState.listening, 'should not target listening');
    t.notOk(targetState.advertising, 'should not target advertising');
    t.end();
  });
});

test('#startUpdateAdvertisingAndListening should fail invalid router has ' +
'been passed', function (t) {
  wifiInfrastructure.stop()
  .then(function () {
    return wifiInfrastructure.start('invalid router object');
  })
  .then(function () {
    return wifiInfrastructure.startUpdateAdvertisingAndListening();
  })
  .catch(function (error) {
    t.equal(error.message, 'Bad Router', 'specific error should be received');
    t.end();
  });
});

test('#startUpdateAdvertisingAndListening should fail if router server ' +
'starting fails', function (t) {
  // Save the old port so that it can be reassigned after the test.
  var oldPort = wifiInfrastructure.advertiser.routerServerPort;
  // Create a test server that is used to block the port
  // onto which the router server is tried to be started.
  var testServer = net.createServer(function () {
    // NOOP
  });
  testServer.listen(0, function () {
    var testServerPort = testServer.address().port;
    // Set the port to be the same on which we already
    // have our test server running. This should
    // create a failure when trying to start the router
    // server on the same port.
    wifiInfrastructure.advertiser.routerServerPort = testServerPort;
    wifiInfrastructure.startUpdateAdvertisingAndListening()
    .catch(function (error) {
      t.equals(error.message, 'Unspecified Error with Radio infrastructure',
        'specific error expected');
      wifiInfrastructure.advertiser.routerServerPort = oldPort;
      testServer.close(function () {
        t.end();
      });
    });
  });
});

test('#startUpdateAdvertisingAndListening should start hosting given router ' +
'object', function (t) {
  var router = express.Router();
  var testPath = '/test';
  router.get(testPath, function (req, res) {
    res.send('foobar');
  });
  wifiInfrastructure.stop()
  .then(function () {
    return wifiInfrastructure.start(router, pskIdToSecret);
  })
  .then(function () {
    return wifiInfrastructure.startUpdateAdvertisingAndListening();
  })
  .then(function () {
    https.get({
      path: testPath,
      port: wifiInfrastructure.advertiser.routerServerPort,
      agent: false, // to prevent connection keep-alive,
      pskIdentity: pskIdentity,
      pskKey: pskKey
    }, function (res) {
      t.equal(res.statusCode, 200, 'server should respond with code 200');
      t.end();
    });
  });
});

test('#startUpdateAdvertisingAndListening bad psk should be rejected ' +
'object', function (t) {
  var router = express.Router();
  var testPath = '/test';
  router.get(testPath, function (req, res) {
    res.send('foobar');
  });
  wifiInfrastructure.stop()
    .then(function () {
      return wifiInfrastructure.start(router, function () { return null; });
    })
    .then(function () {
      return wifiInfrastructure.startUpdateAdvertisingAndListening();
    })
    .then(function () {
      var httpRequest = https.get({
        path: testPath,
        port: wifiInfrastructure.advertiser.routerServerPort,
        agent: false, // to prevent connection keep-alive,
        pskIdentity: pskIdentity,
        pskKey: pskKey
      }, function () {
        t.fail('connection should have been rejected');
        t.end();
      });
      httpRequest.on('error', function (err) {
        t.equal(err.message, 'socket hang up', 'Connection should be rejected');
        t.end();
      });
    });
});

test('#stop can be called multiple times in a row', function (t) {
  wifiInfrastructure.stop()
  .then(function () {
    var currentState = wifiInfrastructure._getCurrentState();
    t.equal(currentState.started, false, 'should be in stopped state');
    return wifiInfrastructure.stop();
  })
  .then(function () {
    var currentState = wifiInfrastructure._getCurrentState();
    t.equal(currentState.started, false, 'should still be in stopped state');
    t.end();
  });
});

test('#startListeningForAdvertisements can be called multiple times in a row',
function (t) {
  wifiInfrastructure.startListeningForAdvertisements()
  .then(function () {
    t.equal(wifiInfrastructure._getCurrentState().listening, true,
      'should be in listening state');
    return wifiInfrastructure.startListeningForAdvertisements();
  })
  .then(function () {
    t.equal(wifiInfrastructure._getCurrentState().listening, true,
      'should still be in listening state');
    t.end();
  });
});

test('#stopListeningForAdvertisements can be called multiple times in a row',
function (t) {
  wifiInfrastructure.stopListeningForAdvertisements()
  .then(function () {
    t.equal(wifiInfrastructure._getCurrentState().listening, false,
      'should not be in listening state');
    return wifiInfrastructure.stopListeningForAdvertisements();
  })
  .then(function () {
    t.equal(wifiInfrastructure._getCurrentState().listening, false,
      'should still not be in listening state');
    t.end();
  });
});

test('#stopAdvertisingAndListening can be called multiple times in a row',
function (t) {
  wifiInfrastructure.stopAdvertisingAndListening()
  .then(function () {
    t.equal(wifiInfrastructure._getCurrentState().advertising, false,
      'should not be in advertising state');
    return wifiInfrastructure.stopAdvertisingAndListening();
  })
  .then(function () {
    t.equal(wifiInfrastructure._getCurrentState().advertising, false,
      'should still not be in advertising state');
    t.end();
  });
});

test('calls correct starts when network changes',
  function () {
    return !platform.isAndroid;
  },
  function (t) {
    var listeningStartSpy =
      sinon.spy(wifiInfrastructure.listener, 'start');
    var advertisingStartSpy =
      sinon.spy(wifiInfrastructure.advertiser, 'start');

    testUtils.ensureWifi(false)
      .then(function () {
        var validateStartResult = function (promise) {
          return promise
            .then(function () {
              t.fail('Should fail');
            })
            .catch(function (error) {
              t.equals(error.message, 'Radio Turned Off',
                'specific error expected');
            });
        };
        var listen = validateStartResult(
          wifiInfrastructure.startListeningForAdvertisements()
        );
        var advertise = validateStartResult(
          wifiInfrastructure.startUpdateAdvertisingAndListening()
        );
        return Promise.all([listen, advertise]);
      })
      .then(function () {
        listeningStartSpy.reset();
        advertisingStartSpy.reset();
        return testUtils.ensureWifi(true);
      })
      .then(function () {
        return wifiInfrastructure._promiseQueue.enqueue(function (resolve) {
          // There are two possible real world scenarios:
          // 1. device connects to another wifi network (new SSID). In this
          //    case 2 events are fired: the first one with wifi:on and
          //    without bssid, the second one with wifi:on and with new bssid
          //    and ssid.
          // 2. device moves to another access point in the same wifi network.
          //    in this case only one change event is emitted with updated
          //    bssidName
          // We are going to assume that it was emitted at least once
          t.ok(listeningStartSpy.called,
            'listening started at least once');
          t.ok(advertisingStartSpy.called,
            'advertising started at least once');
          resolve();
        });
      })
      .catch(function (err) {
        t.fail(err);
      })
      .then(function () {
        listeningStartSpy.restore();
        advertisingStartSpy.restore();
        t.end();
      });
  }
);

test('does not get peer changes from self', function (t) {
  var knownOwnPeerIdentifiers = [];

  var peerChangedListener = function (peer) {
    t.equal(
      knownOwnPeerIdentifiers.indexOf(peer.peerIdentifier),
      -1,
      'we should not get notified about any USN that we have used'
    );
  };

  wifiInfrastructure.on('wifiPeerAvailabilityChanged', peerChangedListener);

  wifiInfrastructure.startListeningForAdvertisements().then(function () {
    return wifiInfrastructure.startUpdateAdvertisingAndListening();
  }).then(function () {
    var peerId = wifiInfrastructure._getCurrentPeer().peerIdentifier;
    knownOwnPeerIdentifiers.push(peerId);
    return Promise.delay(thaliConfig.SSDP_ADVERTISEMENT_INTERVAL * 2);
  }).then(function () {
    return wifiInfrastructure.startUpdateAdvertisingAndListening();
  }).then(function () {
    var peerId = wifiInfrastructure._getCurrentPeer().peerIdentifier;
    knownOwnPeerIdentifiers.push(peerId);
    return Promise.delay(thaliConfig.SSDP_ADVERTISEMENT_INTERVAL * 2);
  }).then(function () {
    wifiInfrastructure.removeListener(
      'wifiPeerAvailabilityChanged',
      peerChangedListener
    );
    t.end();
  }).catch(function (err) {
    t.fail('test failed');
    t.end(err);
  });
});

test('Make sure we turn on and off the Android multicast locks',
  function () {
    return !platform.isAndroid;
  },
  function (t) {
    var lockSpy = sinon.spy(ThaliMobileNativeWrapper,
      'lockAndroidWifiMulticast');
    var unlockSpy = sinon.spy(ThaliMobileNativeWrapper,
      'unlockAndroidWifiMulticast');
    wifiInfrastructure.startListeningForAdvertisements()
      .then(function () {
        t.equals(lockSpy.callCount, 1, 'We have locked');
        t.equals(unlockSpy.callCount, 0, 'We have not unlocked');
        return wifiInfrastructure.stopListeningForAdvertisements();
      })
      .then(function () {
        t.equals(lockSpy.callCount, 1, 'No new locks');
        t.equals(unlockSpy.callCount, 1, 'We unlocked');
      })
      .catch(function (err) {
        t.fail(err);
      })
      .then(function () {
        t.end();
      });
  });

test('Make sure we do not use Android locks when we are not on Android',
  function () {
    return platform.isAndroid;
  },
  function (t) {
    var lockSpy = sinon.spy(ThaliMobileNativeWrapper,
      'lockAndroidWifiMulticast');
    var unlockSpy = sinon.spy(ThaliMobileNativeWrapper,
      'unlockAndroidWifiMulticast');
    wifiInfrastructure.startListeningForAdvertisements()
      .then(function () {
        t.equals(lockSpy.callCount, 0, 'We have no lock');
        t.equals(unlockSpy.callCount, 0, 'We have not unlocked');
        return wifiInfrastructure.stopListeningForAdvertisements();
      })
      .then(function () {
        t.equals(lockSpy.callCount, 0, 'Still no lock');
        t.equals(unlockSpy.callCount, 0, 'Still not unlocked');
      })
      .catch(function (err) {
        t.fail(err);
      })
      .then(function () {
        t.end();
      });
  });

test('functions are run from a queue in the right order', function (t) {
  var firstSpy = sinon.spy();
  var secondSpy = sinon.spy();
  var thirdSpy = sinon.spy();
  wifiInfrastructure.startUpdateAdvertisingAndListening().then(firstSpy);
  wifiInfrastructure.stop().then(secondSpy);

  wifiInfrastructure.start()
  .then(function () {
    thirdSpy();
    t.ok(firstSpy.calledBefore(secondSpy) &&
         secondSpy.calledBefore(thirdSpy),
         'call order must match');
    t.end();
  });
});

// From here onwards, tests only work on mocked up desktop
// environment where network changes can be simulated.
if (platform._isRealMobile) {
  return;
}

test('network changes are ignored while stopping', function (t) {
  var realNetworkStatus = null;
  var wifiOffNetworkStatus = {
    wifi: 'off',
  };
  var spy = null;
  wifiInfrastructure.startListeningForAdvertisements()
    .then(function () {
      return ThaliMobileNativeWrapper.getNonTCPNetworkStatus();
    })
    .then(function (networkStatus) {
      realNetworkStatus = networkStatus;
      wifiInfrastructure._isStarted = false;
      spy = sinon.spy(wifiInfrastructure, 'startListeningForAdvertisements');
      ThaliMobileNativeWrapper.emitter
        .emit('networkChangedNonTCP', wifiOffNetworkStatus);
      ThaliMobileNativeWrapper.emitter
        .emit('networkChangedNonTCP', realNetworkStatus);
      return Promise.delay(0);
    }).then(function () {
      t.equals(spy.callCount, 0, 'should not be called');
      wifiInfrastructure.startListeningForAdvertisements.restore();
      wifiInfrastructure._isStarted = true;
      t.end();
    });
});

var tryStartingFunctionWhileWifiOff = function (t, functionName, keyName) {
  wifiInfrastructure.stop()
  .then(function () {
    testUtils.toggleWifi(false);
    ThaliMobileNativeWrapper.emitter.once('networkChangedNonTCP',
    function (networkChangedValue) {
      t.equals(networkChangedValue.wifi, 'off', 'wifi should be off');
      wifiInfrastructure.start(express.Router())
      .then(function () {
        return wifiInfrastructure[functionName]();
      })
      .then(function () {
        t.fail('the call should not succeed');
        t.end();
      })
      .catch(function (error) {
        t.equals(error.message, 'Radio Turned Off', 'specific error expected');
        wifiInfrastructure.once('discoveryAdvertisingStateUpdateWifiEvent',
        function (discoveryAdvertisingStateUpdateValue) {
          t.equals(discoveryAdvertisingStateUpdateValue[keyName], true,
            keyName + ' should be true');
          t.end();
        });
        testUtils.toggleWifi(true);
      });
    });
  });
};

test('#startListeningForAdvertisements returns error if wifi is off and ' +
'fires event when on', function (t) {
  tryStartingFunctionWhileWifiOff(t, 'startListeningForAdvertisements',
    'discoveryActive');
});

test('#startUpdateAdvertisingAndListening returns error if wifi is off and ' +
'fires event when on', function (t) {
  tryStartingFunctionWhileWifiOff(t, 'startUpdateAdvertisingAndListening',
    'advertisingActive');
});

test('when wifi is enabled discovery is activated and peers become available',
function (t) {
  ThaliMobileNativeWrapper.emitter.once('networkChangedNonTCP',
  function (networkChangedValue) {
    t.equals(networkChangedValue.wifi, 'off', 'wifi should be off');
    var peerIdentifier = uuid.v4();
    var testServer = createTestServer(peerIdentifier);
    testServer.start(function () {
      wifiInfrastructure.startListeningForAdvertisements()
      .catch(function (error) {
        t.equals(error.message, 'Radio Turned Off', 'specific error expected');

        var peerAvailableListener = function (peer) {
          if (peer.peerIdentifier !== peerIdentifier) {
            return;
          }

          t.equal(peer.peerIdentifier, peerIdentifier,
                  'peer identifier should match');
          t.equal(peer.hostAddress, testSeverHostAddress,
                  'host address should match');
          t.equal(peer.portNumber, testServerPort,
                  'port should match');

          wifiInfrastructure.removeListener('wifiPeerAvailabilityChanged',
                                            peerAvailableListener);
          testServer.stop(function () {
            t.end();
          });
        };

        wifiInfrastructure.on('wifiPeerAvailabilityChanged',
                              peerAvailableListener);
        testUtils.toggleWifi(true);
      });
    });
  });
  testUtils.toggleWifi(false);
});
