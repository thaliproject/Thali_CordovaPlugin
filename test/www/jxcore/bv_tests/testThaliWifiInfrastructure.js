'use strict';

// Does not currently work on desktop with the mocked up
// Mobile (where we run multiple instances at the same time),
// because SSDP messages from multiple concurrent test
// instances may sometimes result into test failures.
if (typeof Mobile !== 'undefined' && Mobile.iAmAMock) {
  return;
}

var ThaliWifiInfrastructure = require('thali/NextGeneration/thaliWifiInfrastructure');
var ThaliConfig = require('thali/NextGeneration/thaliConfig');
var tape = require('../lib/thali-tape');
var nodessdp = require('node-ssdp');
var express = require('express');
var http = require('http');
var net = require('net');
var uuid = require('node-uuid');
var sinon = require('sinon');
var randomstring = require('randomstring');

var wifiInfrastructure = new ThaliWifiInfrastructure();

var test = tape({
  setup: function(t) {
    wifiInfrastructure.start(express.Router()).then(function () {
      t.end();
    });
  },
  teardown: function(t) {
    // Stop everything at the end of tests to make sure
    // the next test starts from clean state
    wifiInfrastructure.stop().then(function () {
      t.end();
    });
  }
});

var findPeerPerProperty = function (peers, property, value) {
  var foundPeer = null;
  peers.forEach(function (peer) {
    if (peer[property] === value) {
      foundPeer = peer;
    }
  });
  return foundPeer;
};

test('After #startListeningForAdvertisements call wifiPeerAvailabilityChanged events should be emitted', function (t) {
  var testHostAddress = randomstring.generate({
    charset: 'hex', // to get lowercase chars for the host address
    length: 8
  });
  var testPort = 8080;
  var testLocation = 'http://' + testHostAddress + ':' + testPort;
  var testServer = new nodessdp.Server({
    location: testLocation,
    udn: ThaliConfig.SSDP_NT
  });
  var peerIdentifier = 'urn:uuid:' + uuid.v4();
  testServer.setUSN(peerIdentifier);
  var peerAvailableListener = function (peers) {
    var peer = findPeerPerProperty(peers, 'hostAddress', testHostAddress);
    if (peer === null) {
      return;
    }
    t.equal(peer.peerIdentifier, peerIdentifier, 'peer identifier should match');
    t.equal(peer.hostAddress, testHostAddress, 'host address should match');
    t.equal(peer.portNumber, testPort, 'port should match');
    t.equal(peer.peerAvailable, true, 'peer should be available');
    wifiInfrastructure.removeListener('wifiPeerAvailabilityChanged', peerAvailableListener);

    var peerUnavailableListener = function (peers) {
      var peer = findPeerPerProperty(peers, 'peerIdentifier', peerIdentifier);
      if (peer === null) {
        return;
      }
      t.equal(peer.peerAvailable, false, 'peer should be unavailable');
      wifiInfrastructure.removeListener('wifiPeerAvailabilityChanged', peerUnavailableListener);
      t.end();
    };
    wifiInfrastructure.on('wifiPeerAvailabilityChanged', peerUnavailableListener);
    testServer.stop(function () {
      // When server is stopped, it shold trigger the byebye messages
      // that emit the wifiPeerAvailabilityChanged to which we listen above.
    });
  };
  wifiInfrastructure.on('wifiPeerAvailabilityChanged', peerAvailableListener);
  testServer.start(function () {
    wifiInfrastructure.startListeningForAdvertisements();
  });
});

