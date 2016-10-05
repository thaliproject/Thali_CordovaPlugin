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
        t.equals(wifiInfrastructure.states.started, true,
          'should be in started state');
        t.end();
      });
  },
  teardown: function (t) {
    // Stop everything at the end of tests to make sure
    // the next test starts from clean state
    wifiInfrastructure.stop().then(function () {
      t.equals(wifiInfrastructure.states.started, false,
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

test('After #startListeningForAdvertisements call ' +
  'wifiPeerAvailabilityChanged events should be emitted', function (t) {
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
    var peer = wifiInfrastructure.peer;
    firstUuid = peer.peerIdentifier;
    t.deepEqual(peer, {
      peerIdentifier: firstUuid,
      generation: 0
    }, 'first invocation sets 0 generation');
    return wifiInfrastructure.startUpdateAdvertisingAndListening();
  }).then(function () {
    // second invocation - use the same UUID and increment generation
    var peer = wifiInfrastructure.peer;
    t.deepEqual(peer, {
      peerIdentifier: firstUuid,
      generation: 1
    }, 'second invocation doesn’t change UUID but increments generation');
    return wifiInfrastructure.startUpdateAdvertisingAndListening();
  }).then(function () {
    // third invocation - the same as the second one
    var peer = wifiInfrastructure.peer;
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
    firstUuid = wifiInfrastructure.peer.peerIdentifier;
    return wifiInfrastructure.stopAdvertisingAndListening();
  }).then(function () {
    return wifiInfrastructure.startUpdateAdvertisingAndListening();
  }).then(function () {
    secondUuid = wifiInfrastructure.peer.peerIdentifier;
    t.notEqual(secondUuid, firstUuid, 'new UUID after advertising is stopped');
    t.end();
  }).catch(t.end);
});

test('#startUpdateAdvertisingAndListening sends correct requests', function (t) {
  var testClient = new nodessdp.Client();

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
    if (!wifiInfrastructure._isOwnMessage(data)) {
      return;
    }
    aliveCalled = true;
    wifiInfrastructure.stopAdvertisingAndListening();
  });

  testClient.on('advertise-bye', function (data) {
    // Check for the Thali NT in case there is some other
    // SSDP traffic in the network.
    if (!wifiInfrastructure._isOwnMessage(data)) {
      return;
    }
    byeCalled = true;

    finishTest();
  });

  testClient.start(function () {
    // This is the first call to the update function after which
    // some USN value should be advertised.
    wifiInfrastructure.startUpdateAdvertisingAndListening();
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
  var handledMessage = wifiInfrastructure._handleMessage(testMessage, true);
  t.equals(handledMessage, false, 'should not have emitted with invalid port');
  testMessage.USN = 'foobar';
  testMessage.LOCATION = 'http://foo.bar:50000';
  handledMessage = wifiInfrastructure._handleMessage(testMessage, true);
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
    var captureClient = new nodessdp.Client();
    var capturedMessages = [];

    sandbox.stub(
      wifiInfrastructure._server,
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
      return !wifiInfrastructure._handleMessage(message);
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
    wifiInfrastructure._shouldBeIgnored(irrelevantNTMessage),
    true,
    'messages with irrelevant NT should be ignored'
  );

  // own messages tested later

  var relevantMessage = {
    NT: thaliConfig.SSDP_NT,
    USN: usn
  };
  t.equal(
    wifiInfrastructure._shouldBeIgnored(relevantMessage),
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
    t.notOk(wifiInfrastructure.states.started, 'should not be started');
    t.notOk(wifiInfrastructure.states.listening.current,
      'should not be listening');
    t.notOk(wifiInfrastructure.states.listening.target,
      'should not target listening');
    t.notOk(wifiInfrastructure.states.advertising.current,
      'should not be advertising');
    t.notOk(wifiInfrastructure.states.advertising.target,
      'should not target advertising');
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
  var oldPort = wifiInfrastructure.routerServerPort;
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
    wifiInfrastructure.routerServerPort = testServerPort;
    wifiInfrastructure.startUpdateAdvertisingAndListening()
    .catch(function (error) {
      t.equals(error.message, 'Unspecified Error with Radio infrastructure',
        'specific error expected');
      wifiInfrastructure.routerServerPort = oldPort;
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
      port: wifiInfrastructure.routerServerPort,
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
        port: wifiInfrastructure.routerServerPort,
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
    t.equal(wifiInfrastructure.states.started, false, 'should be in stopped ' +
      'state');
    return wifiInfrastructure.stop();
  })
  .then(function () {
    t.equal(wifiInfrastructure.states.started, false, 'should still be in ' +
      'stopped state');
    t.end();
  });
});

test('#startListeningForAdvertisements can be called multiple times in a row',
function (t) {
  wifiInfrastructure.startListeningForAdvertisements()
  .then(function () {
    t.equal(wifiInfrastructure.states.listening.current, true,
      'should be in listening state');
    return wifiInfrastructure.startListeningForAdvertisements();
  })
  .then(function () {
    t.equal(wifiInfrastructure.states.listening.current, true,
      'should still be in listening state');
    t.end();
  });
});

test('#stopListeningForAdvertisements can be called multiple times in a row',
function (t) {
  wifiInfrastructure.stopListeningForAdvertisements()
  .then(function () {
    t.equal(wifiInfrastructure.states.listening.current, false,
      'should not be in listening state');
    return wifiInfrastructure.stopListeningForAdvertisements();
  })
  .then(function () {
    t.equal(wifiInfrastructure.states.listening.current, false,
      'should still not be in listening state');
    t.end();
  });
});

test('#stopAdvertisingAndListening can be called multiple times in a row',
function (t) {
  wifiInfrastructure.stopAdvertisingAndListening()
  .then(function () {
    t.equal(wifiInfrastructure.states.advertising.current, false,
      'should not be in advertising state');
    return wifiInfrastructure.stopAdvertisingAndListening();
  })
  .then(function () {
    t.equal(wifiInfrastructure.states.advertising.current, false,
      'should still not be in advertising state');
    t.end();
  });
});

test('functions are run from a queue in the right order', function (t) {
  var firstSpy = sinon.spy();
  var secondSpy = sinon.spy();
  var thirdSpy = sinon.spy();
  wifiInfrastructure.startUpdateAdvertisingAndListening()
  .then(function () {
    firstSpy();
  });
  wifiInfrastructure.stop()
  .then(function () {
    secondSpy();
  });
  wifiInfrastructure.start()
  .then(function () {
    thirdSpy();
    t.ok(firstSpy.calledBefore(secondSpy) &&
         secondSpy.calledBefore(thirdSpy),
         'call order must match');
    t.end();
  });
});

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
    knownOwnPeerIdentifiers.push(wifiInfrastructure.peer.peerIdentifier);
    return Promise.delay(thaliConfig.SSDP_ADVERTISEMENT_INTERVAL * 2);
  }).then(function () {
      return wifiInfrastructure.startUpdateAdvertisingAndListening();
  }).then(function () {
      knownOwnPeerIdentifiers.push(wifiInfrastructure.peer.peerIdentifier);
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

// From here onwards, tests only work on mocked up desktop
// environment where network changes can be simulated.
if (platform.isMobile) {
  return;
}

test('network changes are ignored while stopping', function (t) {
  wifiInfrastructure.startListeningForAdvertisements()
  .then(function () {
    wifiInfrastructure.states.stopping = true;
    var spy = sinon.spy(wifiInfrastructure, 'startListeningForAdvertisements');
    testUtils.toggleWifi(false)
    .then(function () {
      return testUtils.toggleWifi(true);
    })
    .then(function () {
      t.equals(spy.callCount, 0, 'should not be called');
      wifiInfrastructure.startListeningForAdvertisements.restore();
      t.end();
    });
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
