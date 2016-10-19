'use strict';

var testUtils = require('../lib/testUtils.js');
var crypto = require('crypto');
var Promise = require('bluebird');
var tape = require('../lib/thaliTape');
var thaliConfig = require('thali/NextGeneration/thaliConfig');
var ThaliManager = require('thali/NextGeneration/thaliManager');
var ThaliPeerPoolBigReplication = require('thali/NextGeneration/thaliPeerPool/thaliPeerPoolBigReplication');
var PouchDB = require('pouchdb');
var ExpressPouchDB = require('express-pouchdb');
var util = require('util');
var ThaliPeerPoolInterface = require('thali/NextGeneration/thaliPeerPool/thaliPeerPoolInterface');
var ThaliNotificationAction = require('thali/NextGeneration/notification/thaliNotificationAction');
var ThaliReplicationPeerAction = require('thali/NextGeneration/replication/thaliReplicationPeerAction');
var platform = require('thali/NextGeneration/utils/platform');
var ForeverAgent = require('forever-agent');
var ThaliPeerAction = require('thali/NextGeneration/thaliPeerPool/thaliPeerAction');
var sinon = require('sinon');
var asserts = require('../lib/utils/asserts');
var ThaliMobileNativeWrapper = require('thali/NextGeneration/thaliMobileNativeWrapper');
var ThaliMobile = require('thali/NextGeneration/thaliMobile');

var DB_NAME = 'testThaliPeerPoolBigReplication';
PouchDB = testUtils.getLevelDownPouchDb();

var ecdhForLocalDevice = crypto.createECDH(thaliConfig.BEACON_CURVE);
var publicKeyForLocalDevice = ecdhForLocalDevice.generateKeys();
var publicBase64KeyForLocalDevice = ecdhForLocalDevice.getPublicKey('base64');

var thaliManager = null;

var test = tape({
  setup: function (t) {
    t.data = publicKeyForLocalDevice.toJSON();
    t.end();
  },
  teardown: function (t) {
    return (thaliManager ? thaliManager.stop() : Promise.resolve())
      .catch(function (err) {
        t.fail('Got error in teardown ' + err);
      })
      .then(function () {
        t.ok(true, 'We came back from thaliManager stop!');
        t.end();
      });
  }
});

// TODO: Write a test showing we reject unrecognized actions

function FakePeerAction(connectionType, actionType, peerId, actionState) {
  this._connectionType = connectionType;
  this._actionType = actionType;
  this._peerId = peerId;
  this._actionState = actionState;
}

FakePeerAction.prototype.getConnectionType = function () {
  return this._connectionType;
};

FakePeerAction.prototype.getActionType = function () {
  return this._actionType;
};

FakePeerAction.prototype.getPeerId = function () {
  return this._peerId;
};

FakePeerAction.prototype.getActionState = function () {
  return this._actionState;
};

test('Check searchQueue', sinon.test(function (t) {
    function match(result, correctActions, description) {
      t.equal(result.length, correctActions.length,
        'Right number of results for ' + description);
      result.forEach(function (action) {
        t.ok(correctActions.indexOf(action) !== -1, 'Found action for ' +
          description);
      });
    }

    this.stub(ThaliPeerPoolBigReplication, '_getPeerIdFromAction',
      function (action) {
        return action.getPeerId();
      });

    var thaliPeerPoolBigReplication = new ThaliPeerPoolBigReplication();

    match(thaliPeerPoolBigReplication._searchQueue('foo', null, null, false),
      [], 'Searching an empty queue');

    var deadAction = new FakePeerAction('foo', 'bar', 'blah',
      ThaliPeerAction.actionState.KILLED);
    thaliPeerPoolBigReplication._queue.push(deadAction);

    var liveAction = new FakePeerAction('foo', 'bar', 'blah',
      ThaliPeerAction.actionState.STARTED);
    thaliPeerPoolBigReplication._queue.push(liveAction);

    var irrelevantAction = new FakePeerAction('1', '2', '3', '4');
    thaliPeerPoolBigReplication._queue.push(irrelevantAction);

    // Yes, I know, we really should just do a combinatorial walk through all
    // possible combinations of matching arguments. Not today.

    match(thaliPeerPoolBigReplication._searchQueue('ick', 'rick', 'nick',
      false), [], 'No match');

    match(thaliPeerPoolBigReplication._searchQueue('foo', null, null, true),
      [liveAction], 'connectionType');

    match(thaliPeerPoolBigReplication._searchQueue(null, 'bar', null, true),
      [liveAction], 'actionType');

    match(thaliPeerPoolBigReplication._searchQueue(null, null, 'blah', true),
      [liveAction], 'peerID');

    match(thaliPeerPoolBigReplication._searchQueue('foo', 'bar', 'blah', true),
      [liveAction], 'Now with everything');

    match(thaliPeerPoolBigReplication._searchQueue('foo', 'bar', 'blah', false),
      [liveAction, deadAction], 'Now with everything and killed');

    t.end();
  }));

