'use strict';

var tape = require('../lib/thaliTape');
var LocalSeqManager = require('thali/NextGeneration/replication/localSeqManager');
var net = require('net');
var thaliMobile = require('thali/NextGeneration/thaliMobile');
var PouchDB = require('pouchdb');
var ThaliReplicationManager = require('thali/NextGeneration/thaliReplicationManager');
var expressPouchdb = require('express-pouchdb');
var crypto = require('crypto');
var thaliConfig = require('thali/NextGeneration/thaliConfig');
var ThaliPeerPoolDefault = require('thali/NextGeneration/thaliPeerPool/thaliPeerPoolDefault');
var ForeverAgent = require('forever-agent');
var ThaliNotificationClient = require('thali/NextGeneration/notification/thaliNotificationClient');
var Promise = require('lie');
var logger = require('thali/thalilogger')('testLocalSeqManager');

var thaliReplicationManager = null;
var devicePublicPrivateKey = crypto.createECDH(thaliConfig.BEACON_CURVE);
var devicePublicKey = devicePublicPrivateKey.generateKeys();

var test = tape({
  setup: function (t) {
    thaliReplicationManager = new ThaliReplicationManager(expressPouchdb,
      PouchDB, 'test', devicePublicPrivateKey, new ThaliPeerPoolDefault());
    t.data = devicePublicKey.toJSON();
    t.end();
  },
  teardown: function (t) {
    thaliReplicationManager.stop();
    t.end();
  }
});

if (!tape.coordinated) {
  return;
}

/*
We get all the participants and we wait for a notification from each one and
once we get the notification then we run the test
 */

var MAX_FAILURE = 10;

function runTestOnAllParticipants(t, testToRun) {
  return new Promise(function (resolve, reject) {
    var completed = false;
    var thaliNotificationClient =
      thaliReplicationManager.
        _thaliPullReplicationFromNotification.
        _thaliNotificationClient;

    /*
    Each participant is recorded via their public key
    If the value is -1 then they are done
    If the value is 0 then no test has completed
    If the value is greater than 0 then that is how many failures there have
    been.
     */
    var participantCount = {};

    t.participants.forEach(function (participant) {
      var publicKey = new Buffer(JSON.parse(participant.data));
      participantCount[publicKey] = 0;
    });

    function success(publicKey) {
      return function () {
        if (completed) {
          return;
        }

        participantCount[publicKey] = -1;

        var allSuccess = true;
        var participantKeys =
          Object.getOwnPropertyNames(participantCount);
        for(var i = 0; i < participantKeys.length; ++i) {
          if (participantCount[participantKeys[i]] === -1) {
            allSuccess = false;
            return;
          }
        }
        if (allSuccess) {
          completed = true;
          resolve();
        }
      };
    }

    function fail(publicKey) {
      return function(err) {
        logger.debug('Got an err - ' + JSON.stringify(err));
        if (completed || participantCount[publicKey] === -1) {
          return;
        }
        ++participantCount[publicKey];
        if (participantCount[publicKey] >= MAX_FAILURE) {
          completed = true;
          reject(err);
        }
      };
    }

    thaliNotificationClient.on(
      ThaliNotificationClient.Events.PeerAdvertisesDataForUs,
      function (notificationForUs) {
        testToRun(notificationForUs, success, fail(notificationForUs.keyId));
      });
  });



}

test('Simple doc request', function (t) {
  /*
  We start the replication manager with our own public key
  Then we try to connect to it
   */
  var testPromise = runTestOnAllParticipants(t, function (notificationForUs) {
    var actionAgent = new ForeverAgent.SSL({
      keepAlive: true,
      keepAliveMsecs: thaliConfig.TCP_TIMEOUT_WIFI/2,
      maxSockets: Infinity,
      maxFreeSockets: 256,
      ciphers: thaliConfig.SUPPORTED_PSK_CIPHERS,
      pskIdentity: notificationForUs.pskIdentifyField,
      pskKey: notificationForUs.psk
    });

    var localSeqManager = new LocalSeqManager(100000,
      notificationForUs.hostAddress,
      notificationForUs.portNumber,
      'test',
      devicePublicKey,
      actionAgent);

    localSeqManager._getRemoteLastSeqDoc()
      .then(function () {
        t.ok(localSeqManager._seqDocRev, 'seqDocRev should be set');
      })
      .catch(function (err) {
        t.fail(err);
      });
  });

  var publicKeys = [];
  t.participants.forEach(function (participant) {
    publicKeys.push(new Buffer(JSON.parse(participant.data)));
  });

  thaliReplicationManager.start(publicKeys)
    .then(function () {
      return testPromise;
    })
    .catch(function (err) {
      t.fail('Got err ' + JSON.stringify(err));
    })
    .then(function () {
      t.end();
    });
});

// test('Request to a server that is not there', function (t) {
//   var blockPortServer = net.createServer(0, function () {
//     var serverPort = blockPortServer.address().port;
//     var blockingConnection = net.createConnection(serverPort, function () {
//       blockPortServer.close();
//       // Now we are blocking the port the server was listening on because we
//       // still have a connection open but not new requests will be honored.
//     });
//
//   })
//   var localSeqManager = new LocalSeqManager(10000, '127.0.0.1', )
// });
