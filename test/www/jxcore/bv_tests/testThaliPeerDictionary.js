'use strict';
var tape = require('../lib/thaliTape');
var crypto = require('crypto');
var sinon = require('sinon');

var PeerDictionary =
  require('thali/NextGeneration/notification/thaliPeerDictionary');
var ThaliNotificationAction =
  require('thali/NextGeneration/notification/thaliNotificationAction');
var ThaliMobileNativeWrapper =
  require('thali/NextGeneration/thaliMobileNativeWrapper');
var thaliConfig = require('thali/NextGeneration/thaliConfig');

var PEER1_1 = { peerIdentifier: 'peer1', generation: 1 };
var PEER1_2 = { peerIdentifier: 'peer1', generation: 2 };
var PEER2_1 = { peerIdentifier: 'peer2', generation: 1 };
var PEER2_2 = { peerIdentifier: 'peer2', generation: 2 };

var test = tape({
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    t.end();
  }
});

/**
 * Crates a new entry and tags all objects in it with the given peer.
 *
 * @param {Object} peer
 * @param {string} peer.peerIdentifier
 * @param {number} peer.generation
 * @param {module:thaliPeerDictionary.peerState} state
 */
function createEntry(peer, state) {

  var tagName = peer.peerIdentifier + ':' + peer.generation;

  var myPublicKey = crypto.createECDH(thaliConfig.BEACON_CURVE);
  myPublicKey.generateKeys();

  // JSON.parse(JSON.stringify()) doesn't properly handle callback functions
  // that's why we pass empty object as 4th parameter instead of a callback
  // function.
  var actionPeer = {
    peerIdentifier: peer.peerIdentifier,
    generation: peer.generation,
    connectionType: ThaliMobileNativeWrapper.connectionTypes.TCP_NATIVE
  };
  var act = new ThaliNotificationAction(actionPeer, myPublicKey, {});

  act._nameTag = tagName;

  var newEntry = new PeerDictionary.NotificationPeerDictionaryEntry(
    state, act );

  newEntry._nameTag = tagName;

  return newEntry;
}

/**
 * Adds a series of entries for different peer identifiers to the dictionary
 * object.
 *
 * @param {module:thaliPeerDictionary.PeerDictionary} dictionary An
 * incoming peer dictionary.
 * @param {string} baseString The prefix for each entry peer identifier.
 * @param {number} generation The generation for each entry.
 * @param {module:thaliPeerDictionary.peerState} state
 * @param {number} count The number of entries that will be created.
 */
function addEntries(dictionary, baseString, generation, state, count) {
  for (var i = 0 ; i < count ; i++) {
    var peer = {
      peerIdentifier: baseString + i,
      generation: generation,
    };
    var entry = createEntry(peer, state);
    dictionary.addUpdateEntry(peer, entry);
  }
}

/**
 * Checks that objects inside the entry have a unique tag. This
 * ensures objects haven't been replaced with new accidentally.
 *
 * @param {Object} peer
 * @param {string} peer.peerIdentifier
 * @param {number} peer.generation
 * @param {module:thaliPeerDictionary~NotificationPeerDictionaryEntry} entry
 */
function testMatch(peer, entry) {
  var tagName = peer.peerIdentifier + ':' + peer.generation;
  if (entry._nameTag !== tagName ||
    entry.notificationAction._nameTag !== tagName) {
    return false;
  }
  for (var key in entry.peerConnectionDictionary) {
    if (entry.peerConnectionDictionary[key]._nameTag !== tagName) {
      return false;
    }
  }
  return true;
}

/**
 * Verifies that a series of entries exists in the dictionary.
 *
 * @param {module:thaliPeerDictionary.PeerDictionary} dictionary
 * @param {string} baseString prefix
 * @param {number} generation
 * @param {number} start counter start
 * @param {number} end counter end
 */
function verifyEntries(dictionary, baseString, generation, start, end) {

  for (var i = start; i <= end; i++) {
    var peer = {
      peerIdentifier: baseString + i,
      generation: generation,
    };
    if (!dictionary.exists(peer)) {
      return false;
    }
    if (!testMatch(peer, dictionary.get(peer))) {
      return false;
    }
  }
  return true;
}

