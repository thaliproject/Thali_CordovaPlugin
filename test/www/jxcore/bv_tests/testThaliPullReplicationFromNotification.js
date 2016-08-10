'use strict';


var tape = require('../lib/thaliTape');
var crypto = require('crypto');
var thaliConfig = require('thali/NextGeneration/thaliConfig');
var Promise = require('lie');
var testUtils = require('../lib/testUtils');
var PeerAction = require('thali/NextGeneration/thaliPeerPool/thaliPeerAction');
var ThaliPullReplicationFromNotification = require('thali/NextGeneration/replication/thaliPullReplicationFromNotification');
var proxyquire = require('proxyquire');
var sinon = require('sinon');
var ThaliNotificationClient = require('thali/NextGeneration/notification/thaliNotificationClient');

var devicePublicPrivateKey = crypto.createECDH(thaliConfig.BEACON_CURVE);
devicePublicPrivateKey.generateKeys();

var testCloseAllServer = null;
var thaliReplicationPeerAction = null;
var LevelDownPouchDB = testUtils.getLevelDownPouchDb();

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
  var key1 =
    ThaliPullReplicationFromNotification._peerDictionaryKey('foo',
                                                      new Buffer('3'));
  var key2 =
    ThaliPullReplicationFromNotification._peerDictionaryKey('foo',
                                                      new Buffer('3'));
  t.equal(key1, key2, 'equal keys');

  var key3 =
    ThaliPullReplicationFromNotification._peerDictionaryKey('bar',
                                                       new Buffer('3'));
  t.notEqual(key1, key3, 'not equal connection type');

  var key4 =
    ThaliPullReplicationFromNotification._peerDictionaryKey('foo',
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

function matchEntryInDictionary(t, thaliPullReplicationFromNotification, fakeAd,
                                spyAction) {
  var actionKey =
    ThaliPullReplicationFromNotification._peerDictionaryKey(
      fakeAd.connectionType,
      fakeAd.keyId);

  t.equal(
    thaliPullReplicationFromNotification._peerDictionary[actionKey],
    spyAction.args[0], 'Dictionary and pool have same action');
}

function checkPeerCreation(t, dictionaryEntries,
                           thaliPullReplicationFromNotification, spyAction,
                           peerAction, fakeAd, fakeDbName) {
  t.equal(Object.getOwnPropertyNames(
    thaliPullReplicationFromNotification._peerDictionary).length,
    dictionaryEntries,
    'peer dictionary has expected number of entries');

  matchEntryInDictionary(t, thaliPullReplicationFromNotification, fakeAd,
    spyAction);

  t.equal(peerAction.theArguments[0], fakeAd, 'ads match');
  t.equal(peerAction.theArguments[1], LevelDownPouchDB, 'PouchDB matches');
  t.equal(peerAction.theArguments[2], fakeDbName, 'DB Names match');
  t.ok(Buffer.compare(peerAction.theArguments[3],
      devicePublicPrivateKey.getPublicKey()) === 0,
    'public keys match');
}

test('Simple peer event', function (t) {
  var enqueueSpy = sinon.spy();
  var fakePool = {
    enqueue: enqueueSpy
  };

  var listener = null;
  var fakeNotification = {
    start: function () {},
    on: function (listerName, theListener) {
      listener = theListener;
    },
    Events: {
      PeerAdvertisesDataForUs: 'something'
    }
  };

  var fakeDbName = testUtils.getRandomPouchDBName();

  var peerActions = [];
  var ProxiesPullReplication = proxyquire.noCallThru()
    .load(
      'thali/NextGeneration/replication/thaliPullReplicationFromNotification',
      {
        './thaliReplicationPeerAction': function () {
          var startSpy = sinon.spy();
          var killSpy = sinon.spy();
          peerActions.push({
            theArguments: arguments,
            startSpy: startSpy,
            killSpy: killSpy
          });
          return {
            start: startSpy,
            kill: killSpy,
            getActionState: function () {
              return PeerAction.actionState.CREATED;
            }
          };
        }
      });

  var thaliPullReplicationFromNotification =
    new ProxiesPullReplication(LevelDownPouchDB, fakeDbName, fakePool,
      devicePublicPrivateKey);

  thaliPullReplicationFromNotification._thaliNotificationClient =
    fakeNotification;

  thaliPullReplicationFromNotification.start([]);

  var fakeAd = {
    keyId: new Buffer('foo'),
    pskIdentityField: 'bar',
    psk: new Buffer('blah'),
    hostAddress: '127.0.0.1',
    portNumber: 33,
    suggestedTCPTimeout: 10,
    connectionType: 'something'
  };

  t.ok(listener, 'listener has been set');
  listener(fakeAd);
  var firstAction = peerActions[0];
  checkPeerCreation(t, 1,
    thaliPullReplicationFromNotification, enqueueSpy.getCall(0), firstAction,
    fakeAd, fakeDbName);

  // Start second action just to make sure it gets added
  var fakeAd2 = {
    keyId: new Buffer('foo'),
    pskIdentityField: 'bar',
    psk: new Buffer('blah'),
    hostAddress: '127.0.0.1',
    portNumber: 33,
    suggestedTCPTimeout: 10,
    connectionType: 'somethingElse'
  };

  listener(fakeAd2);
  var secondAction = peerActions[1];
  checkPeerCreation(t, 2, thaliPullReplicationFromNotification,
    enqueueSpy.getCall(1), secondAction, fakeAd2, fakeDbName);

  // Start first action and make sure we remove it from dictionary
  enqueueSpy.firstCall.args[0].start();

  t.ok(firstAction.startSpy.calledOnce, 'start called once');
  t.equal(firstAction.killSpy.callCount, 0, 'kill never called');
  t.equal(Object.getOwnPropertyNames(
    thaliPullReplicationFromNotification._peerDictionary).length, 1,
    'One entry left');
  matchEntryInDictionary(t, thaliPullReplicationFromNotification, fakeAd2,
                         enqueueSpy.getCall(1));

  // Kill second action and make sure we remove it from dictionary
  enqueueSpy.secondCall.args[0].kill();

  t.equal(secondAction.startSpy.callCount, 0, 'Start never called');
  t.ok(secondAction.killSpy.calledOnce, 'Kill called once');
  t.equal(Object.getOwnPropertyNames(
    thaliPullReplicationFromNotification._peerDictionary).length, 0,
    'no entries left');

  // Call kill again just to show it doesn't do any harm
  enqueueSpy.secondCall.args[0].kill();

  // Add peer and update with matching peer to show we replace
  listener(fakeAd2);

  var fakeAd3 = {
    keyId: new Buffer('foo'),
    pskIdentityField: 'bar',
    psk: new Buffer('blah'),
    hostAddress: '128.0.0.1',
    portNumber: 33,
    suggestedTCPTimeout: 10,
    connectionType: 'somethingElse'
  };
  listener(fakeAd3);

  var thirdAction = peerActions[2];
  t.equal(thirdAction.killSpy.callCount, 1, 'Third action is dead');

  var fourthAction = peerActions[3];
  checkPeerCreation(t, 1, thaliPullReplicationFromNotification,
    enqueueSpy.getCall(3), fourthAction, fakeAd3, fakeDbName);

  t.end();
});