test('Test case 2', function (t) {
  t.throws(function () {
    ThaliPeerPoolBigReplication._case2([], 'foo');
  }, 'Bad number of actions');

  t.throws(function () {
    ThaliPeerPoolBigReplication._case2(
      [new FakePeerAction('foo', 'bar', 'blah', 'ick'),
       new FakePeerAction('blah', 'blo', 'blue', 'blee')], 'bar');
  }, 'At least one action has to be started');

  t.throws(function () {
    ThaliPeerPoolBigReplication._case2(
      [new FakePeerAction('foo', 'bar', 'blah',
        ThaliPeerAction.actionState.STARTED),
       new FakePeerAction('blah', 'blo', 'blue',
         ThaliPeerAction.actionState.STARTED)], 'icky'); },
  'No more than one action can be started');

  var started = new FakePeerAction('foo', 'foo', 'foo',
    ThaliPeerAction.actionState.STARTED);
  started.test = function() {
    t.fail('This should not have been called');
  };

  var testPassed = false;
  var notStarted = new FakePeerAction('foo', 'foo', 'foo', 'foo');
  notStarted.test = function () {
    testPassed = true;
  };

  ThaliPeerPoolBigReplication._case2([started, notStarted], 'test');

  t.ok(testPassed, 'We called the right action');
  t.end();
});

test('Test notificationActionEnqueue', sinon.test(function (t) {
  this.stub(ThaliPeerPoolBigReplication, '_getPeerIdFromAction',
    function (action) {
      return action.getPeerId();
    });

  var thaliPeerPoolBigReplication = new ThaliPeerPoolBigReplication();

  var killSupersededCalled = false;
  var firstAction = new FakePeerAction('foo', 'bar', 'blah',
    ThaliPeerAction.actionState.CREATED);
  firstAction.killSuperseded = function () {
    killSupersededCalled = true;
    thaliPeerPoolBigReplication._killAction(firstAction);
  };
  t.notOk(thaliPeerPoolBigReplication._notificationActionEnqueue(firstAction),
    "first call returns null");
  asserts.arrayEquals(thaliPeerPoolBigReplication._queue, [firstAction]);

  var secondAction = new FakePeerAction('foo2', 'bar2', 'blah2', 'ick');
  t.notOk(thaliPeerPoolBigReplication._notificationActionEnqueue(secondAction),
    "second call returns null");
  asserts.arrayEquals(thaliPeerPoolBigReplication._queue,
    [secondAction, firstAction]);

  var thirdAction = new FakePeerAction('foo', 'bar', 'blah',
    ThaliPeerAction.actionState.STARTED);
  t.notOk(thaliPeerPoolBigReplication._notificationActionEnqueue(thirdAction),
    "third call returns null");
  t.ok(killSupersededCalled, 'First action should have been killed');
  asserts.arrayEquals(thaliPeerPoolBigReplication._queue,
    [thirdAction, secondAction]);

  var fourthKillSupersededCalled = false;
  var fourthAction = new FakePeerAction('foo', 'bar', 'blah',
    ThaliPeerAction.actionState.CREATED);
  fourthAction.killSuperseded = function () {
    fourthKillSupersededCalled = true;
    thaliPeerPoolBigReplication._killAction(fourthAction);
  };
  t.notOk(thaliPeerPoolBigReplication._notificationActionEnqueue(fourthAction),
    "Fourth call returns null");
  asserts.arrayEquals(thaliPeerPoolBigReplication._queue,
    [fourthAction, thirdAction, secondAction]);

  var fifthAction = new FakePeerAction('foo', 'bar', 'blah',
    ThaliPeerAction.actionState.CREATED);
  t.notOk(thaliPeerPoolBigReplication._notificationActionEnqueue(fifthAction),
    "Fifth call returns null");
  t.ok(fourthKillSupersededCalled, 'Fourth action should have been killed');
  asserts.arrayEquals(thaliPeerPoolBigReplication._queue,
    [fifthAction, thirdAction, secondAction]);

  t.end();
}));