test('Test PeerDictionary basic functionality', function (t) {
  var dictionary = new PeerDictionary.PeerDictionary();

  var entry1_1 = createEntry(PEER1_1, PeerDictionary.peerState.RESOLVED);
  var entry1_2 = createEntry(PEER1_2, PeerDictionary.peerState.RESOLVED);
  var entry2_1 = createEntry(PEER2_1, PeerDictionary.peerState.RESOLVED);
  var entry2_2 = createEntry(PEER2_2, PeerDictionary.peerState.RESOLVED);

  dictionary.addUpdateEntry(PEER1_1, entry1_1);
  t.equal(dictionary._entryCounter, 1, 'Entry counter must be 1');
  t.equal(dictionary.exists(PEER1_1), true, 'Entry exists');
  t.equal(dictionary.size(), 1, 'Size must be 1');

  dictionary.addUpdateEntry(PEER2_1, entry2_1);
  t.equal(dictionary._entryCounter, 2, 'Entry counter must be 2');
  t.equal(dictionary.exists(PEER2_1), true, 'Entry exists');
  t.equal(dictionary.size(), 2, 'Size must be 2');

  dictionary.addUpdateEntry(PEER1_2, entry1_2);
  t.equal(dictionary._entryCounter, 3, 'Entry counter must be 1');
  t.equal(dictionary.exists(PEER1_2), true, 'Entry exists');
  t.equal(dictionary.size(), 3, 'Size must be 3');

  dictionary.addUpdateEntry(PEER2_2, entry2_2);
  t.equal(dictionary._entryCounter, 4, 'Entry counter must be 2');
  t.equal(dictionary.exists(PEER2_2), true, 'Entry exists');
  t.equal(dictionary.size(), 4, 'Size must be 4');

  dictionary.remove(PEER1_1);
  t.equal(dictionary.get(PEER1_1), null, 'Entry 1_1 should not be found');
  t.equal(dictionary.exists(PEER1_1), false, 'Entry 1_1 does not exist');
  t.equal(dictionary.size(), 3, 'Size must be 3');

  dictionary.remove(PEER1_2);
  t.equal(dictionary.get(PEER1_2), null, 'Entry 1_2 should not be found');
  t.equal(dictionary.exists(PEER1_2), false, 'Entry 1_2 does not exist');
  t.equal(dictionary.size(), 2, 'Size must be 2');

  t.equal(PEER2_1.peerIdentifier, PEER2_2.peerIdentifier);
  dictionary.removeAllPeerEntries(PEER2_1.peerIdentifier);
  t.equal(dictionary.get(PEER2_1), null, 'Entry 2_1 should not be found');
  t.equal(dictionary.get(PEER2_2), null, 'Entry 2_2 should not be found');
  t.equal(dictionary.exists(PEER2_1), false, 'Entry 2_1 does not exist');
  t.equal(dictionary.exists(PEER2_2), false, 'Entry 2_2 does not exist');
  t.equal(dictionary.size(), 0, 'Size must be 0');

  // We should be able to remove non existing entry without
  // any errors
  dictionary.remove(PEER2_1);

  t.end();
});

test('Test PeerDictionary with multiple entries.', function (t) {

  // Tests that the dictionary size remains always under
  // PeerDictionary.PeerDictionary.MAXSIZE
  var dictionary = new PeerDictionary.PeerDictionary();

  addEntries(dictionary, 'resolved_', 0, PeerDictionary.peerState.RESOLVED,
    PeerDictionary.PeerDictionary.MAXSIZE + 20 );

  t.equal(dictionary.size(), PeerDictionary.PeerDictionary.MAXSIZE,
    'Size must be'+ PeerDictionary.PeerDictionary.MAXSIZE);

  // Tests that the newest entries remained (entries 20 - MAXSIZE+20)
  var entriesExist = verifyEntries(dictionary, 'resolved_', 0,
    20, PeerDictionary.PeerDictionary.MAXSIZE + 19);

  t.equal(entriesExist, true,
    'Entries between 20 and MAXSIZE + 20 should exist');

  var dictionary2 = new PeerDictionary.PeerDictionary();

  var entryWaiting = createEntry(PEER1_1, PeerDictionary.peerState.WAITING);
  dictionary2.addUpdateEntry(PEER1_1, entryWaiting);

  addEntries(dictionary2, 'resolved_', 0, PeerDictionary.peerState.RESOLVED,
    PeerDictionary.PeerDictionary.MAXSIZE + 20 );

  var entry = dictionary2.get(PEER1_1);

  t.ok(entry != null, 'WAITING state entry should not be removed');

  t.end();
});

