'use strict';

var tape = require('../lib/thaliTape');
var crypto = require('crypto');
var testUtils = require('../lib/testUtils');
var thaliConfig = require('thali/NextGeneration/thaliConfig');
var expressPouchdb = require('express-pouchdb');
var express = require('express');
var ThaliMobile = require('thali/NextGeneration/thaliMobile');
var ThaliNotificationServer = require('thali/NextGeneration/notification/thaliNotificationServer');
var ThaliPeerPoolDefault = require('thali/NextGeneration/thaliPeerPool/thaliPeerPoolDefault');
var Promise = require('lie');
var ThaliPullReplicationFromNotification = require('thali/NextGeneration/replication/thaliPullReplicationFromNotification');

var thaliNotificationServer = null;
var devicePublicPrivateKey = crypto.createECDH(thaliConfig.BEACON_CURVE);
var devicePublicKey = devicePublicPrivateKey.generateKeys();
var TestPouchDB = testUtils.getLevelDownPouchDb();
var router = null;
var thaliPullReplicationFromNotification = null;
var DB_NAME = 'repActionTest';

if (!tape.coordinated) {
  return;
}

var test = tape({
  setup: function (t) {
    t.data = devicePublicKey.toJSON();

    router = express.Router();
    var expressPDb = expressPouchdb(TestPouchDB, {mode: 'minimumForPouchDB'});
    router.use('/db', expressPDb);

    thaliNotificationServer =
      new ThaliNotificationServer(router, devicePublicPrivateKey,
        60 * 60 * 1000);

    t.end();
  },
  teardown: function (t) {
    thaliPullReplicationFromNotification &&
      thaliPullReplicationFromNotification.stop();
    thaliNotificationServer.stop()
      .then(function () {
        return ThaliMobile.stop();
      })
      .then(function (combinedResult) {
        if (combinedResult.wifiResult !== null ||
          combinedResult.nativeResult !== null) {
          return Promise.reject(
            new Error('Had a failure in ThaliMobile.stop - ' +
              JSON.stringify(combinedResult)));
        }
      })
      .catch(function (err) {
        t.fail('Got error in teardown - ' + JSON.stringify(err));
      })
      .then(function () {
        t.end();
      });
  }
});

function bufferIndexOf(bufferArray, entryToFind) {
  for(var i = 0; i < bufferArray.length; ++i) {
    if (bufferArray[i].compare(entryToFind) === 0) {
      return i;
    }
  }
  return -1;
}

test('Coordinated pull replication from notification test', function (t) {
  var thaliPeerPoolDefault = new ThaliPeerPoolDefault();
  var exited = false;
  function exit(err) {
    if (exited) {
      return;
    }
    exited = true;
    changes && changes.cancel();
    cancelTimer && clearTimeout(cancelTimer);
    thaliPeerPoolDefault.stop();
    err ? t.fail('failed with ' + err) : t.pass('all tests passed');
    t.end();
  }

  var cancelTimer = setTimeout(function () {
    exit(new Error('We ran out of time'));
  }, 1000 * 60 * 5);

  var remainingPartnerKeys =
    testUtils.turnParticipantsIntoBufferArray(t, devicePublicKey);

  var localPouchDB = new TestPouchDB(DB_NAME);

  var changes = localPouchDB.changes({
    since: 0,
    live: true
  }).on('change', function (change) {
    var bufferRemoteId = new Buffer(JSON.parse(change.id));
    var index = bufferIndexOf(remainingPartnerKeys, bufferRemoteId);
    if (index === -1) {
      return;
    }
    remainingPartnerKeys.splice(index, 1);
    if (remainingPartnerKeys.length === 0) {
      exit();
    }
  }).on('error', function (err) {
    exit(err);
  });

  thaliPullReplicationFromNotification =
    new ThaliPullReplicationFromNotification(TestPouchDB, DB_NAME,
      thaliPeerPoolDefault, devicePublicPrivateKey);

  var partnerKeys =
    testUtils.turnParticipantsIntoBufferArray(t, devicePublicKey);

  localPouchDB
    .put({_id: JSON.stringify(devicePublicKey.toJSON())})
    .then(function () {
      return thaliPullReplicationFromNotification.start(partnerKeys);
    })
    .then(function () {
      return testUtils.startServerInfrastructure(thaliNotificationServer,
        partnerKeys, ThaliMobile, router);
    })
    .catch(function (err) {
      exit(err);
    });
});
