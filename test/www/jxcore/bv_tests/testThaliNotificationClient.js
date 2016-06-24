'use strict';
var tape = require('../lib/thaliTape');
var express = require('express');
var crypto = require('crypto');
var sinon = require('sinon');
var Promise = require('lie');
var http = require('http');
var httpTester = require('../lib/httpTester.js');

var ThaliPeerDictionary =
  require('thali/NextGeneration/notification/thaliPeerDictionary');
var ThaliNotificationClient =
  require('thali/NextGeneration/notification/thaliNotificationClient');
var ThaliMobile =
  require('thali/NextGeneration/thaliMobile');

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
  this.peerPoolInterfaceStub = new ThaliPeerPoolDefault();

  this.TCPEvent = {
    peerIdentifier: 'id124',
    hostAddress: '127.0.0.1',
    portNumber: 0,
    connectionType: ThaliMobile.connectionTypes.TCP_NATIVE,
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
      self.TCPEvent.portNumber = self.expressServer.address().port;
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

test('Add two Peers.', function (t) {

  // Scenario:
  // 1. Event: connectionType is BLUETOOTH
  // 2. Event: connectionType is TCP_NATIVE

  // Expected result:
  // Two peers are added into the dictionary

  var notificationClient =
    new ThaliNotificationClient(globals.peerPoolInterfaceStub,
      globals.sourceKeyExchangeObject, function () {});

  notificationClient.start([]);

  var BluetoothEvent = {
    peerIdentifier: 'id123',
    hostAddress: 'anything',
    portNumber: 8080,
    connectionType: ThaliMobile.connectionTypes.BLUETOOTH,
    suggestedTCPTimeout: 1000
  };

  var TCPEvent = {
    peerIdentifier: 'id3212',
    hostAddress: 'anything',
    portNumber: 8080,
    connectionType: ThaliMobile.connectionTypes.TCP_NATIVE,
    suggestedTCPTimeout: 1000
  };

  // New peer with Bluetooth connection
  notificationClient._peerAvailabilityChanged(BluetoothEvent);
  t.equal(notificationClient.peerDictionary.size(), 1);

  // New peer with TCP_NATIVE connection
  notificationClient._peerAvailabilityChanged(TCPEvent);
  t.equal(notificationClient.peerDictionary.size(), 2);

  var peer = notificationClient.peerDictionary.get('id123');
  var peer2 = notificationClient.peerDictionary.get('id3212');

  t.equal(peer.notificationAction.getConnectionType(),
    ThaliMobile.connectionTypes.BLUETOOTH);

  t.equal(peer2.notificationAction.getConnectionType(),
    ThaliMobile.connectionTypes.TCP_NATIVE);

  notificationClient.stop();
  t.equal(notificationClient.peerDictionary, null);
  t.end();

});

test('TCP_NATIVE peer loses DNS', function (t) {

  // Scenario:
  // 1. Event: connectionType is TCP_NATIVE, hostaddress is set
  // 2. Event: connectionType is TCP_NATIVE, hostaddress is not set

  // Expected result: Peer will be removed from the dictionary

  var notificationClient =
    new ThaliNotificationClient(globals.peerPoolInterfaceStub,
      globals.sourceKeyExchangeObject);

  notificationClient.start([]);

  // New peer with TCP connection
  notificationClient._peerAvailabilityChanged(globals.TCPEvent);
  t.equal(notificationClient.peerDictionary.size(), 1);

  globals.TCPEvent.hostAddress = undefined;

  // New peer with TCP_NATIVE connection but without hostaddress
  notificationClient._peerAvailabilityChanged(globals.TCPEvent);

  t.equal(notificationClient.peerDictionary.size(), 0);

  notificationClient.stop();

  t.end();

});

test('Received beacons with no values for us', function (t) {
  var enqueue = function (action) {
    var keepAliveAgent = httpTester.getTestAgent(
      thaliConfig.BEACON_PSK_IDENTITY, thaliConfig.BEACON_KEY);
    action.start(keepAliveAgent).then(function () {
      setImmediate(function () {
        var entry =
          notificationClient.peerDictionary.get(globals.TCPEvent.peerIdentifier);
        t.ok(entry, 'entry exists');
        t.equal(entry.peerState, ThaliPeerDictionary.peerState.RESOLVED, 'entry ' +
          'is resolved');
        notificationClient.stop();
        t.end();
      });
    }).catch( function ( ) {
      t.fail('This action should not fail!');
      t.end();
    });
  };

  sinon.stub(globals.peerPoolInterface, 'enqueue', enqueue);

  httpTester.runServer(globals.expressRouter,
    thaliConfig.NOTIFICATION_BEACON_PATH,
    200, globals.preambleAndBeacons, 1);

  var notificationClient =
    new ThaliNotificationClient(globals.peerPoolInterface,
      globals.targetDeviceKeyExchangeObjects[0]);

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

test('Resolves an action locally', function (t) {

  // Scenario:
  // 1. Event: connectionType is TCP_NATIVE, hostaddress is set

  // Expected result:
  // Action is getting resolved ok

  // Simulates how the peer pool runs actions
  var enqueue = function (action) {
    var keepAliveAgent = httpTester.getTestAgent(
      thaliConfig.BEACON_PSK_IDENTITY, thaliConfig.BEACON_KEY);
    action.start(keepAliveAgent).then( function () {
    }).catch( function ( ) {
      t.fail('This action should not fail!');
    });
  };

  sinon.stub(globals.peerPoolInterface, 'enqueue', enqueue);

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
        globals.TCPEvent.hostAddress,
        'Host address must match');
      t.equals(
        res.suggestedTCPTimeout,
        globals.TCPEvent.suggestedTCPTimeout,
        'suggestedTCPTimeout must match');
      t.equals(
        res.connectionType,
        globals.TCPEvent.connectionType,
        'connectionType must match');
      t.equals(
        res.portNumber,
        globals.TCPEvent.portNumber,
        'portNumber must match');

      notificationClient.stop();
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

  var peerPool = new ThaliPeerPoolDefault();
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
        globals.TCPEvent.hostAddress,
        'Host address must match');
      t.equals(
        res.suggestedTCPTimeout,
        globals.TCPEvent.suggestedTCPTimeout,
        'suggestedTCPTimeout must match');
      t.equals(
        res.connectionType,
        globals.TCPEvent.connectionType,
        'connectionType must match');
      t.equals(
        res.portNumber,
        globals.TCPEvent.portNumber,
        'portNumber must match');

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
  ThaliNotificationClient.RETRY_TIMEOUTS =
    [100, 300, 600];

  var requestCount = 0;
  var failCount = 0;

  // Simulates how peer pool runs actions
  var enqueue = function (action) {
    requestCount++;
    var keepAliveAgent = new http.Agent({ keepAlive: true });
    action.start(keepAliveAgent).then( function () {
      t.fail('This action should fail always.');
      t.end();
    }).catch( function ( ) {
      failCount++;
    });
  };

  sinon.stub(globals.peerPoolInterface, 'enqueue', enqueue);

  var notificationClient =
    new ThaliNotificationClient(globals.peerPoolInterface,
      globals.targetDeviceKeyExchangeObjects[0]);

  notificationClient.start([]);

  var TCPEvent = {
    peerIdentifier: 'id123',
    hostAddress: 'address-that-does-not-exists',
    portNumber: 123,
    connectionType: ThaliMobile.connectionTypes.TCP_NATIVE,
    suggestedTCPTimeout: 10000
  };

  // New peer with TCP connection
  notificationClient._peerAvailabilityChanged(TCPEvent);

  // Waits 5 seconds. And checks results
  setTimeout( function () {
    t.equals(requestCount-1, ThaliNotificationClient.RETRY_TIMEOUTS.length);
    t.equals(failCount-1, ThaliNotificationClient.RETRY_TIMEOUTS.length);
    var entry = notificationClient.peerDictionary.get('id123');
    t.equals(entry.peerState, ThaliPeerDictionary.peerState.RESOLVED);
    notificationClient.stop();
    t.end();
  }, 5000);
});

test('hostaddress is removed when the action is running. ', function (t) {

  // Scenario:
  // 1. Event: connectionType is TCP_NATIVE, hostaddress is set
  // 2. Start to resolve the action
  // 3. Event: connectionType is TCP_NATIVE, hostaddress is not set

  // Expected result:
  // Action gets killed while the peer pool is running it
  // and the peer is removed from the dictionary.

  // Simulates how peer pool runs actions
  var enqueue = function (action) {
    var keepAliveAgent = new http.Agent({ keepAlive: true });
    action.start(keepAliveAgent).then( function () {

    }).catch( function () {
      t.fail('This action should not fail');
    });
  };

  sinon.stub(globals.peerPoolInterface, 'enqueue', enqueue);

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
    globals.TCPEvent.hostAddress = undefined;
    notificationClient._peerAvailabilityChanged(globals.TCPEvent);
    t.equal(notificationClient.peerDictionary.size(), 0);
    notificationClient.stop();
    t.end();
  }, 2000);
});

