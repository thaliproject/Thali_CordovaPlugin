'use strict';
var tape = require('../lib/thali-tape');
var express = require('express');
var crypto = require('crypto');
var sinon = require('sinon');
var Promise = require('lie');

var proxyquire = require('proxyquire').noCallThru();

var ThaliNotificationClient =
  require('thali/NextGeneration/notification/thaliNotificationClient');
var ThaliMobile =
  require('thali/NextGeneration/thaliMobile');

var ThaliPeerPoolInterface =
  require('thali/NextGeneration/thaliPeerPool/thaliPeerPoolInterface');

var NotificationBeacons =
  require('thali/NextGeneration/notification/thaliNotificationBeacons');

var SECP256K1 = 'secp256k1';

var globals = {};

/**
 * @classdesc This class is a container for all variables and
 * functionality that are common to most of the ThaliNoficationServer
 * tests.
 */
var GlobalVariables = function () {

  this.sourceKeyExchangeObject = crypto.createECDH(SECP256K1);
  this.sourcePublicKey = this.sourceKeyExchangeObject.generateKeys();
  this.sourcePublicKeyHash =
    NotificationBeacons.createPublicKeyHash(this.sourcePublicKey);
  /*
  // Creates a proxyquired ThaliNotificationClient class.
  var MockThaliMobile = { };
  this.ThaliNotificationClientProxyquired =
    proxyquire('thali/NextGeneration/notification/thaliNotificationClient',
      { '../thaliMobile':
      MockThaliMobile});
  */
  this.peerPoolInterface = new ThaliPeerPoolInterface();

  this.spyThaliPeerPoolInterfaceEnqueue =
    sinon.spy(this.peerPoolInterface, 'enqueue');

};


var test = tape({
  setup: function (t) {
    globals = new GlobalVariables();
    t.end();
  },
  teardown: function (t) {

    t.end();
  }
});


test('ThaliNotificationClient 1. test', function (t) {

  var notificationClient =
    new ThaliNotificationClient(globals.peerPoolInterface,
    globals.sourceKeyExchangeObject);

  notificationClient.start();

  var PeerWithHost = {
    peerIdentifier: 'dummy',
    hostAddress: 'dummy',
    portNumber: 8080,
    connectionType: ThaliMobile.connectionTypes.TCP_NATIVE
  };

  var PeerWithNoHost = {
    peerIdentifier: 'dummy',
    portNumber: 8080
  };

  notificationClient._peerAvailabilityChanged(PeerWithHost);
  notificationClient._peerAvailabilityChanged(PeerWithHost);
  notificationClient._peerAvailabilityChanged(PeerWithNoHost);

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
    new ThaliNotificationClient(globals.peerPoolInterface,
    globals.sourceKeyExchangeObject);

  notificationClient.start();

  var BluetoothEvent = {
    peerIdentifier: 'id123',
    hostAddress: 'anything',
    portNumber: 8080,
    connectionType: ThaliMobile.connectionTypes.BLUETOOTH
  };

  var TCPEvent = {
    peerIdentifier: 'id123',
    hostAddress: 'anything',
    portNumber: 8080,
    connectionType: ThaliMobile.connectionTypes.TCP_NATIVE
  };

  // New peer with Bluetooth connection
  notificationClient._peerAvailabilityChanged(BluetoothEvent);
  var peer = notificationClient.peerDictionary.get('id123');
  t.equal(peer.notificationAction.connectionType,
    ThaliMobile.connectionTypes.BLUETOOTH);

  // New peer with TCP_NATIVE connection
  notificationClient._peerAvailabilityChanged(TCPEvent);
  peer = notificationClient.peerDictionary.get('id123');
  t.equal(peer.notificationAction.connectionType,
    ThaliMobile.connectionTypes.TCP_NATIVE);

  // New peer with BLUETOOTH connection
  notificationClient._peerAvailabilityChanged(BluetoothEvent);
  peer = notificationClient.peerDictionary.get('id123');
  t.equal(peer.notificationAction.connectionType,
    ThaliMobile.connectionTypes.TCP_NATIVE);

  t.end();

});
