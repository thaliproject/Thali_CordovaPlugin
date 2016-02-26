var tape = require('../lib/thali-tape');
var express = require('express');
var crypto = require('crypto');
var sinon = require('sinon');
var Promise = require('lie');

var proxyquire = require('proxyquire').noCallThru();
var NotificationBeacons = 
  require('thali/NextGeneration/notification/thaliNotificationBeacons');
var ThaliNotificationClient =
  require('thali/NextGeneration/notification/thaliNotificationClient');
var ThaliMobile =
  require('thali/NextGeneration/ThaliMobile');

var thaliHttpTester = require('../lib/httpTester');

var SECP256K1 = 'secp256k1';
var PORT = 3001;


var globalVariables = {};

/**
 * Initializes globalVariables before the each test run.
 */
function initializeGlobalVariables() {
  globalVariables = {
    clientRequestCounter : 0,
    spyStartUpdateAdvertisingAndListening : null,
    expressApp : express(),
    expressServer : null,
    ThaliNotificationClientProxyquired : null
  };
  
  globalVariables.ThaliNotificationClientProxyquired = 
    proxyquireThaliNotificationClient();
}

/**
 * Frees reserved resources from globalVariables after the each test run.
 */
function destructGlobalVariables() {
  if (globalVariables) {
    if (globalVariables.expressServer) {
      globalVariables.expressServer.close();
    }
  }
}

/**
 * Creates a proxyquired ThaliNotificationServer class. 
 */
function proxyquireThaliNotificationClient() {
  var MockThaliMobile = { };
  var ThaliNotificationClientProxyquired =
    proxyquire('thali/NextGeneration/notification/thaliNotificationClient',
      { '../thaliMobile':
      MockThaliMobile});

  return ThaliNotificationClientProxyquired;
}

var test = tape({
  setup: function (t) {
    initializeGlobalVariables();
    t.end();
  },
  teardown: function (t) {
    destructGlobalVariables();
    t.end();
  }
});

function initializeThaliNotificationClient() {

  var myPublicKey = crypto.createECDH(SECP256K1);
  myPublicKey.generateKeys();
  return new globalVariables.ThaliNotificationClientProxyquired();
  
}

/**
 * Generates two public keys for the test. 
 */
function generatePublicKeys() {
  var publicKeys = [];
  var device1 = crypto.createECDH(SECP256K1);
  var device1Key = device1.generateKeys();
  var device2 = crypto.createECDH(SECP256K1);
  var device2Key = device2.generateKeys();
  publicKeys.push(device1Key, device2Key);
  return publicKeys;
}


test('ThaliNotificationClient 1. test', function (t) {
  
  var dummyPeer = {
    peerIdentifier: 'dummy',
    hostAddress: 'dummy',
    portNumber: 8080
  };
  
  ThaliMobile.emitter.emit('peerAvailabilityChanged',
                                        dummyPeer);
  
  //  var notificationClient = initializeThaliNotificationClient();
  
  //  var notificationClient = new ThaliNotificationClient();
  //  notificationClient.start();
  t.pass();
  t.end();                          
});
