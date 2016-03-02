'use strict';
var tape = require('../lib/thali-tape');
var crypto = require('crypto');

var PeerDictionary =
  require('thali/NextGeneration/notification/thaliPeerDictionary');
var ThaliNotificationAction =
  require('thali/NextGeneration/notification/thaliNotificationAction');
var ThaliMobile =
  require('thali/NextGeneration/thaliMobile');

var SECP256K1 = 'secp256k1';

var ENTRY1 = 'entry1';
var ENTRY2 = 'entry2';


var test = tape({
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    
    t.end();
  }
});

function createEntry(name, state) {

  var myPublicKey = crypto.createECDH(SECP256K1);
  myPublicKey.generateKeys();
  
  var act = new ThaliNotificationAction(name, 
    ThaliMobile.connectionTypes.BLUETOOTH, myPublicKey , function () {});

  var peerConnInfo = 
    new PeerDictionary.PeerConnectionInformation('127.0.0.1', 3001, 10);
  
  return new PeerDictionary.NotificationPeerDictionaryEntry(
    state, peerConnInfo, act);
}

function addEntries(dictionary, baseString, state, count) {
  for (var i = 0 ; i < count ; i++) {
    var entry = createEntry(baseString + i, state);
    dictionary.addUpdateEntry(baseString + i, entry);
  }
}


test('Test PeerDictionary basic functionality', function (t) {
  var dictionary = new PeerDictionary.PeerDictionary();
  
  var entry1 = createEntry(ENTRY1, PeerDictionary.peerState.RESOLVED);
  var entry2 = createEntry(ENTRY2, PeerDictionary.peerState.RESOLVED);
  
  dictionary.addUpdateEntry(ENTRY1, entry1);
  t.equal(dictionary._entryCounter, 1, 'Entry counter must be 1');
  
  dictionary.addUpdateEntry(ENTRY2, entry2);
  t.equal(dictionary._entryCounter, 2, 'Entry counter must be 2');
  
  dictionary.remove(ENTRY2);
  t.equal(dictionary.size(), 1, 'Size must be 1');
  
  dictionary.remove(ENTRY1);
  t.equal(dictionary.size(), 0, 'Size must be 0');
  
  addEntries(dictionary, 'resolved_', PeerDictionary.peerState.RESOLVED, 
    PeerDictionary.PeerDictionary.MAXSIZE + 20 );
  
  t.equal(dictionary.size(), PeerDictionary.PeerDictionary.MAXSIZE, 'Size must be 100');
  
  t.end();                          
});
