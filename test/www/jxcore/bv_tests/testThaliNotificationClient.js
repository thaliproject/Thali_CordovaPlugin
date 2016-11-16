'use strict';
var tape = require('../lib/thaliTape');
var express = require('express');
var crypto = require('crypto');
var sinon = require('sinon');
var Promise = require('bluebird');
var http = require('http');
var httpTester = require('../lib/httpTester.js');
var PeerAction = require('thali/NextGeneration/thaliPeerPool/thaliPeerAction');
var PeerDictionary = require('thali/NextGeneration/notification/thaliPeerDictionary');

var ThaliMobile = require('thali/NextGeneration/thaliMobile');
var ThaliPeerDictionary =
  require('thali/NextGeneration/notification/thaliPeerDictionary');
var ThaliNotificationClient =
  require('thali/NextGeneration/notification/thaliNotificationClient');
var ThaliMobileNativeWrapper =
  require('thali/NextGeneration/thaliMobileNativeWrapper');
var ThaliNotificationAction =
  require('thali/NextGeneration/notification/thaliNotificationAction');

var ThaliPeerPoolDefault =
  require('thali/NextGeneration/thaliPeerPool/thaliPeerPoolDefault');

var NotificationBeacons =
  require('thali/NextGeneration/notification/thaliNotificationBeacons');

var thaliConfig =
  require('thali/NextGeneration/thaliConfig');

var pskIdToSecret = function (id) {
  return id === thaliConfig.BEACON_PSK_IDENTITY ? thaliConfig.BEACON_KEY : null;
};

var globals = {};

/**
 * @classdesc This class is a container for all variables and
 * functionality that are common to most of the ThaliNoficationServer
 * tests.
 */
var GlobalVariables = function () {

  this.expressApp = express();
  this.expressRouter = express.Router();

  this.sourceKeyExchangeObject = crypto.createECDH(thaliConfig.BEACON_CURVE);
  this.sourcePublicKey = this.sourceKeyExchangeObject.generateKeys();
  this.sourcePublicKeyHash =
    NotificationBeacons.createPublicKeyHash(this.sourcePublicKey);

  this.peerPoolInterface = new ThaliPeerPoolDefault();
  this.peerPoolInterface.start();
  this.peerPoolInterfaceStub = new ThaliPeerPoolDefault();
  this.peerPoolInterfaceStub.start();

  this.TCPEvent = {
    peerIdentifier: 'id124',
    peerAvailable: true,
    newAddressPort: false,
    generation: 0,
    connectionType: ThaliMobileNativeWrapper.connectionTypes.TCP_NATIVE,
  };

  this.TCPPeerHostInfo = {
    hostAddress: '127.0.0.1',
    portNumber: 0,
    suggestedTCPTimeout: 10000
  };

  this.originalTimeOuts = ThaliNotificationClient.RETRY_TIMEOUTS;
  this.createPublicKeysToNotifyAndPreamble();
};

GlobalVariables.prototype.init = function () {
  var self = this;
  return httpTester.getTestHttpsServer(self.expressApp,
    self.expressRouter, pskIdToSecret)
    .then(function (server) {
      self.expressServer = server;
      self.TCPPeerHostInfo.portNumber = self.expressServer.address().port;
      return Promise.resolve();
    })
    .catch(function (failure) {
      return Promise.reject(failure);
    });
};

/**
 * Frees GlobalVariables instance's resources.
 * @returns {Promise<?Error>} Returns a promise that will resolve when the
 * resources are released.
 */
GlobalVariables.prototype.kill = function () {

  ThaliNotificationClient.RETRY_TIMEOUTS =
    this.originalTimeOuts;

  if (this.expressServer) {
    return this.expressServer.closeAllPromise();
  }
  return Promise.resolve();
};

GlobalVariables.prototype.createPublicKeysToNotifyAndPreamble = function () {
  this.targetPublicKeysToNotify = [];
  this.targetPublicKeysToNotifyHashes = [];
  this.targetDeviceKeyExchangeObjects = [];
  this.preambleAndBeacons = {};

  var device1 = crypto.createECDH(thaliConfig.BEACON_CURVE);
  var device1Key = device1.generateKeys();
  var device1KeyHash = NotificationBeacons.createPublicKeyHash(device1Key);

  var device2 = crypto.createECDH(thaliConfig.BEACON_CURVE);
  var device2Key = device2.generateKeys();
  var device2KeyHash = NotificationBeacons.createPublicKeyHash(device2Key);

  this.targetPublicKeysToNotify.push(device1Key, device2Key);
  this.targetPublicKeysToNotifyHashes.push(device1KeyHash, device2KeyHash);
  this.targetDeviceKeyExchangeObjects.push(device2, device2);

  this.preambleAndBeacons =
    NotificationBeacons.generatePreambleAndBeacons(
      this.targetPublicKeysToNotify, this.sourceKeyExchangeObject,
      60 * 60 * 1000);
};

