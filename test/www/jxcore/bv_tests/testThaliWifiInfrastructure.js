'use strict';

var ThaliWifiInfrastructure = require('thali/NextGeneration/thaliWifiInfrastructure');
var ThaliMobileNativeWrapper = require('thali/NextGeneration/thaliMobileNativeWrapper');
var ThaliConfig = require('thali/NextGeneration/thaliConfig');
var tape = require('../lib/thaliTape');
var testUtils = require('../lib/testUtils.js');
var nodessdp = require('node-ssdp');
var express = require('express');
var https = require('https');
var net = require('net');
var uuid = require('node-uuid');
var sinon = require('sinon');
var randomstring = require('randomstring');

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
    udn: ThaliConfig.SSDP_NT,
    adInterval: ThaliConfig.SSDP_ADVERTISEMENT_INTERVAL
  });
  testServer.setUSN(peerIdentifier);
  return testServer;
};

test('After #startListeningForAdvertisements call ' +
  'wifiPeerAvailabilityChanged events should be emitted', function (t) {
  var peerIdentifier = 'urn:uuid:' + uuid.v4();
  var testServer = createTestServer(peerIdentifier);
  var peerAvailableListener = function (peer) {
    if (peer.hostAddress !== testSeverHostAddress) {
      return;
    }
    t.equal(peer.peerIdentifier, peerIdentifier,
      'peer identifier should match');
    t.equal(peer.hostAddress, testSeverHostAddress,
      'host address should match');
    t.equal(peer.portNumber, testServerPort, 'port should match');
    wifiInfrastructure.removeListener('wifiPeerAvailabilityChanged',
      peerAvailableListener);

    var peerUnavailableListener = function (peer) {
      if (peer.peerIdentifier !== peerIdentifier) {
        return;
      }
      t.equal(peer.hostAddress, null, 'host address should be null');
      t.equal(peer.portNumber, null, 'port should should be null');
      wifiInfrastructure.removeListener('wifiPeerAvailabilityChanged',
        peerUnavailableListener);
      t.end();
    };
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

test('#startUpdateAdvertisingAndListening should use different USN after ' +
  'every invocation', function (t) {
  var testClient = new nodessdp.Client();

  var firstUSN = null;
  var secondUSN = null;
  testClient.on('advertise-alive', function (data) {
    // Check for the Thali NT in case there is some other
    // SSDP traffic in the network.
    if (data.NT !== ThaliConfig.SSDP_NT || data.USN !== wifiInfrastructure.usn)
    {
      return;
    }
    if (firstUSN !== null) {
      secondUSN = data.USN;
      t.notEqual(firstUSN, secondUSN, 'USN should have changed from the ' +
        'first one');
      wifiInfrastructure.stopAdvertisingAndListening();
    } else {
      firstUSN = data.USN;
      // This is the second call to the update function and after
      // this call, the USN value should have been changed.
      wifiInfrastructure.startUpdateAdvertisingAndListening();
    }
  });
  testClient.on('advertise-bye', function (data) {
    // Check for the Thali NT in case there is some other
    // SSDP traffic in the network.
    if (data.NT !== ThaliConfig.SSDP_NT || data.USN !== wifiInfrastructure.usn)
    {
      return;
    }
    if (data.USN === firstUSN) {
      t.equals(secondUSN, null, 'when receiving the first byebye, the second ' +
        'USN should not be set yet');
    }
    if (data.USN === secondUSN) {
      t.ok(firstUSN, 'when receiving the second byebye, the first USN should ' +
        'be already set');
      testClient.stop(function () {
        t.end();
      });
    }
  });

  testClient.start(function () {
    // This is the first call to the update function after which
    // some USN value should be advertised.
    wifiInfrastructure.startUpdateAdvertisingAndListening();
  });
});

test('messages with invalid location or USN should be ignored', function (t) {
  var testMessage = {
    NT: ThaliConfig.SSDP_NT,
    USN: uuid.v4(),
    LOCATION: 'http://foo.bar:90000'
  };
  var handledMessage = wifiInfrastructure._handleMessage(testMessage, true);
  t.equals(handledMessage, false, 'should not have emitted with invalid port');
  testMessage.USN = '';
  testMessage.LOCATION = 'http://foo.bar:50000';
  handledMessage = wifiInfrastructure._handleMessage(testMessage, true);
  t.equals(handledMessage, false, 'should not have emitted with invalid USN');
  t.end();
});

test('verify that Thali-specific messages are filtered correctly', function (t)
{
  var irrelevantMessage = {
    NT: 'foobar'
  };
  t.equal(true, wifiInfrastructure._shouldBeIgnored(irrelevantMessage),
    'irrelevant messages should be ignored');
  var relevantMessage = {
    NT: ThaliConfig.SSDP_NT,
    USN: uuid.v4()
  };
  t.equal(false, wifiInfrastructure._shouldBeIgnored(relevantMessage),
    'relevant messages should not be ignored');
  var messageFromSelf = {
    NT: ThaliConfig.SSDP_NT,
    USN: wifiInfrastructure.usn
  };
  t.equal(true, wifiInfrastructure._shouldBeIgnored(messageFromSelf),
    'messages from this device should be ignored');
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
  var knownOwnUsns = [];

  var peerChangedListener = function (peer) {
    t.equal(knownOwnUsns.indexOf(peer.peerIdentifier), -1,
      'we should not get notified about any USN that we have used');
  };

  wifiInfrastructure.on('wifiPeerAvailabilityChanged', peerChangedListener);
  wifiInfrastructure.startListeningForAdvertisements()
  .then(function () {
    return wifiInfrastructure.startUpdateAdvertisingAndListening();
  })
  .then(function () {
    knownOwnUsns.push(wifiInfrastructure.usn);
    setTimeout(function () {
      wifiInfrastructure.startUpdateAdvertisingAndListening()
      .then(function () {
        t.equal(knownOwnUsns.indexOf(wifiInfrastructure.usn), -1,
          'USN must have changed again');
        knownOwnUsns.push(wifiInfrastructure.usn);
      });
      setTimeout(function () {
        wifiInfrastructure.removeListener(
          'wifiPeerAvailabilityChanged',
          peerChangedListener
        );
        t.end();
      }, ThaliConfig.SSDP_ADVERTISEMENT_INTERVAL * 2);
    }, ThaliConfig.SSDP_ADVERTISEMENT_INTERVAL * 2);
  });
});

// From here onwards, tests only work on mocked up desktop
// environment where network changes can be simulated.
if (jxcore.utils.OSInfo().isMobile) {
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
    var peerIdentifier = 'urn:uuid:' + uuid.v4();
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
