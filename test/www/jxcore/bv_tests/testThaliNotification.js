'use strict';
var tape = require('../lib/thaliTape');
var express = require('express');
var crypto = require('crypto');
var https = require('https');

var ThaliNotificationClient =
  require('thali/NextGeneration/notification/thaliNotificationClient');
var ThaliNotificationServer =
  require('thali/NextGeneration/notification/thaliNotificationServer');
var thaliMobile =
  require('thali/NextGeneration/thaliMobile');
var ThaliPeerPoolDefault =
  require('thali/NextGeneration/thaliPeerPool/thaliPeerPoolDefault');
var NotificationBeacons =
  require('thali/NextGeneration/notification/thaliNotificationBeacons');
var thaliConfig = require('thali/NextGeneration/thaliConfig');
var logger = require('thali/thaliLogger')('testThaliNotification');
var testUtils = require('../lib/testUtils');

var HELLO = 'Hello world';
var HELLO_PATH = '/hello';
var globals = {};

function allDictionaryItemsNonZero(dictionary) {
  if( Object.keys(dictionary).length === 0) {
    return false;
  }

  var result = true;

  Object.keys(dictionary).forEach(function (key) {
    if (dictionary[key] === 0) {
      result = false;
    }
  });
  return result;
}

function countNonZeroItems(dictionary) {
  var counter = 0;
  Object.keys(dictionary).forEach(function (key) {
    if (dictionary[key] !== 0) {
      counter++;
    }
  });
  return counter;
}

var getPskIdToPublicKey = null;

/**
 * @classdesc This class is a container for all variables and
 * functionality that are common to most of the ThaliNoficationtests.
 */
var GlobalVariables = function () {
  this.expressApp = express();
  this.expressRouter = express.Router();
  this.expressApp.use('/', this.expressRouter);
  this.ecdh = crypto.createECDH(thaliConfig.BEACON_CURVE);
  this.myKeyExchangeObject = this.ecdh.generateKeys();
  this.myPublicBase64 = this.ecdh.getPublicKey('base64');

  this.testInterval = null;

  // We use this dictionary to ensure that we get advertisement from all peers.
  this.peerAdvertisesDataForUsEvents = {};

  // This dictionary is used to track that we are able make succesfull HTTPS
  // request to all peers
  this.peerRepliedToUs = {};

  // This dictionary is used to track that we receive succesfull HTTPS
  // request from all peers.
  this.peerRequestedUs = {};

  // Counts failed psk keys on the server
  this.failedPskIdentityCount = 0;

  this.numberOfParticipants = 0;

};

var test = tape({
  setup: function (t) {
    globals = new GlobalVariables();
    if (tape.coordinated) {
      t.data = globals.myPublicBase64;
    }
    t.end();
  },
  teardown: function (t) {
    thaliMobile.stop();
    // Clears timeout
    var summary =
      'Participants:' + globals.numberOfParticipants +
      ' Peers Replied to us:' + countNonZeroItems(globals.peerRepliedToUs)+
      ' Peers requested to:' + countNonZeroItems(globals.peerRequestedUs);
    logger.info(summary);
    t.end();
  }
});

function initiateHttpsRequestToPeer(peerDetails, requestNumber){

  // 3 times is max that we try to reconnect
  if (requestNumber++ > 3) {
    return;
  }

  var options = {
    method: 'GET',
    hostname: peerDetails.hostAddress,
    port: peerDetails.portNumber,
    path: HELLO_PATH,
    agent: false,
    family: 4,
    pskIdentity: peerDetails.pskIdentifyField,
    pskKey: peerDetails.psk,
    ciphers: thaliConfig.SUPPORTED_PSK_CIPHERS
  };

  var requestSuccessful = false;

  var req = https.request(options, function (res) {
    var data = [];

    res.on('data', function (chunk) {
      data.push(chunk);
    });

    res.on('end', function () {
      if (data) {
        var buffer = Buffer.concat(data);
        var textChunk = buffer.toString('utf8');
        if (textChunk === HELLO) {
          var publicKeyHash =
            NotificationBeacons.createPublicKeyHash(peerDetails.keyId);
          globals.peerRepliedToUs[publicKeyHash]++;
          requestSuccessful = true;
        }
      }
    });
  });

  req.on('error', function (err) {
    logger.warn(err.message);
  });

  req.on('close', function (err) {
    if(!requestSuccessful) {
      initiateHttpsRequestToPeer(peerDetails, requestNumber);
    }
  });

  req.end();
}

if (!tape.coordinated) {
  return;
}

function checkSuccess() {
  return allDictionaryItemsNonZero(globals.peerAdvertisesDataForUsEvents) &&
    allDictionaryItemsNonZero(globals.peerRepliedToUs) &&
    allDictionaryItemsNonZero(globals.peerRequestedUs);
}