var test = tape({
  setup: function (t) {
    globals = new GlobalVariables();
    globals.init().then(function () {
      t.end();
    }).catch(function (failure) {
      t.fail('Test setting up failed:' + failure);
      t.end();
    });
  },
  teardown: function (t) {
    globals.kill().then(function () {
      t.end();
    }).catch(function (failure) {
      t.fail('Server cleaning failed:' + failure);
      t.end();
    });
  }
});

function stubGetPeerHostInfo() {
  return sinon.stub(
    ThaliMobile,
    'getPeerHostInfo',
    function (peerIdentifier, connectionType) {
      return Promise.resolve(globals.TCPPeerHostInfo);
    }
  );
}

test('Add two Peers.', function (t) {

  // Scenario:
  // 1. Event: connectionType is BLUETOOTH
  // 2. Event: connectionType is TCP_NATIVE

  // Expected result:
  // Two peers are added into the dictionary

  var getPeerHostInfoStub = stubGetPeerHostInfo();

  var notificationClient =
    new ThaliNotificationClient(globals.peerPoolInterfaceStub,
      globals.sourceKeyExchangeObject, function () {});

  notificationClient.start([]);

  var BluetoothEvent = {
    peerIdentifier: 'id123',
    peerAvailable: true,
    newAddressPort: true,
    generation: 0,
    connectionType: ThaliMobileNativeWrapper.connectionTypes.BLUETOOTH
  };

  var TCPEvent = {
    peerIdentifier: 'id3212',
    peerAvailable: true,
    newAddressPort: true,
    generation: 0,
    connectionType: ThaliMobileNativeWrapper.connectionTypes.TCP_NATIVE
  };

  t.equal(notificationClient.peerDictionary.size(), 0);

  // New peer with Bluetooth connection
  notificationClient._peerAvailabilityChanged(BluetoothEvent);
  // New peer with TCP_NATIVE connection
  notificationClient._peerAvailabilityChanged(TCPEvent);

  t.equal(notificationClient.peerDictionary.size(), 2,
    'peerDictionalty contains 2 peers');

  var peer = notificationClient.peerDictionary.get('id123');
  var peer2 = notificationClient.peerDictionary.get('id3212');

  t.equal(
    peer.notificationAction.getConnectionType(),
    ThaliMobileNativeWrapper.connectionTypes.BLUETOOTH,
    'bluetooth peer\'s notification has correct connection type'
  );

  t.equal(
    peer2.notificationAction.getConnectionType(),
    ThaliMobileNativeWrapper.connectionTypes.TCP_NATIVE,
    'tcp peer\'s notification has correct connection type'
  );

  notificationClient.stop();
  getPeerHostInfoStub.restore();
  t.end();
});

test('TCP_NATIVE peer loses DNS', function (t) {

  // Scenario:
  // 1. Event: connectionType is TCP_NATIVE, hostaddress is set
  // 2. Event: connectionType is TCP_NATIVE, hostaddress is not set

  // Expected result: Peer will be removed from the dictionary

  var getPeerHostInfoStub = stubGetPeerHostInfo();

  var notificationClient =
    new ThaliNotificationClient(globals.peerPoolInterfaceStub,
      globals.sourceKeyExchangeObject);

  notificationClient.start([]);

  // New peer with TCP connection
  notificationClient._peerAvailabilityChanged(globals.TCPEvent);
  t.equal(notificationClient.peerDictionary.size(), 1,
    'notification peer dictionary contains exactly 1 peer');

  globals.TCPEvent.peerAvailable = false;

  // New peer with TCP_NATIVE connection but without hostaddress
  notificationClient._peerAvailabilityChanged(globals.TCPEvent);

  t.equal(notificationClient.peerDictionary.size(), 0,
    'notification peer dictionary does not contain any peers');

  notificationClient.stop();
  getPeerHostInfoStub.restore();
  t.end();
});

