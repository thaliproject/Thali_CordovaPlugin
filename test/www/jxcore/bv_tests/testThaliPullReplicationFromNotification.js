'use strict';


var tape = require('../lib/thaliTape');
var net = require('net');
var crypto = require('crypto');
var thaliConfig = require('thali/NextGeneration/thaliConfig');
var Promise = require('lie');
var testUtils = require('../lib/testUtils');
var makeIntoCloseAllServer = require('thali/NextGeneration/makeIntoCloseAllServer');
var https = require('https');
var httpTester = require('../lib/httpTester');
var ThaliReplicationPeerAction = require('thali/NextGeneration/replication/ThaliReplicationPeerAction');
var thaliMobile = require('thali/NextGeneration/thaliMobile');
var PeerAction = require('thali/NextGeneration/thaliPeerPool/thaliPeerAction');
var ThaliPullReplicationFromNotification = require('thali/NextGeneration/replication/thaliPullReplicationFromNotification');
var proxyquire = require('proxyquire');
var sinon = require('sinon');
var ThaliNotificationClient = require('thali/NextGeneration/notification/thaliNotificationClient');
var ThaliPeerPoolDefault = require('thali/NextGeneration/thaliPeerPool/thaliPeerPoolDefault');

var devicePublicPrivateKey = crypto.createECDH(thaliConfig.BEACON_CURVE);
var devicePublicKey = devicePublicPrivateKey.generateKeys();
var testCloseAllServer = null;
var pskId = 'yo ho ho';
var pskKey = new Buffer('Nothing going on here');
var thaliReplicationPeerAction = null;
var LevelDownPouchDB = testUtils.getLevelDownPouchDb();

// BUGBUG: This is currently ignored for reasons explained
// in thaliReplicationPeerAction.start
var httpAgentPool = null;

var test = tape({
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    thaliReplicationPeerAction && thaliReplicationPeerAction.kill();
    (testCloseAllServer ? testCloseAllServer.closeAllPromise() :
      Promise.resolve())
      .catch(function (err) {
        t.fail('Got error in teardown ' + err);
      })
      .then(function () {
        testCloseAllServer = null;
        t.end();
      });
  }
});

test('Make sure peerDictionaryKey is reasonable', function (t) {
  var thaliPullReplicationFromNotification =
    new ThaliPullReplicationFromNotification(LevelDownPouchDB,
      testUtils.getRandomPouchDBName(), {}, devicePublicPrivateKey);

  var key1 =
    thaliPullReplicationFromNotification._peerDictionaryKey('foo',
                                                      new Buffer('3'));
  var key2 =
    thaliPullReplicationFromNotification._peerDictionaryKey('foo',
                                                      new Buffer('3'));
  t.equal(key1, key2, 'equal keys');

  var key3 =
    thaliPullReplicationFromNotification._peerDictionaryKey('bar',
                                                       new Buffer('3'));
  t.notEqual(key1, key3, 'not equal connection type');

  var key4 =
    thaliPullReplicationFromNotification._peerDictionaryKey('foo',
                                                        new Buffer('4'));

  t.notEqual(key1, key4, 'same connection type, different buffer');

  t.end();
});

test('Make sure start works', function (t) {
  var bufferArray = [];

  var thaliPullReplicationFromNotification =
    new ThaliPullReplicationFromNotification(LevelDownPouchDB,
      testUtils.getRandomPouchDBName(), {}, devicePublicPrivateKey);

  var thaliNotificationClient =
    new ThaliNotificationClient({}, devicePublicPrivateKey);
  var mockThaliNotificationClient = sinon.mock(thaliNotificationClient);
  mockThaliNotificationClient
    .expects('start').exactly(1).withArgs(bufferArray);
  mockThaliNotificationClient.expects('on').exactly(1)
    .withArgs(thaliNotificationClient.Events.PeerAdvertisesDataForUs,
              thaliPullReplicationFromNotification._boundAdvertiser);

  thaliPullReplicationFromNotification._thaliNotificationClient =
    thaliNotificationClient;

  thaliPullReplicationFromNotification.start(bufferArray);

  t.doesNotThrow(
    mockThaliNotificationClient.verify.bind(mockThaliNotificationClient),
    'First start and on called correctly');

  // Call start again to make sure we do nothing
  thaliPullReplicationFromNotification._thaliNotificationClient =
    {};

  thaliPullReplicationFromNotification.start(bufferArray);

  t.end();
});

