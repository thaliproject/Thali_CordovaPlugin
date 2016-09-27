'use strict';

var crypto         = require('crypto');
var expressPouchDB = require('express-pouchdb');
var express        = require('express');
var Promise        = require('bluebird');

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

var DB_NAME            = 'repActionTest';
var EXPIRATION_TIMEOUT = 60 * 60 * 1000;
var TEST_TIMEOUT       = 5 * 60 * 1000;

if (!tape.coordinated) {
  return;
}

var test = tape({
  setup: function (t) {
    t.data = devicePublicKey.toJSON();
    t.end();
  },
  teardown: function (t) {
    t.end();
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
  var router = express.Router();
  router.use(
    '/db',
    expressPouchDB(
      TestPouchDB, {
        mode: 'minimumForPouchDB'
      }
    )
  );
  var thaliNotificationServer = new ThaliNotificationServer(
    router, devicePublicPrivateKey, EXPIRATION_TIMEOUT
  );
  var thaliPullReplicationFromNotification = new ThaliPullReplicationFromNotification(
    TestPouchDB, DB_NAME, thaliPeerPoolDefault, devicePublicPrivateKey
  );
  var localPouchDB = new TestPouchDB(DB_NAME);

  new Promise(function (resolve, reject) {
    var remotePartnerKeys = testUtils.turnParticipantsIntoBufferArray(
      t, devicePublicKey
    );

    var changes = localPouchDB.changes({
      since: 0,
      live: true
    });

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
      reject(error);
    })
    .on('complete', function () {
      if (resultError) {
        reject(resultError);
      } else {
        resolve();
      }
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
  })

  .then(function () {
    return t.sync();
  })

  .then(function () {
    thaliPullReplicationFromNotification.stop();
    return thaliPeerPoolDefault.stop();
  })
  .then(function () {
    // https://github.com/thaliproject/Thali_CordovaPlugin/issues/1138
    // workaround for ECONNREFUSED and ECONNRESET from 'request.js' in 'pouchdb'.
    return t.sync();
  })
  .then(function () {
    return thaliNotificationServer.stop();
  })
  .then(function () {
    return ThaliMobile.stop();
  })
  .then(function (combinedResult) {
    if (
      combinedResult.wifiResult   !== null ||
      combinedResult.nativeResult !== null
    ) {
      return Promise.reject(
        new Error(
          'Had a failure in ThaliMobile.stop - ',
          JSON.stringify(combinedResult)
        )
      );
    }
  })

  .then(function () {
    return Promise.resolve()
    .timeout(TEST_TIMEOUT, 'test timeout exceeded');
  })
  .then(function () {
    t.pass('passed');
  })
  .catch(function (error) {
    t.fail('failed with ' + error.toString());
  })
  .then(function () {
    t.end();
  });
});