test('Received beacons with no values for us', function (t) {
  var notificationClient =
    new ThaliNotificationClient(globals.peerPoolInterface,
      globals.targetDeviceKeyExchangeObjects[0]);

  var getPeerHostInfoStub = stubGetPeerHostInfo();

  var enqueueStub = sinon.stub(
    globals.peerPoolInterface,
    'enqueue',
    function (action) {
      var keepAliveAgent = httpTester.getTestAgent(
        thaliConfig.BEACON_PSK_IDENTITY,
        thaliConfig.BEACON_KEY
      );
      action.start(keepAliveAgent).then(function () {
        setImmediate(function () {
          var entry = notificationClient.peerDictionary.get(
            globals.TCPEvent.peerIdentifier
          );
          t.ok(entry, 'entry exists');
          t.equal(entry.peerState, ThaliPeerDictionary.peerState.RESOLVED,
            'entry is resolved');
          notificationClient.stop();
          finalizeTest();
        });
      }).catch(function (err) {
        t.fail('This action should not fail!');
        finalizeTest();
      });
    }
  );

  var finalizeTest = function () {
    getPeerHostInfoStub.restore();
    enqueueStub.restore();
    t.end();
  };

  httpTester.runServer(globals.expressRouter,
    thaliConfig.NOTIFICATION_BEACON_PATH,
    200, globals.preambleAndBeacons, 1);

  var bogusPublicKey =
    crypto.createECDH(thaliConfig.BEACON_CURVE).generateKeys();
  notificationClient.start([bogusPublicKey]);

  notificationClient.on(notificationClient.Events.PeerAdvertisesDataForUs,
    function () {
      t.fail('We should not have gotten an event!');
    });

  // New peer with TCP connection
  notificationClient._peerAvailabilityChanged(globals.TCPEvent);
});

test('Notification action killed with a superseded', function (t) {
  var notificationClient =
    new ThaliNotificationClient(globals.peerPoolInterface,
      globals.targetDeviceKeyExchangeObjects[0]);

  var peerPoolInterface = globals.peerPoolInterface;
  var enqueue = function (action) {
    setImmediate(function () {
      action.killSuperseded();
      // Give the system a chance to fire any promises or events in case the
      // logic isn't working right.
      setImmediate(function () {
        t.equal(action.getActionState(), PeerAction.actionState.KILLED,
          'Action should be killed');
        t.equal(notificationClient.peerDictionary
            .get(action.getPeerIdentifier()).peerState,
          PeerDictionary.peerState.RESOLVED);
        peerPoolInterface.enqueue.restore();
        t.end();
      });
    });
    return null;
  };

  sinon.stub(globals.peerPoolInterface, 'enqueue', enqueue);

  var bogusPublicKey =
    crypto.createECDH(thaliConfig.BEACON_CURVE).generateKeys();

  notificationClient.start([bogusPublicKey]);

  notificationClient.on(
    notificationClient.Events.PeerAdvertisesDataForUs,
    function () {
      t.fail('We should not have gotten a PeerAdvertisesDataForUs event!');
    }
  );

  // New peer with TCP connection
  notificationClient._peerAvailabilityChanged(globals.TCPEvent);
});

test('Resolves an action locally', function (t) {

  // Scenario:
  // 1. Event: connectionType is TCP_NATIVE, hostaddress is set

  // Expected result:
  // Action is getting resolved ok

  var getPeerHostInfoStub = stubGetPeerHostInfo();

  // Simulates how the peer pool runs actions
  var enqueueStub = sinon.stub(
    globals.peerPoolInterface,
    'enqueue',
    function (action) {
      var keepAliveAgent = httpTester.getTestAgent(
        thaliConfig.BEACON_PSK_IDENTITY, thaliConfig.BEACON_KEY);
      action.start(keepAliveAgent).then( function () {
      }).catch( function ( ) {
        t.fail('This action should not fail!');
      });
    }
  );



  httpTester.runServer(globals.expressRouter,
    thaliConfig.NOTIFICATION_BEACON_PATH,
    200, globals.preambleAndBeacons, 1);

  var notificationClient =
    new ThaliNotificationClient(globals.peerPoolInterface,
      globals.targetDeviceKeyExchangeObjects[0]);

  notificationClient.start([globals.sourcePublicKey]);

  notificationClient.on(notificationClient.Events.PeerAdvertisesDataForUs,
    function (res) {
      t.equals(
        res.hostAddress,
        globals.TCPPeerHostInfo.hostAddress,
        'hostAddress must match');
      t.equals(
        res.portNumber,
        globals.TCPPeerHostInfo.portNumber,
        'portNumber must match');
      t.equals(
        res.suggestedTCPTimeout,
        globals.TCPPeerHostInfo.suggestedTCPTimeout,
        'suggestedTCPTimeout must match');
      t.equals(
        res.connectionType,
        globals.TCPEvent.connectionType,
        'connectionType must match');
      t.equals(
        res.peerId,
        globals.TCPEvent.peerIdentifier,
        'peerIDs must match');

      notificationClient.stop();
      enqueueStub.restore();
      getPeerHostInfoStub.restore();
      t.end();
    });

  // New peer with TCP connection
  notificationClient._peerAvailabilityChanged(globals.TCPEvent);
});

