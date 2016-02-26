var tape = require('../lib/thali-tape');
var express = require('express');
var crypto = require('crypto');
var sinon = require('sinon');
var Promise = require('lie');
var ThaliPeerDictionary =
  require('thali/NextGeneration/notification/thaliPeerDictionary');
var ThaliNotificationAction =
  require('thali/NextGeneration/notification/thaliNotificationAction');
var ThaliMobile =
  require('thali/NextGeneration/thaliMobile');

var SECP256K1 = 'secp256k1';



var test = tape({
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    
    t.end();
  }
});

test('ThaliNotificationClient 1. test', function (t) {
  
  var myPublicKey = crypto.createECDH(SECP256K1);
  myPublicKey.generateKeys();


  var act = new ThaliNotificationAction('dummy', ThaliMobile.connectionTypes.BLUETOOTH, 'actionType', myPublicKey);
                  
  var peerDict = new ThaliPeerDictionary.PeerConnectionInformation('127.0.0.1', 3001, 10);
  
  var dict = new ThaliPeerDictionary.PeerDictionary();
  
  var entry = new ThaliPeerDictionary.NotificationPeerDictionaryEntry();
  
  dict.addUpdateEntry("1",{});
  
  
    
  
  t.pass();
  t.end();                          
});
