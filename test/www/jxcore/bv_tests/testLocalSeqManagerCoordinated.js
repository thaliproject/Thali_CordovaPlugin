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
var logger = require('thali/thalilogger')('testLocalSeqManagerCoordinated');
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

var MAX_FAILURE = 10;

function runTestOnAllParticipants(t, router, thaliNotificationClient,
                                  thaliNotificationServer, ThaliMobile,
                                  testToRun) {
  var publicKeys = [];
  t.participants.forEach(function (participant) {
    var publicKey = new Buffer(participant.data);
    if (Buffer.compare(publicKey, devicePublicKey) !== 0) {
      publicKeys.push(publicKey);
    }
  });

  return new Promise(function (resolve, reject) {
    var completed = false;
    /*
    Each participant is recorded via their public key
    If the value is -1 then they are done
    If the value is 0 then no test has completed
    If the value is greater than 0 then that is how many failures there have
    been.
     */
    var participantCount = {};

    publicKeys.forEach(function (participantPublicKey) {
      participantCount[participantPublicKey] = 0;
    });

    var participantTask = {};

    publicKeys.forEach(function (participantPublicKey) {
      participantTask[participantPublicKey] = Promise.resolve();
    });

    function success(publicKey) {
      if (completed) {
        return;
      }

      participantCount[publicKey] = -1;

      var participantKeys =
        Object.getOwnPropertyNames(participantCount);
      for (var i = 0; i < participantKeys.length; ++i) {
        if (participantCount[participantKeys[i]] !== -1) {
          return;
        }
      }

      completed = true;
      resolve();
    }

    function fail(publicKey, err) {
      logger.debug('Got an err - ' + JSON.stringify(err));
      if (completed || participantCount[publicKey] === -1) {
        return;
      }
      ++participantCount[publicKey];
      if (participantCount[publicKey] >= MAX_FAILURE) {
        completed = true;
        reject(err);
      }
    }

    thaliNotificationClient.on(
      ThaliNotificationClient.Events.PeerAdvertisesDataForUs,
      function (notificationForUs) {
        if (completed) {
          return;
        }
        participantTask[notificationForUs.keyId]
          .then(function () {
            if (!completed) {
              participantTask[notificationForUs.keyId] =
                testToRun(notificationForUs)
                  .then(function () {
                    success(notificationForUs.keyId);
                  })
                  .catch(function (err) {
                    fail(notificationForUs.keyId, err);
                    return Promise.resolve();
                  });
              return participantTask[notificationForUs.keyId];
            }
          });
      });

    thaliNotificationClient.start(publicKeys);
    return thaliNotificationServer.start(publicKeys)
      .then(function () {
        return ThaliMobile.start(router,
          thaliNotificationServer.getPskIdToSecret());
      })
      .then(function (combinedResult) {
        return testUtils.validateCombinedResult(combinedResult);
      })
      .then(function () {
        return ThaliMobile.startListeningForAdvertisements();
      })
      .then(function (combinedResult) {
        return testUtils.validateCombinedResult(combinedResult);
      })
      .then(function () {
        return ThaliMobile.startUpdateAdvertisingAndListening();
      })
      .then(function (combinedResult) {
        return testUtils.validateCombinedResult(combinedResult);
      })
      .catch(function (err) {
        reject(err);
      });
  });
}

test.only('Coordinated seq test', function (t) {
  var dbName = 'seqTest';
  runTestOnAllParticipants(t, router, thaliNotificationClient,
    thaliNotificationServer, ThaliMobile,
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