test.skip('Test replicationActionEnqueue', sinon.test(function (t) {
  this.stub(ThaliPeerPoolBigReplication, '_getPeerIdFromAction',
    function (action) {
      return action.getPeerId();
    });

  var thaliPeerPoolBigReplication = new ThaliPeerPoolBigReplication();

  var killedNotification = new FakePeerAction(
    ThaliMobileNativeWrapper.connectionTypes.BLUETOOTH,
    ThaliNotificationAction.ACTION_TYPE,
    'foo', ThaliPeerAction.actionState.KILLED);
  killedNotification.getResolution = function () {
    return ThaliNotificationAction.ActionResolution
      .BEACONS_RETRIEVED_AND_PARSED;
  };

  thaliPeerPoolBigReplication._queue.push(killedNotification);

  var replicationFromNotification = new FakePeerAction(
    ThaliMobileNativeWrapper.connectionTypes.BLUETOOTH,
    ThaliReplicationPeerAction.ACTION_TYPE,
    'foo', ThaliPeerAction.actionState.CREATED);

  t.notOk(thaliPeerPoolBigReplication.
    _replicationActionEnqueue(replicationFromNotification),
    'First rep returns null');





  var killSupersededCalled = false;
  var firstAction = new FakePeerAction('foo', 'bar', 'blah',
    ThaliPeerAction.actionState.CREATED);
  firstAction.killSuperseded = function () {
    killSupersededCalled = true;
    thaliPeerPoolBigReplication._killAction(firstAction);
  };
  t.notOk(thaliPeerPoolBigReplication._notificationActionEnqueue(firstAction),
    "first call returns null");
  asserts.arrayEquals(thaliPeerPoolBigReplication._queue, [firstAction]);

  var secondAction = new FakePeerAction('foo2', 'bar2', 'blah2', 'ick');
  t.notOk(thaliPeerPoolBigReplication._notificationActionEnqueue(secondAction),
    "second call returns null");
  asserts.arrayEquals(thaliPeerPoolBigReplication._queue,
    [secondAction, firstAction]);

  var thirdAction = new FakePeerAction('foo', 'bar', 'blah',
    ThaliPeerAction.actionState.STARTED);
  t.notOk(thaliPeerPoolBigReplication._notificationActionEnqueue(thirdAction),
    "third call returns null");
  t.ok(killSupersededCalled, 'First action should have been killed');
  asserts.arrayEquals(thaliPeerPoolBigReplication._queue,
    [thirdAction, secondAction]);

  var fourthKillSupersededCalled = false;
  var fourthAction = new FakePeerAction('foo', 'bar', 'blah',
    ThaliPeerAction.actionState.CREATED);
  fourthAction.killSuperseded = function () {
    fourthKillSupersededCalled = true;
    thaliPeerPoolBigReplication._killAction(fourthAction);
  };
  t.notOk(thaliPeerPoolBigReplication._notificationActionEnqueue(fourthAction),
    "Fourth call returns null");
  asserts.arrayEquals(thaliPeerPoolBigReplication._queue,
    [fourthAction, thirdAction, secondAction]);

  var fifthAction = new FakePeerAction('foo', 'bar', 'blah',
    ThaliPeerAction.actionState.CREATED);
  t.notOk(thaliPeerPoolBigReplication._notificationActionEnqueue(fifthAction),
    "Fifth call returns null");
  t.ok(fourthKillSupersededCalled, 'Fourth action should have been killed');
  asserts.arrayEquals(thaliPeerPoolBigReplication._queue,
    [fifthAction, thirdAction, secondAction]);

  t.end();
}));


if (!tape.coordinated) {
  return;
}

function ProgrammableEnqueuePolicy(enqueueFn) {
  ProgrammableEnqueuePolicy.super_.call(this);
  this.enqueueFn = enqueueFn;
}

util.inherits(ProgrammableEnqueuePolicy, ThaliPeerPoolInterface);

ProgrammableEnqueuePolicy.prototype.enqueue = function (peerAction) {
  var result =
    ProgrammableEnqueuePolicy.super_.prototype.enqueue.apply(this, arguments);
  this.enqueueFn(peerAction);
  return result;
};

ProgrammableEnqueuePolicy.prototype.start = function () {
  return ThaliPeerPoolBigReplication.super_.prototype.start
    .apply(this, arguments);
};

ProgrammableEnqueuePolicy.prototype.stop = function () {
  return ThaliPeerPoolBigReplication.super_.prototype.stop
    .apply(this, arguments);
};