test('Resolves an action locally using ThaliPeerPoolDefault', function (t) {

  // Scenario:
  // 1. Event: connectionType is TCP_NATIVE, hostaddress is set

  // Expected result:
  // Action is getting resolved ok

  var getPeerHostInfoStub = stubGetPeerHostInfo();

  var peerPool = new ThaliPeerPoolDefault();
  peerPool.start();
  httpTester.runServer(globals.expressRouter,
    thaliConfig.NOTIFICATION_BEACON_PATH,
    200, globals.preambleAndBeacons, 1);

  var notificationClient =
    new ThaliNotificationClient(peerPool,
      globals.targetDeviceKeyExchangeObjects[0]);

  notificationClient.start([globals.sourcePublicKey]);

  notificationClient.on(notificationClient.Events.PeerAdvertisesDataForUs,
    function ( res) {
      t.equals(
        res.hostAddress,
        globals.TCPPeerHostInfo.hostAddress,
        'hostAddress must match');
      t.equals(
        res.portNumber,
        globals.TCPPeerHostInfo.portNumber,
        'portNumber must match');
      t.equals(
        res.suggestedTCPTimeout,
        globals.TCPPeerHostInfo.suggestedTCPTimeout,
        'suggestedTCPTimeout must match');
      t.equals(
        res.connectionType,
        globals.TCPEvent.connectionType,
        'connectionType must match');
      t.equals(
        res.peerId,
        globals.TCPEvent.peerIdentifier,
        'peerIds must match');

      getPeerHostInfoStub.restore();
      t.end();
    });

  // New peer with TCP connection
  notificationClient._peerAvailabilityChanged(globals.TCPEvent);

});

test('Action fails because of a bad hostname.', function (t) {

  // Scenario:
  // ConnectionType is TCP_NATIVE, host address is having wrong DNS.

  // Expected result:
  // Connection is tried RETRY_TIMEOUTS.length times

  // Make timeouts shorter (kill will return values to original)
  var retryTimeouts = [100, 300, 600];
  ThaliNotificationClient.RETRY_TIMEOUTS = retryTimeouts;

  var TCPEvent = {
    peerIdentifier: 'id123',
    peerAvailable: true,
    newAddressPort: false,
    generation: 0,
    connectionType: ThaliMobileNativeWrapper.connectionTypes.TCP_NATIVE
  };

  var TCPPeerHostInfo = {
    hostAddress: 'address-that-does-not-exists',
    portNumber: 123,
    suggestedTCPTimeout: 10000
  };

  var getPeerHostInfoStub = sinon.stub(
    ThaliMobile,
    'getPeerHostInfo',
    function (peerIdentifier, connectionType) {
      return Promise.resolve(TCPPeerHostInfo);
    }
  );

  var requestCount = 0;
  var failCount = 0;

  var testResolutionEvent = function (peerId, resolution) {
    t.equal(
      resolution,
      ThaliNotificationAction.ActionResolution.NETWORK_PROBLEM,
      'action should be resolved with NETWORK_PROBLEM error'
    );
  };

  // Simulates how peer pool runs actions
  var enqueueStub = sinon.stub(
    globals.peerPoolInterface,
    'enqueue',
    function (action) {
      requestCount++;
      var keepAliveAgent = new http.Agent({ keepAlive: true });
      action.eventEmitter.on(
        ThaliNotificationAction.Events.Resolved,
        testResolutionEvent
      );
      action.start(keepAliveAgent).then(function () {
        t.fail('This action should fail always.');
        finalizeTest(true);
      }).catch(function () {
        failCount++;
      }).then(function () {
        if (requestCount - 1 === retryTimeouts.length) {
          finalizeTest();
        }
      });
    }
  );

  var notificationClient =
    new ThaliNotificationClient(globals.peerPoolInterface,
      globals.targetDeviceKeyExchangeObjects[0]);


  var finalizeTest = function (skipChecks) {
    if (!skipChecks) {
      t.equals(
        requestCount - 1,
        retryTimeouts.length,
        'correct number of requests'
      );
      t.equals(
        failCount - 1,
        retryTimeouts.length,
        'correct number of failures'
      );
      var entry = notificationClient.peerDictionary.get('id123');
      t.equals(
        entry.peerState,
        ThaliPeerDictionary.peerState.RESOLVED,
        'correct final peer state'
      );
    }
    enqueueStub.restore();
    getPeerHostInfoStub.restore();
    notificationClient.stop();
    t.end();
  };

  notificationClient.start([]);

  // New peer with TCP connection
  notificationClient._peerAvailabilityChanged(TCPEvent);

});