test('Make sure stop works', function (t) {
  var thaliPullReplicationFromNotification =
    new ThaliPullReplicationFromNotification(LevelDownPouchDB,
      testUtils.getRandomPouchDBName(), {},
      devicePublicPrivateKey);

  // First call does nothing as we haven't called start
  thaliPullReplicationFromNotification._thaliNotificationClient = {};

  thaliPullReplicationFromNotification.stop();

  t.equal(
    Object.getOwnPropertyNames(
      thaliPullReplicationFromNotification._peerDictionary).length, 0,
    'second cleared dictionary');

  var bufferArray = [new Buffer('foo')];
  var thaliNotificationClient =
    new ThaliNotificationClient({}, devicePublicPrivateKey);
  var mockThaliNotificationClient = sinon.mock(thaliNotificationClient);
  mockThaliNotificationClient
    .expects('start').exactly(1).withArgs(bufferArray);
  mockThaliNotificationClient.expects('on').exactly(1)
    .withArgs(thaliNotificationClient.Events.PeerAdvertisesDataForUs,
      thaliPullReplicationFromNotification._boundAdvertiser);

  thaliPullReplicationFromNotification._thaliNotificationClient =
    thaliNotificationClient;

  thaliPullReplicationFromNotification.start(bufferArray);

  t.doesNotThrow(
    mockThaliNotificationClient.verify.bind(mockThaliNotificationClient),
    'First start and on called correctly');

  thaliNotificationClient =
    new ThaliNotificationClient({}, devicePublicPrivateKey);
  mockThaliNotificationClient = sinon.mock(thaliNotificationClient);
  mockThaliNotificationClient
    .expects('stop').exactly(1);
  mockThaliNotificationClient.expects('removeListener').exactly(1)
    .withArgs(thaliNotificationClient.Events.PeerAdvertisesDataForUs,
      thaliPullReplicationFromNotification._boundAdvertiser);

  thaliPullReplicationFromNotification._thaliNotificationClient =
    thaliNotificationClient;

  var actionSpy1 = sinon.spy();
  var action1 = {
    kill: actionSpy1
  };

  var actionSpy2 = sinon.spy();
  var action2 = {
    kill: actionSpy2
  };

  thaliPullReplicationFromNotification._peerDictionary.foo = action1;
  thaliPullReplicationFromNotification._peerDictionary.bar = action2;

  thaliPullReplicationFromNotification.stop();

  t.doesNotThrow(
    mockThaliNotificationClient.verify.bind(mockThaliNotificationClient),
    'First stop and removeListener called correctly');
  t.ok(actionSpy1.calledOnce, 'first action kill called');
  t.ok(actionSpy2.calledOnce, 'second action kill called');
  t.equal(
    Object.getOwnPropertyNames(
      thaliPullReplicationFromNotification._peerDictionary).length, 0,
    'first cleared dictionary');

  // Call stop again, make sure we do nothing
  thaliPullReplicationFromNotification._thaliNotificationClient = {};

  thaliPullReplicationFromNotification.stop();

  t.equal(
    Object.getOwnPropertyNames(
      thaliPullReplicationFromNotification._peerDictionary).length, 0,
    'second cleared dictionary');

  t.end();
});

/*
 Make sure peerAdvertisesDataForUsHandler -
 Finds existing entries when it should
 Doesn't find entries when it shouldn't (e.g. it's started or is killed)
 Properly distinguishes between wifi and bluetooth
 Creates a new peer action with the right arguments
 That we can successfully intercept both start and kill on the action and
 we properly clean up the dictionary
 Make sure we submit the action to the peer pool interface



 Submit a peer event for a key we don't have and make sure we add it to the
 dictionary and submit it to the pool

 Submit a peer event for a key we do have and make sure we kill the existing
 one and create a new one and do as previous

 Submit a peer event for a similar but different key than we already have and
 make sure we do the previous.

  Submit a peer event for a key we don't have and then have the pool call
  start on it and make sure we yank it from the dictionary

  Submit a peer event for a key we don't have and then have the pool call kill
  on it and make sure we yank it from the dictionary (for fun have the pool
  call kill twice just to make sure we don't do anything the second time)
 */

test('Simple peer event', function (t) {
  var enqueueSpy = sinon.spy();
  var fakePool = {
    enqueue: enqueueSpy
  };

  var thaliPullReplicationFromNotification =
    new ThaliPullReplicationFromNotification(LevelDownPouchDB,
      testUtils.getRandomPouchDBName(), fakePool,
      devicePublicPrivateKey);



});