function startAction(peerAction) {
  var actionAgent = new ForeverAgent.SSL({
    keepAlive: true,
    keepAliveMsecs: thaliConfig.TCP_TIMEOUT_WIFI/2,
    maxSockets: Infinity,
    maxFreeSockets: 256,
    ciphers: thaliConfig.SUPPORTED_PSK_CIPHERS,
    pskIdentity: peerAction.getPskIdentity(),
    pskKey: peerAction.getPskKey()
  });

  return peerAction.start(actionAgent);
}


test('Confirm peersIDs work as expected', function (t) {
  var partnerKeys = testUtils.turnParticipantsIntoBufferArray(
    t, publicKeyForLocalDevice
  );

  var testThaliPeerPoolBigReplication = new ThaliPeerPoolBigReplication();

  function getWifiPeerId(notificationAction) {
    return notificationAction.getConnectionInformation().getHostAddress() +
      '-' + notificationAction.getConnectionInformation().getPortNumber();
  }

  function getReplicationWifiPeerId(replicationAction) {
    return replicationAction.getPeerAdvertisesDataForUs().hostAddress + '-' +
        replicationAction.getPeerAdvertisesDataForUs().portNumber;
  }

  function getNotificationAndroidPeerId(notificationAction) {
    return notificationAction.getPeerIdentifier().split('-')[0];
  }

  var notificationChecked = false;
  var replicationChecked = false;
  var endCalled = false;

  function callEnd() {
    if (endCalled) {
      return true;
    }
    if (notificationChecked && replicationChecked) {
      t.end();
      endCalled = true;
      return true;
    }
    return false;
  }

  var enqueueFn = function (peerAction) {
    switch (peerAction.getActionType()) {
      case ThaliNotificationAction.ACTION_TYPE: {
        if (!notificationChecked) {
          var notificationExpectedValue =
            !platform._isRealMobile || !platform.isMobile ?
              getWifiPeerId(peerAction) :
              getNotificationAndroidPeerId(peerAction);

          t.equal(testThaliPeerPoolBigReplication
              ._getPeerIdFromAction(peerAction), notificationExpectedValue,
            'Notification peer IDs MUST match!');
          notificationChecked = true;
          if (callEnd()) {
            return;
          }
        }

        return startAction(peerAction)
          .then(function () {
            t.ok(true, 'notification action successfully finished');
          })
          .catch(function (err) {
            t.ok(true, 'notification action failed with ' + err);
          });
      }
      case ThaliReplicationPeerAction.ACTION_TYPE: {
        var replicationExpectedValue =
          !platform._isRealMobile || !platform.isMobile ?
            getReplicationWifiPeerId(peerAction) :
            getWifiPeerId(peerAction);

        t.equal(testThaliPeerPoolBigReplication
          ._getPeerIdFromAction(peerAction), replicationExpectedValue,
          'Replication peer IDs MUST match!');
        replicationChecked = true;
        callEnd();
        return;
      }
      default: {
        t.end('Unrecognized action type: ' + peerAction.getActionType());
      }
    }
  };

  var pouchDB = new PouchDB(DB_NAME);

  var localDoc = {
    _id: publicBase64KeyForLocalDevice
  };

  pouchDB.put(localDoc)
    .then(function () {
      thaliManager = new ThaliManager(
        ExpressPouchDB,
        PouchDB,
        DB_NAME,
        ecdhForLocalDevice,
        new ProgrammableEnqueuePolicy(enqueueFn),
        global.NETWORK_TYPE === ThaliMobile.networkTypes.BOTH ?
          ThaliMobile.networkTypes.NATIVE : global.NETWORK_TYPE
      );
      return thaliManager.start(partnerKeys);
    })
    .catch(function (err) {
      t.end('Failed with ' + err);
    });
});

test('Show that replication/notification race condition works', function (t) {
  var partnerKeys = testUtils.turnParticipantsIntoBufferArray(
    t, publicKeyForLocalDevice
  );

  var testThaliPeerPoolBigReplication = new ThaliPeerPoolBigReplication();

  function enqueueFn(peerAction) {

  }

  var pouchDB = new PouchDB(DB_NAME);

  var localDoc = {
    _id: publicBase64KeyForLocalDevice
  };

  pouchDB.put(localDoc)
    .then(function () {
      thaliManager = new ThaliManager(
        ExpressPouchDB,
        PouchDB,
        DB_NAME,
        ecdhForLocalDevice,
        new ProgrammableEnqueuePolicy(enqueueFn),
        global.NETWORK_TYPE === ThaliMobile.networkTypes.BOTH ?
          ThaliMobile.networkTypes.NATIVE : global.NETWORK_TYPE
      );
      return thaliManager.start(partnerKeys);
    })
    .catch(function (err) {
      t.end('Failed with ' + err);
    });
});
