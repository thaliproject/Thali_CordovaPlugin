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
var ThaliNotificationAction =
  require('thali/NextGeneration/notification/thaliNotificationAction');

var PeerDictionary = require('thali/NextGeneration/notification/thaliPeerDictionary');

var SECP256K1 = 'secp256k1';

var globals = {};

/**
 * @classdesc This class is a container for all variables and
 * functionality that are common to most of the ThaliNoficationServer
 * tests.
 */
var GlobalVariables = function () {

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
  var myPublicKey = crypto.createECDH(SECP256K1);
  myPublicKey.generateKeys();
  var connInfo = new PeerDictionary.PeerConnectionInformation('127.0.0.1', 3001, 10);

  var act = new ThaliNotificationAction('hello',
    ThaliMobile.connectionTypes.TCP_NATIVE,
    myPublicKey, null, connInfo);

  t.end();
});

test('Replace the connectionType BLUETOOTH with TCP_NATIVE', function (t) {


});