test('hostaddress is removed when the action is running. ', function (t) {
  // Scenario:
  // 1. Event: connectionType is TCP_NATIVE, peer is available
  // 2. Start to resolve the action
  // 3. Event: connectionType is TCP_NATIVE, peer is not available

  // Expected result:
  // Action gets killed while the peer pool is running it
  // and the peer is removed from the dictionary.

  // Simulates how peer pool runs actions
  var enqueue = function (action) {
    var keepAliveAgent = new http.Agent({ keepAlive: true });
    action.start(keepAliveAgent).then( function () {

    }).catch( function (err) {
      t.fail('This action should not fail');
      t.end(err);
    });
  };

  var enqueueStub = sinon.stub(globals.peerPoolInterface, 'enqueue', enqueue);
  var getPeerHostInfoStub = stubGetPeerHostInfo();

  httpTester.runServer(globals.expressRouter,
    thaliConfig.NOTIFICATION_BEACON_PATH,
    200, globals.preambleAndBeacons, 1, 10000); // 10 seconds delay

  var notificationClient =
    new ThaliNotificationClient(globals.peerPoolInterface,
      globals.targetDeviceKeyExchangeObjects[0]);

  notificationClient.start([globals.sourcePublicKey]);

  notificationClient.on(notificationClient.Events.PeerAdvertisesDataForUs,
    function () {
      t.fail('This should never happen when action is getting killed' +
        'because of the hostname is removed');
      t.end();
    });

  // New peer with TCP connection
  notificationClient._peerAvailabilityChanged(globals.TCPEvent);

  // This updates the action after 2 seconds. This should give enough time to
  // establish a HTTP connection in slow devices but since the server waits
  // 10 seconds before it answers we have time to update the entry.

  setTimeout( function () {
    globals.TCPEvent.peerAvailable = false;
    notificationClient._peerAvailabilityChanged(globals.TCPEvent);
    t.equal(notificationClient.peerDictionary.size(), 0,
      'peerDictionary should become empty');
    notificationClient.stop();
    enqueueStub.restore();
    getPeerHostInfoStub.restore();
    t.end();
  }, 2000);
});

test('notificationClient does not retry action with BAD_PEER resolution',
  function (t) {
    var sandbox = sinon.sandbox.create();
    var getPeerHostInfoErrorMessage = 'getPeerHostInfo fail';
    var peerId = globals.TCPEvent.peerIdentifier;

    var notificationClient =
      new ThaliNotificationClient(globals.peerPoolInterface,
        globals.targetDeviceKeyExchangeObjects[0]);

    var actionResolvedSpy = sandbox.spy();
    var enqueue = function (action) {
      var keepAliveAgent = new http.Agent({ keepAlive: true });

      action.eventEmitter.on(
        ThaliNotificationAction.Events.Resolved,
        actionResolvedSpy
      );

      action.start(keepAliveAgent)
      .then(function () {
        t.fail('Should not succeed');
      })
      .catch(function (err) {
        var peerEntry = notificationClient.peerDictionary.get(peerId);
        t.equal(err.message, getPeerHostInfoErrorMessage,
          'failed with expected error');
        t.equal(peerEntry.peerState, PeerDictionary.peerState.RESOLVED,
          'peer state should be RESOLVED');
      })
      .then(function () {
        sandbox.restore();
        t.end();
      });
    };

    sandbox.stub(globals.peerPoolInterface, 'enqueue', enqueue);
    sandbox.stub(ThaliMobile, 'getPeerHostInfo',
      function (peerId, connectionType) {
        return Promise.reject(new Error(getPeerHostInfoErrorMessage));
      }
    );

    notificationClient.start([globals.sourcePublicKey]);

    // New peer with TCP connection
    notificationClient._peerAvailabilityChanged(globals.TCPEvent);
  }
);
