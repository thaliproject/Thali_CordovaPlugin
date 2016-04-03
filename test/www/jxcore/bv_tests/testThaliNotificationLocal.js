'use strict';
var tape = require('../lib/thaliTape');
var express = require('express');
var crypto = require('crypto');
var sinon = require('sinon');
var Promise = require('lie');
var httpTester = require('../lib/httpTester.js');
var proxyquire = require('proxyquire').noCallThru();

var ThaliNotificationClient =
  require('thali/NextGeneration/notification/thaliNotificationClient');
var ThaliMobile =
  require('thali/NextGeneration/thaliMobile');
var ThaliPeerPoolDefault =
  require('thali/NextGeneration/thaliPeerPool/thaliPeerPoolDefault');

var SECP256K1 = 'secp256k1';
var globals = {};

/**
 * @classdesc This class is a container for all variables and
 * functionality that are common to most of the ThaliNoficationtests.
 */
var GlobalVariables = function () {

  this.expressApp = express();
  this.expressRouter = express.Router();

  // Creates a proxyquired ThaliNotificationServer class.
  var MockThaliMobile = { };
  this.ThaliNotificationServerProxyquired =
    proxyquire('thali/NextGeneration/notification/thaliNotificationServer',
      { '../thaliMobile':
      MockThaliMobile});

  // Mocks ThaliMobile.startUpdateAdvertisingAndListening function
  MockThaliMobile.startUpdateAdvertisingAndListening = function () {
    return Promise.resolve();
  };

  // Mocks ThaliMobile.stopAdvertisingAndListening function
  MockThaliMobile.stopAdvertisingAndListening = function () {
    return Promise.resolve();
  };

  this.TCPEvent = {
    peerIdentifier: 'id123',
    hostAddress: '127.0.0.1',
    portNumber: 0,
    connectionType: ThaliMobile.connectionTypes.TCP_NATIVE,
    suggestedTCPTimeout: 10000
  };

  this.targetPublicKeysToNotify = [];
  this.targetDeviceKeyExchangeObjects = [];

  this.serverKeyExchangeObject = crypto.createECDH(SECP256K1);
  this.serverPublicKey = this.serverKeyExchangeObject.generateKeys();

  var device1 = crypto.createECDH(SECP256K1);
  var device1Key = device1.generateKeys();
  var device2 = crypto.createECDH(SECP256K1);
  var device2Key = device2.generateKeys();

  this.targetPublicKeysToNotify.push(device1Key, device2Key);
  this.targetDeviceKeyExchangeObjects.push(device2, device2);

  // Initializes proxyquired ThaliNotificationServer
  this.notificationServer = new this.ThaliNotificationServerProxyquired(
    this.expressRouter, this.serverKeyExchangeObject, 90000);

};

GlobalVariables.prototype.init = function () {
  var self = this;
  return httpTester.getTestHttpsServer(self.expressApp,
    self.expressRouter)
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
  if (this.expressServer) {
    return this.expressServer.closeAllPromise();
  }
  return Promise.resolve();
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

test('Client to server request locally', function (t) {

  // Purpose of this test is to ensure basic communication between
  // NotificationClient and NotificationServer works using mainly Notification
  // layer components. Behavior of the ThaliMobile is mocked on the
  // server side and it is simulated calling _peerAvailabilityChanged for the
  // client.

  var getPskIdToSecret = globals.notificationServer.getPskIdToSecret();
  var peerPool = new ThaliPeerPoolDefault();

  // Simulates how the peer pool runs actions
  var enqueue = function (action) {
    var keepAliveAgent = httpTester.getTestAgent();
    action.start(keepAliveAgent).then( function () {
    }).catch( function ( ) {
      t.fail('This action should not fail!');
    });
  };

  sinon.stub(peerPool, 'enqueue', enqueue);

  // Initialize the ThaliNotificationClient
  var notificationClient =
    new ThaliNotificationClient(peerPool,
      globals.targetDeviceKeyExchangeObjects[0]);

  notificationClient.on(
    ThaliNotificationClient.Events.PeerAdvertisesDataForUs, function ( res) {

      var secret = getPskIdToSecret(res.pskIdentifyField);
      t.ok(secret.compare(res.psk) === 0, 'secrets are equal');

      t.equal(res.keyId, globals.serverPublicKey,
        'Public key matches with the server key');
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
      globals.notificationServer.stop().then(function () {
        t.end();
      }).catch(function (failure) {
        t.fail('Stopping failed:' + failure);
        t.end();
      });
    });

  globals.notificationServer.start(globals.targetPublicKeysToNotify).
  then(function () {
    notificationClient.start([globals.serverPublicKey]);
    notificationClient._peerAvailabilityChanged(globals.TCPEvent);
  });
});


