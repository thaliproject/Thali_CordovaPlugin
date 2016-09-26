'use strict';

var crypto         = require('crypto');
var express        = require('express');
var expressPouchDB = require('express-pouchdb');
var Promise        = require('lie');

var tape      = require('../lib/thaliTape');
var testUtils = require('../lib/testUtils');

var thaliConfig                = require('thali/NextGeneration/thaliConfig');
var ThaliMobile                = require('thali/NextGeneration/thaliMobile');
var ThaliNotificationServer    = require('thali/NextGeneration/notification/thaliNotificationServer');
var ThaliNotificationClient    = require('thali/NextGeneration/notification/thaliNotificationClient');
var ThaliPeerPoolDefault       = require('thali/NextGeneration/thaliPeerPool/thaliPeerPoolDefault');
var ThaliReplicationPeerAction = require('thali/NextGeneration/replication/thaliReplicationPeerAction');

var devicePublicPrivateKey = crypto.createECDH(thaliConfig.BEACON_CURVE);
var devicePublicKey        = devicePublicPrivateKey.generateKeys();
var TestPouchDB            = testUtils.getLevelDownPouchDb();

var router                     = null;
var thaliNotificationServer    = null;
var thaliNotificationClient    = null;
var thaliReplicationPeerAction = null;

// BUGBUG: This is currently ignored for reasons explained
// in thaliReplicationPeerAction.start
var httpAgentPool = null;

var DB_NAME            = 'repActionTest';
var EXPIRATION_TIMEOUT = 60 * 60 * 1000;

if (!tape.coordinated) {
  return;
}

var test = tape({
  setup: function (t) {
    t.data = devicePublicKey.toJSON();

    router = express.Router();
    router.use(
      '/db',
      expressPouchDB(TestPouchDB, {
        mode: 'minimumForPouchDB'
      })
    );

    thaliNotificationServer = new ThaliNotificationServer(
      router, devicePublicPrivateKey, EXPIRATION_TIMEOUT
    );

    var peerPool = new ThaliPeerPoolDefault();
    peerPool.start();
    thaliNotificationClient = new ThaliNotificationClient(
      peerPool, devicePublicPrivateKey
    );

    t.end();
  },
  teardown: function (t) {
    thaliNotificationClient.stop();
    thaliNotificationServer.stop()
    .then(function () {
      thaliReplicationPeerAction.kill();
      return thaliReplicationPeerAction.waitUntilKilled();
    })
    .then(function () {
      return ThaliMobile.stop();
    })
    .then(function (combinedResult) {
      if (combinedResult.wifiResult !== null ||
        combinedResult.nativeResult !== null) {
        return Promise.reject(
          new Error(
            'Had a failure in ThaliMobile.start - ' +
            JSON.stringify(combinedResult)
          )
        );
      }
    })
    .catch(function (err) {
      t.fail('Got error in teardown - ' + error.toString());
    })
    .then(function () {
      t.end();
    });
  }
});

test('Coordinated replication action test', function (t) {
  var localPouchDB = new TestPouchDB(DB_NAME);
  localPouchDB
  .put({
    _id: JSON.stringify(devicePublicKey.toJSON())
  })

  .then(function () {
    return testUtils.runTestOnAllParticipants(
      t, router,
      thaliNotificationClient,
      thaliNotificationServer,
      ThaliMobile,
      devicePublicKey,
      function (notificationForUs) {
        return new Promise(function (resolve, reject) {
          var changes = localPouchDB.changes({
            since: 0,
            live:  true
          });

          thaliReplicationPeerAction = new ThaliReplicationPeerAction(
            notificationForUs, TestPouchDB, DB_NAME, devicePublicKey
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

          changes.on('change', function (change) {
            var bufferRemoteId = new Buffer(JSON.parse(change.id));
            // note that the test might pass before we even start replicating
            // because we already have the record from someone else, that's
            // fine. We still guarantee at least one replication ran on each
            // device.
            if (Buffer.compare(notificationForUs.keyId, bufferRemoteId) !== 0) {
              return;
            }
            exit();
          })
          .on('error', function (error) {
            exit(error);
          })
          .on('complete', function () {
            if (resultError) {
              reject(resultError);
            } else {
              resolve();
            }
          });

          thaliReplicationPeerAction.start(httpAgentPool)
          .catch(function (error) {
            exit(error);
          });
        });
      }
    );
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