test('#startUpdateAdvertisingAndListening should use different USN after every invocation', function (t) {
  var testClient = new nodessdp.Client();

  var firstUSN = null;
  var secondUSN = null
  testClient.on('advertise-alive', function (data) {
    // Check for the Thali NT in case there is some other
    // SSDP traffic in the network.
    if (data.NT !== ThaliConfig.SSDP_NT || data.USN !== wifiInfrastructure.usn) {
      return;
    }
    if (firstUSN !== null) {
      secondUSN = data.USN;
      t.notEqual(firstUSN, secondUSN, 'USN should have changed from the first one');
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
    if (data.NT !== ThaliConfig.SSDP_NT || data.USN !== wifiInfrastructure.usn) {
      return;
    }
    if (data.USN === firstUSN) {
      t.equals(secondUSN, null, 'when receiving the first byebye, the second USN should not be set yet');
    }
    if (data.USN === secondUSN) {
      t.ok(firstUSN, 'when receiving the second byebye, the first USN should be already set');
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

test('verify that Thali-specific messages are filtered correctly', function (t) {
  var irrelevantMessage = {
    NT: 'foobar'
  };
  t.equal(true, wifiInfrastructure._shouldBeIgnored(irrelevantMessage), 'irrelevant messages should be ignored');
  var relevantMessage = {
    NT: ThaliConfig.SSDP_NT,
    USN: uuid.v4()
  };
  t.equal(false, wifiInfrastructure._shouldBeIgnored(relevantMessage), 'relevant messages should not be ignored');
  var messageFromSelf = {
    NT: ThaliConfig.SSDP_NT,
    USN: wifiInfrastructure.usn
  };
  t.equal(true, wifiInfrastructure._shouldBeIgnored(messageFromSelf), 'messages from this device should be ignored');
  t.end();
});

test('#start should fail if called twice in a row', function (t) {
  // The start here is already the second since it is being
  // done once in the setup phase
  wifiInfrastructure.start(express.Router())
  .catch(function (error) {
    t.equal(error.message, 'Call Stop!', 'specific error should be received');
    t.end();
  });
});

test('#startUpdateAdvertisingAndListening should fail invalid router has been passed', function (t) {
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

test('#startUpdateAdvertisingAndListening should fail if router server starting fails', function (t) {
  // Save the old port so that it can be reassigned after the test.
  var oldPort = wifiInfrastructure.port;
  // Create a test server that is used to block the port
  // onto which the router server is tried to be started.
  var testServer = net.createServer(function (c) {
    // NOOP
  });
  testServer.listen(0, function () {
    var testServerPort = testServer.address().port;
    // Set the port to be the same on which we already
    // have our test server running. This should
    // create a failure when trying to start the router
    // server on the same port.
    wifiInfrastructure.port = testServerPort;
    wifiInfrastructure.startUpdateAdvertisingAndListening()
    .catch(function (error) {
      t.equals(error.message, 'Unspecified Error with Radio infrastructure', 'specific error expected');
      wifiInfrastructure.port = oldPort;
      testServer.close(function () {
        t.end()
      });
    });
  });
});

test('#startUpdateAdvertisingAndListening should start hosting given router object', function (t) {
  var router = express.Router();
  var testPath = '/test';
  router.get(testPath, function (req, res) {
    res.send('foobar');
  });
  wifiInfrastructure.stop()
  .then(function () {
    return wifiInfrastructure.start(router);
  })
  .then(function () {
    return wifiInfrastructure.startUpdateAdvertisingAndListening();
  })
  .then(function () {
    http.get({
      path: testPath,
      port: wifiInfrastructure.port,
      agent: false // to prevent connection keep-alive
    }, function (res) {
      t.equal(res.statusCode, 200, 'server should respond with code 200');
      t.end();
    });
  });
});

test('#stop can be called multiple times in a row', function (t) {
  wifiInfrastructure.stop()
  .then(function () {
    t.equal(wifiInfrastructure.started, false, 'should be in stopped state');
    return wifiInfrastructure.stop();
  })
  .then(function () {
    t.equal(wifiInfrastructure.started, false, 'should still be in stopped state');
    t.end();
  });
});

test('#startListeningForAdvertisements can be called multiple times in a row', function (t) {
  wifiInfrastructure.startListeningForAdvertisements()
  .then(function () {
    t.equal(wifiInfrastructure.listening, true, 'should be in listening state');
    return wifiInfrastructure.startListeningForAdvertisements();
  })
  .then(function () {
    t.equal(wifiInfrastructure.listening, true, 'should still be in listening state');
    t.end();
  });
});

test('#stopListeningForAdvertisements can be called multiple times in a row', function (t) {
  wifiInfrastructure.stopListeningForAdvertisements()
  .then(function () {
    t.equal(wifiInfrastructure.listening, false, 'should not be in listening state');
    return wifiInfrastructure.stopListeningForAdvertisements();
  })
  .then(function () {
    t.equal(wifiInfrastructure.listening, false, 'should still not be in listening state');
    t.end();
  });
});

test('#stopAdvertisingAndListening can be called multiple times in a row', function (t) {
  wifiInfrastructure.stopAdvertisingAndListening()
  .then(function () {
    t.equal(wifiInfrastructure.advertising, false, 'should not be in advertising state');
    return wifiInfrastructure.stopAdvertisingAndListening();
  })
  .then(function () {
    t.equal(wifiInfrastructure.advertising, false, 'should still not be in advertising state');
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

// From here onwards, tests only work on mocked up desktop
// environment where network changes are simulated. To make
// runnable on iOS and Android, there should be a way to fire
// network changed events programmatically and they should be
// emitted via the native layer.
if (typeof Mobile !== 'undefined' && !Mobile.iAmAMock) {
  return;
}

test('network changes emitted correctly', function (t) {
  var networkOnHandler = function (networkChangedValue) {
    t.equals(networkChangedValue.wifi, 'on', 'wifi should be on');
    wifiInfrastructure.removeListener('networkChangedWifi', networkOnHandler);
    t.end();
  };

  var networkOffHandler = function (networkChangedValue) {
    t.equals(networkChangedValue.wifi, 'off', 'wifi should be off');
    wifiInfrastructure.removeListener('networkChangedWifi', networkOffHandler);
    wifiInfrastructure.on('networkChangedWifi', networkOnHandler);
    process.emit('connectionStatusChanged', 'WiFi');
  };

  wifiInfrastructure.on('networkChangedWifi', networkOffHandler);
  process.emit('connectionStatusChanged', 'NotConnected');
});