test('RESOLVED entries are removed before WAITING state entry.', function (t) {

  var dictionary = new PeerDictionary.PeerDictionary();

  var entryWaiting = createEntry(PEER1_1, PeerDictionary.peerState.WAITING);
  dictionary.addUpdateEntry(PEER1_1, entryWaiting);

  addEntries(dictionary, 'resolved_', 0, PeerDictionary.peerState.RESOLVED,
    PeerDictionary.PeerDictionary.MAXSIZE + 5 );


  // Ensures that expected resolved entries remained.
  var entriesExist = verifyEntries(dictionary, 'resolved_', 0,
    6, PeerDictionary.PeerDictionary.MAXSIZE + 4);

  t.equal(entriesExist, true,
    'Entries between 6 and MAXSIZE + 4 should exist');

  t.equal(dictionary.size(), PeerDictionary.PeerDictionary.MAXSIZE,
    'Size should be MAXSIZE');

  t.equal(dictionary._entryCounter, PeerDictionary.PeerDictionary.MAXSIZE+6,
    'Size should be MAXSIZE+6');

  t.end();
});

test('WAITING entries are removed before CONTROLLED_BY_POOL state entry.',
  function (t) {
    var dictionary = new PeerDictionary.PeerDictionary();

    var entryControlledByPool = createEntry(PEER1_1,
      PeerDictionary.peerState.CONTROLLED_BY_POOL);

    dictionary.addUpdateEntry(PEER1_1, entryControlledByPool);

    addEntries(dictionary, 'waiting_', 0, PeerDictionary.peerState.WAITING,
      PeerDictionary.PeerDictionary.MAXSIZE + 5 );

    var entry = dictionary.get(PEER1_1);

    t.ok(entry != null, 'WAITING state entry should not be removed');

    // Ensures that expected waiting entries remained.
    var entriesExist = verifyEntries(dictionary, 'waiting_', 0,
      6, PeerDictionary.PeerDictionary.MAXSIZE + 4);

    t.equal(entriesExist, true,
      'Waiting entries between 6 and MAXSIZE + 4 should exist');

    t.equal(dictionary.size(), PeerDictionary.PeerDictionary.MAXSIZE,
      'Size should be MAXSIZE');

    t.equal(dictionary._entryCounter, PeerDictionary.PeerDictionary.MAXSIZE+6,
      'entryCounter should be MAXSIZE+6');

    t.end();
  });

test('When CONTROLLED_BY_POOL entry is removed and kill is called.',
  function (t) {
    var dictionary = new PeerDictionary.PeerDictionary();

    var entryControlledByPool = createEntry(PEER1_1,
      PeerDictionary.peerState.CONTROLLED_BY_POOL);

    dictionary.addUpdateEntry(PEER1_1, entryControlledByPool);

    var spyKill =
      sinon.spy(entryControlledByPool.notificationAction, 'kill');

    addEntries(dictionary, 'waiting_', 0,
      PeerDictionary.peerState.CONTROLLED_BY_POOL,
      PeerDictionary.PeerDictionary.MAXSIZE + 5 );

    t.equals(spyKill.callCount, 1,
      'Kill should be called once');
    t.equals(dictionary.size(), PeerDictionary.PeerDictionary.MAXSIZE,
      'Size should be MAXSIZE');

    t.end();
  });



