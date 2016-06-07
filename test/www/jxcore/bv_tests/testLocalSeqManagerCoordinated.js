'use strict';

var tape = require('../lib/thaliTape');
var LocalSeqManager = require('thali/NextGeneration/replication/localSeqManager');
var crypto = require('crypto');
var testUtils = require('../lib/testUtils');
var thaliConfig = require('thali/NextGeneration/thaliConfig');
var expressPouchdb = require('express-pouchdb');
var express = require('express');
var ThaliMobile = require('thali/NextGeneration/thaliMobile');
var ThaliNotificationServer = require('thali/NextGeneration/notification/thaliNotificationServer');
var ThaliNotificationClient = require('thali/NextGeneration/notification/thaliNotificationClient');
var ThaliPeerPoolDefault = require('thali/NextGeneration/thaliPeerPool/thaliPeerPoolDefault');
var httpTester = require('../lib/httpTester');
var Promise = require('lie');

var thaliNotificationServer = null;
var thaliNotificationClient = null;
var devicePublicPrivateKey = crypto.createECDH(thaliConfig.BEACON_CURVE);
var devicePublicKey = devicePublicPrivateKey.generateKeys();
var TestPouchDB = testUtils.getLevelDownPouchDb();
var router = null;

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

    thaliNotificationClient =
      new ThaliNotificationClient(new ThaliPeerPoolDefault(),
                                  devicePublicPrivateKey);
    t.end();
  },
  teardown: function (t) {
    thaliNotificationServer.stop()
      .then(function () {
        return thaliNotificationClient.stop();
      })
      .then(function () {
        return ThaliMobile.stop();
      })
      .then(function (combinedResult) {
        if (combinedResult.wifiResult !== null ||
          combinedResult.nativeResult !== null) {
          return Promise.reject(
            new Error('Had a failure in ThaliMobile.start - ' +
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


test('Coordinated seq test', function (t) {
  var dbName = 'seqTest';
  testUtils.runTestOnAllParticipants(t, router, thaliNotificationClient,
    thaliNotificationServer, ThaliMobile, devicePublicKey,
    function (notificationForUs) {
      var localSeqManager;
      var lastSyncedSequenceNumber = null;
      return httpTester.getSeqDoc(dbName, notificationForUs.portNumber,
                           notificationForUs.pskIdentifyField,
                           notificationForUs.psk, devicePublicKey,
                           notificationForUs.hostAddress)
        .then(function (parsedJsonResponse) {
          lastSyncedSequenceNumber =
            parsedJsonResponse.lastSyncedSequenceNumber;
        })
        .catch(function (err) {
          if (err.statusCode === 404) {
            lastSyncedSequenceNumber = 0;
          } else {
            return Promise.reject('Failed with ' + err);
          }
        })
        .then(function () {
          var remotePouchDB =
            testUtils.createPskPouchDBRemote(
              notificationForUs.portNumber,
              dbName,
              notificationForUs.pskIdentifyField,
              notificationForUs.psk,
              notificationForUs.hostAddress);
          localSeqManager =
            new LocalSeqManager(1000, remotePouchDB, devicePublicKey);
          ++lastSyncedSequenceNumber;
          return localSeqManager.update(lastSyncedSequenceNumber);
        })
        .then(function () {
          ++lastSyncedSequenceNumber;
          var firstCall = localSeqManager.update(lastSyncedSequenceNumber);
          ++lastSyncedSequenceNumber;
          var secondCall = localSeqManager.update(lastSyncedSequenceNumber);
          return firstCall
            .then(function () {
              return secondCall;
            });
        })
        .then(function () {
          return httpTester
            .validateSeqNumber(t, dbName, notificationForUs.portNumber,
                               lastSyncedSequenceNumber,
                               notificationForUs.pskIdentifyField,
                               notificationForUs.psk, devicePublicKey,
                               notificationForUs.hostAddress);
        })
        .catch(function (err) {
          localSeqManager.stop();
          return Promise.reject(err);
        })
        .then(function () {
          localSeqManager.stop();
        });
    })
    .catch(function (err) {
      t.fail('We failed - ' + err);
    })
    .then(function () {
      t.end();
    });
});