test('Client to server request coordinated', function (t) {

  // For this test we share our own public key with other peers and collect
  // their public keys. Then we wait until we get a peerAvailabilityChanged
  // event from each of these peers. This will cause ThaliNotificationClient
  // to emit PeerAdvertisesDataForUs event. In the test code we listen to this
  // event and ensure we get it from all peers.

  // Second phase of the test is to connect to other peers over https.
  // All peers have a https service and they listen to path /hello.
  // Each peer needs to make a https request to all other peers it
  // sees and peer needs to response to all these request.

  // Total number of https requests grows exponentially. With 2 peers we
  // make 2 request, with 3 peers 6, with 4 peers 12, etc.

  // Test checks every 5 second intervals if the all test criteria has been
  // met calling checkSuccess function. If the function returns true then
  // the test will close notificationClient and notificationServer and
  // finish. If test is not passed in the 2 minutes it will force close
  // itself.

  var addressBook = [];

  if (t.participants) {
    globals.numberOfParticipants = t.participants.length;
    t.participants.forEach(function (participant) {
      if (participant.data !== globals.myPublicBase64) {
        var publicKey = new Buffer(participant.data, 'base64');
        addressBook.push(publicKey);
        var publicKeyHash = NotificationBeacons.createPublicKeyHash(publicKey);
        globals.peerAdvertisesDataForUsEvents[publicKeyHash] = 0;
        globals.peerRepliedToUs[publicKeyHash] = 0;
        globals.peerRequestedUs[publicKeyHash] = 0;
      }
    });
  }

  if (!t.participants || addressBook.length === 0) {
    t.pass('Can\'t run the test because no participants');
    return t.end();
  }

  var peerPool = new ThaliPeerPoolDefault();

  // Initialize the ThaliNotificationClient
  var notificationClient =
    new ThaliNotificationClient(peerPool, globals.ecdh);

  // Initializes ThaliNotificationServer
  var notificationServer = new ThaliNotificationServer(
    globals.expressRouter, globals.ecdh, 90000);

  getPskIdToPublicKey = notificationServer.getPskIdToPublicKey();

  // Initializes test server that just says 'hello world'
  var helloWorld = function (req, res) {

    var clientPubKey = null;

    if (req.connection.pskIdentity) {
      clientPubKey = getPskIdToPublicKey(req.connection.pskIdentity);
    }

    if(clientPubKey) {
      var publicKeyHash =
        NotificationBeacons.createPublicKeyHash(clientPubKey);
      globals.peerRequestedUs[publicKeyHash]++;
    } else {
      globals.failedPskIdentityCount++;
    }

    res.set('Content-Type', 'text/plain');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(HELLO);
  };

  globals.expressRouter.get(HELLO_PATH,
    helloWorld);

  notificationClient.on(notificationClient.Events.PeerAdvertisesDataForUs,
    function (res) {
      var msg = 'PeerAdvertisesDataForUs:' + res.connectionType +
        ', '+res.hostAddress+', ' + res.hostAddress + ', '+
        res.portNumber;
      logger.info(msg);

      var publicKeyHash = NotificationBeacons.createPublicKeyHash(res.keyId);
      globals.peerAdvertisesDataForUsEvents[publicKeyHash]++;
      initiateHttpsRequestToPeer(res, 1);
    });

  var intervalRounds = 0;

  globals.testInterval = setInterval( function () {
    if(checkSuccess() || ++intervalRounds > 24) {
      // Test has been completed successfully or we have hit the time limit
      clearInterval(globals.testInterval);
      thaliMobile.stopListeningForAdvertisements().then(function () {
        notificationClient.stop();
        notificationServer.stop().then(function () {

          t.ok(allDictionaryItemsNonZero(globals.peerRepliedToUs),
            'Peer made successful https requests to all peers');

          t.ok(allDictionaryItemsNonZero(globals.peerRequestedUs),
            'Peer received right amount of https requests');

          t.ok(globals.failedPskIdentityCount === 0,
            'HTTPS server received zero PSK Identities. Count:' +
            globals.failedPskIdentityCount);

          t.end();
        }).catch(function (failure) {
          t.fail('Stopping the server failed:' + failure);
          t.end();
        });
      }).catch(function (failure) {
        t.fail('Failed to call stopListeningForAdvertisements:' + failure);
        t.end();
      });
    }
  }, 5000);

  thaliMobile.start(globals.expressRouter,
    notificationServer.getPskIdToSecret())
  .then(function (combinedResult) {
    testUtils.verifyCombinedResultSuccess(t, combinedResult);
    return notificationServer.start(addressBook);
  }).then(function () {
    notificationClient.start(addressBook);
    return thaliMobile.startListeningForAdvertisements().then(function () {
      logger.info('startListeningForAdvertisements');
    });
  });
});
