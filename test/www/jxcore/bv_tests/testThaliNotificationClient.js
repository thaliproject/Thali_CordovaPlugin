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

  var enqueue = function (par) {
  };

  this.enqueStub = sinon.stub(this.peerPoolInterfaceStub, 'enqueue', enqueue);

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

var addressBookCallback = function (unencryptedKeyId) {
  if (unencryptedKeyId.compare(globals.sourcePublicKeyHash) === 0) {
    return globals.sourcePublicKey;
  }
  return null;
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

test('ThaliNotificationClient really basic test', function (t) {

  var notificationClient =
    new ThaliNotificationClient(globals.peerPoolInterfaceStub,
    globals.sourceKeyExchangeObject, function () {});

  notificationClient.start();

  var PeerWithHost = {
    peerIdentifier: 'dummy',
    hostAddress: 'dummy',
    portNumber: 8080,
    connectionType: ThaliMobile.connectionTypes.TCP_NATIVE,
    suggestedTCPTimeout: 1000
  };

  var PeerWithNoHost = {
    peerIdentifier: 'dummy',
    portNumber: 8080,
    connectionType: ThaliMobile.connectionTypes.TCP_NATIVE,
    suggestedTCPTimeout: 1000
  };

  notificationClient._peerAvailabilityChanged(PeerWithHost);
  notificationClient._peerAvailabilityChanged(PeerWithHost);
  notificationClient._peerAvailabilityChanged(PeerWithNoHost);

  notificationClient.stop();

  t.end();
});

test('Replace the connectionType BLUETOOTH with TCP_NATIVE', function (t) {

  // Scenario:
  // 1. Event: connectionType is BLUETOOTH
  // 2. Event: connectionType is TCP_NATIVE
  // 3. Event: connectionType is BLUETOOTH

  // When the connectionType of the new event is TCP_NATIVE and existing
  // action isn't that, we kill the existing action and create a new
  // action. We prefer native TCP transport to other options.

  var notificationClient =
    new ThaliNotificationClient(globals.peerPoolInterfaceStub,
      globals.sourceKeyExchangeObject, function () {});

  notificationClient.start();

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
  t.equal(notificationClient.peerDictionary.size(), 0);
  t.end();

});

test('Existing TCP_NATIVE peer loses DNS', function (t) {

  // Scenario:
  // 1. Event: connectionType is TCP_NATIVE, hostaddress is set
  // 2. Event: connectionType is TCP_NATIVE, hostaddress is not set

  var notificationClient =
    new ThaliNotificationClient(globals.peerPoolInterfaceStub,
      globals.sourceKeyExchangeObject, function () {});

  notificationClient.start();

  var TCPEvent = {
    peerIdentifier: 'id123',
    hostAddress: '127.0.0.1',
    portNumber: 8080,
    connectionType: ThaliMobile.connectionTypes.TCP_NATIVE,
    suggestedTCPTimeout: 1000
  };

  // New peer with TCP connection
  notificationClient._peerAvailabilityChanged(TCPEvent);
  TCPEvent.hostAddress = undefined;
  // New peer with TCP_NATIVE connection
  notificationClient._peerAvailabilityChanged(TCPEvent);

  t.equal(notificationClient.peerDictionary.size(), 0);

  notificationClient.stop();

  t.end();

});


test('Try to run action', function (t) {

  // Scenario:
  // 1. Event: connectionType is TCP_NATIVE, hostaddress is set
  // 2. Event: connectionType is TCP_NATIVE, hostaddress is not set

  httpTester.runServer(globals.expressRouter,
    ThaliConfig.NOTIFICATION_BEACON_PATH,
    200, globals.preambleAndBeacons, 1);

  var notificationClient =
    new ThaliNotificationClient(globals.peerPoolInterfaceStub,
      globals.targetDeviceKeyExchangeObjects[0], addressBookCallback);

  notificationClient.start();

  var TCPEvent = {
    peerIdentifier: 'id123',
    hostAddress: '127.0.0.1',
    portNumber: globals.expressServer.address().port,
    connectionType: ThaliMobile.connectionTypes.TCP_NATIVE,
    suggestedTCPTimeout: 100000
  };

  // New peer with TCP connection
  notificationClient._peerAvailabilityChanged(TCPEvent);

  // Simulates how peer pool runs actions
  var keepAliveAgent = new http.Agent({ keepAlive: true });
  var action = notificationClient.peerDictionary.get('id123').notificationAction;

  action.start(keepAliveAgent).then( function () {
    console.log('runs fine');
    t.end();
  }).catch( function (err) {
    console.log(err);
    notificationClient.stop();
    t.end();
  });



});

