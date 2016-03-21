'use strict';
var tape = require('../lib/thali-tape');
var express = require('express');
var crypto = require('crypto');
var sinon = require('sinon');
var Promise = require('lie');
var http = require('http');

var httpTester = require('../lib/httpTester.js');

var proxyquire = require('proxyquire').noCallThru();

var ThaliNotificationClient =
  require('thali/NextGeneration/notification/thaliNotificationClient');
var ThaliMobile =
  require('thali/NextGeneration/thaliMobile');

var ThaliPeerPoolDefault =
  require('thali/NextGeneration/thaliPeerPool/thaliPeerPoolDefault');

var NotificationBeacons =
  require('thali/NextGeneration/notification/thaliNotificationBeacons');

var MakeIntoCloseAllServer =
  require('thali/NextGeneration/makeIntoCloseAllServer');

var ThaliConfig =
  require('thali/NextGeneration/thaliConfig');

var SECP256K1 = 'secp256k1';

var globals = {};

/**
 * @classdesc This class is a container for all variables and
 * functionality that are common to most of the ThaliNoficationServer
 * tests.
 */
var GlobalVariables = function () {

  this.expressApp = express();
  this.expressRouter = express.Router();

  this.sourceKeyExchangeObject = crypto.createECDH(SECP256K1);
  this.sourcePublicKey = this.sourceKeyExchangeObject.generateKeys();
  this.sourcePublicKeyHash =
    NotificationBeacons.createPublicKeyHash(this.sourcePublicKey);

  this.peerPoolInterface = new ThaliPeerPoolDefault();
  this.peerPoolInterfaceStub = new ThaliPeerPoolDefault();

  var enqueue = function () {
  };

  this.enqueStub = sinon.stub(this.peerPoolInterfaceStub, 'enqueue', enqueue);

  this.TCPEvent = {
    peerIdentifier: 'id123',
    hostAddress: '127.0.0.1',
    portNumber: 8080,
    connectionType: ThaliMobile.connectionTypes.TCP_NATIVE,
    suggestedTCPTimeout: 100000
  };

  this.createPublicKeysToNotifyAndPreamble();
};

GlobalVariables.prototype.init = function () {
  var self = this;
  return new Promise(function (resolve, reject) {
    // Initializes the server with the expressRouter
    self.expressApp.use('/', self.expressRouter);
    self.expressServer = self.expressApp.listen(0, function (err) {
      if (err) {
        reject(err);
      } else {
        MakeIntoCloseAllServer(self.expressServer);
        self.TCPEvent.portNumber = self.expressServer.address().port;
        resolve();
      }
    });
  });
};

/**
 * Frees GlobalVariables instance's resources.
 * @returns {Promise<?Error>} Returns a promise that will resolve when the
 * resources are released.
 */
GlobalVariables.prototype.kill = function () {
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

  var device1 = crypto.createECDH(SECP256K1);
  var device1Key = device1.generateKeys();
  var device1KeyHash = NotificationBeacons.createPublicKeyHash(device1Key);

  var device2 = crypto.createECDH(SECP256K1);
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

test('Replace the connectionType BLUETOOTH with TCP_NATIVE', function (t) {

  // Scenario:
  // 1. Event: connectionType is BLUETOOTH
  // 2. Event: connectionType is TCP_NATIVE
  // 3. Event: connectionType is BLUETOOTH

  // Expected result:
  // When the connectionType of the new event is TCP_NATIVE and existing
  // action isn't that, we kill the existing action and create a new
  // action.

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
    peerIdentifier: 'id123',
    hostAddress: 'anything',
    portNumber: 8080,
    connectionType: ThaliMobile.connectionTypes.TCP_NATIVE,
    suggestedTCPTimeout: 1000
  };

  // New peer with Bluetooth connection
  notificationClient._peerAvailabilityChanged(BluetoothEvent);
  var peer = notificationClient.peerDictionary.get('id123');
  t.equal(peer.notificationAction.getConnectionType(),
    ThaliMobile.connectionTypes.BLUETOOTH);

  // New peer with TCP_NATIVE connection
  notificationClient._peerAvailabilityChanged(TCPEvent);
  peer = notificationClient.peerDictionary.get('id123');
  t.equal(peer.notificationAction.getConnectionType(),
    ThaliMobile.connectionTypes.TCP_NATIVE);

  // New peer with BLUETOOTH connection
  notificationClient._peerAvailabilityChanged(BluetoothEvent);
  peer = notificationClient.peerDictionary.get('id123');
  t.equal(peer.notificationAction.getConnectionType(),
    ThaliMobile.connectionTypes.TCP_NATIVE);
  t.equal(notificationClient.peerDictionary.size(), 1);

  notificationClient.stop();
  t.equal(notificationClient.peerDictionary, null);
  t.end();

});

test('Existing TCP_NATIVE peer loses DNS', function (t) {

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
  // New peer with TCP_NATIVE connection
  notificationClient._peerAvailabilityChanged(globals.TCPEvent);

  t.equal(notificationClient.peerDictionary.size(), 0);

  notificationClient.stop();

  t.end();

});

test('Resolves an action locally', function (t) {

  // Scenario:
  // 1. Event: connectionType is TCP_NATIVE, hostaddress is set
  // 2. Action is getting resolved ok

  // Simulates how peer pool runs actions
  var enqueue = function (action) {
    var keepAliveAgent = new http.Agent({ keepAlive: true });
    action.start(keepAliveAgent).then( function () {
    }).catch( function ( ) {
      t.fail('This action should not fail!');
    });
  };

  sinon.stub(globals.peerPoolInterface, 'enqueue', enqueue);

  httpTester.runServer(globals.expressRouter,
    ThaliConfig.NOTIFICATION_BEACON_PATH,
    200, globals.preambleAndBeacons, 1);

  var notificationClient =
    new ThaliNotificationClient(globals.peerPoolInterface,
      globals.targetDeviceKeyExchangeObjects[0]);

  notificationClient.start([globals.sourcePublicKey]);

  notificationClient.on(ThaliNotificationClient.Events.PeerAdvertisesDataForUs,
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
  // ThaliNotificationClient tries to connect 6 times and then stops.

  var counter = 0;

  // Simulates how peer pool runs actions
  var enqueue = function (action) {
    var keepAliveAgent = new http.Agent({ keepAlive: true });
    action.start(keepAliveAgent).then( function () {
      t.fail('This action should fail always.');
      t.end();
    }).catch( function ( ) {
      console.log('runs fine');
      if (++counter === 6) {
        t.end();
      }
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
    suggestedTCPTimeout: 100000
  };

  // New peer with TCP connection
  notificationClient._peerAvailabilityChanged(TCPEvent);

});

test('Peer gets updated while the action is running. ', function (t) {

  // Scenario:
  // 1. Event: connectionType is TCP_NATIVE, hostaddress is set
  // 2. Start to resolve the action
  // 3. Event: connectionType is TCP_NATIVE, hostaddress is not set

  // Expected result:
  // Action gets killed when the simulated peer pool is running it
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
    ThaliConfig.NOTIFICATION_BEACON_PATH,
    200, globals.preambleAndBeacons, 1, 10000); // 10 seconds delay

  var notificationClient =
    new ThaliNotificationClient(globals.peerPoolInterface,
      globals.targetDeviceKeyExchangeObjects[0]);

  notificationClient.start([globals.sourcePublicKey]);

  notificationClient.on(ThaliNotificationClient.Events.PeerAdvertisesDataForUs,
    function ( res) {
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

