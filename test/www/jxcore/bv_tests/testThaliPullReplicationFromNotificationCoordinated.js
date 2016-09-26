'use strict';

var crypto         = require('crypto');
var expressPouchdb = require('express-pouchdb');
var express        = require('express');
var Promise        = require('lie');

var testUtils = require('../lib/testUtils');
var tape      = require('../lib/thaliTape');

var thaliConfig                          = require('thali/NextGeneration/thaliConfig');
var ThaliMobile                          = require('thali/NextGeneration/thaliMobile');
var ThaliNotificationServer              = require('thali/NextGeneration/notification/thaliNotificationServer');
var ThaliPeerPoolDefault                 = require('thali/NextGeneration/thaliPeerPool/thaliPeerPoolDefault');
var ThaliPullReplicationFromNotification = require('thali/NextGeneration/replication/thaliPullReplicationFromNotification');

var devicePublicPrivateKey = crypto.createECDH(thaliConfig.BEACON_CURVE);
var devicePublicKey        = devicePublicPrivateKey.generateKeys();
var TestPouchDB            = testUtils.getLevelDownPouchDb();

var router                               = null;
var thaliNotificationServer              = null;
var thaliPeerPoolDefault                 = null;
var thaliPullReplicationFromNotification = null;

var DB_NAME            = 'repActionTest';
var EXPIRATION_TIMEOUT = 60 * 60 * 1000;
var TEST_TIMEOUT       = 5 * 60 * 1000;

if (!tape.coordinated) {
  return;
}

var test = tape({
  setup: function (t) {
    t.data = devicePublicKey.toJSON();

    router = express.Router();
    var expressPDb = expressPouchdb(TestPouchDB, {mode: 'minimumForPouchDB'});
    router.use('/db', expressPDb);

    thaliNotificationServer = new ThaliNotificationServer(
      router, devicePublicPrivateKey, EXPIRATION_TIMEOUT
    );

    t.end();
  },
  teardown: function (t) {
    Promise.resolve()
    .then(function () {
      if (thaliPullReplicationFromNotification) {
        thaliPullReplicationFromNotification.stop();
      }
      return thaliNotificationServer.stop();
    })
    .then(function () {
      if (thaliPeerPoolDefault) {
        return thaliPeerPoolDefault.stop();
      }
    })
    .then(function () {
      return ThaliMobile.stop();
    })
    .then(function (combinedResult) {
      if (combinedResult.wifiResult !== null ||
        combinedResult.nativeResult !== null) {
        return Promise.reject(
          new Error(
            'Had a failure in ThaliMobile.stop - ' +
            JSON.stringify(combinedResult)
          )
        );
      }
    })
    .catch(function (error) {
      t.fail('Got error in teardown - ' + error.toString());
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
  thaliPeerPoolDefault = new ThaliPeerPoolDefault();

  var localPouchDB = new TestPouchDB(DB_NAME);
  var changes = localPouchDB.changes({
    since: 0,
    live: true
  });

  thaliPullReplicationFromNotification = new ThaliPullReplicationFromNotification(
    TestPouchDB, DB_NAME, thaliPeerPoolDefault, devicePublicPrivateKey
  );

  var exited = false;
  var resultError = null;
  function exit(error) {
    if (exited) {
      return;
    }
    exited = true;

    resultError = error;
    changes.cancel();
  }

  setTimeout(function () {
    exit(new Error('we ran out of time'));
  }, TEST_TIMEOUT);

  var remotePartnerKeys = testUtils.turnParticipantsIntoBufferArray(
    t, devicePublicKey
  );
  changes.on('change', function (change) {
    var bufferRemoteId = new Buffer(JSON.parse(change.id));
    var index = bufferIndexOf(remotePartnerKeys, bufferRemoteId);
    if (index === -1) {
      return;
    }
    remotePartnerKeys.splice(index, 1);
    if (remotePartnerKeys.length === 0) {
      exit();
    }
  })
  .on('error', function (error) {
    exit(error);
  })
  .on('complete', function () {
    if (resultError) {
      t.fail('failed with ' + resultError.toString());
    } else {
      t.pass('passed');
    }
    t.end();
  });

  localPouchDB
  .put({
    _id: JSON.stringify(devicePublicKey.toJSON())
  })
  .then(function () {
    var partnerKeys = testUtils.turnParticipantsIntoBufferArray(
      t, devicePublicKey
    );
    thaliPullReplicationFromNotification.start(partnerKeys);
    return testUtils.startServerInfrastructure(
      thaliNotificationServer, partnerKeys, ThaliMobile, router
    );
  })
  .catch(function (error) {
    exit(error);
  });
});
