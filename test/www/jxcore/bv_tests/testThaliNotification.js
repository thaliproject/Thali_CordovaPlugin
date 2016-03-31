'use strict';
var tape = require('../lib/thali-tape');
var express = require('express');
var crypto = require('crypto');
var https = require('https');

var ThaliNotificationClient =
  require('thali/NextGeneration/notification/thaliNotificationClient');
var ThaliNotificationServer =
  require('thali/NextGeneration/notification/thaliNotificationServer');
var ThaliMobile =
  require('thali/NextGeneration/thaliMobile');
var ThaliPeerPoolDefault =
  require('thali/NextGeneration/thaliPeerPool/thaliPeerPoolDefault');
var NotificationBeacons =
  require('thali/NextGeneration/notification/thaliNotificationBeacons');
var thaliConfig = require('thali/NextGeneration/thaliConfig');

var SECP256K1 = 'secp256k1';
var HELLO = 'Hello world';
var HELLO_PATH = '/hello';

var globals = {};

/**
 * @classdesc This class is a container for all variables and
 * functionality that are common to most of the ThaliNoficationtests.
 */
var GlobalVariables = function () {
  this.expressApp = express();
  this.expressRouter = express.Router();
  this.expressApp.use('/', this.expressRouter);
  this.ecdh = crypto.createECDH(SECP256K1);
  this.myKeyExchangeObject = this.ecdh.generateKeys();
  this.myPublicBase64 = this.ecdh.getPublicKey('base64');

  // This counters is used to track that we can make a successful https
  // request to all peers.
  this.httpsResponseCountSuccess = 0;
  this.httpsResponseCountFailed = 0;

  // This counter is used to track that all peers can make succesfull
  // https request to our server.

  this.httpsServerRequestCount = 0;


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
    t.end();
  }
});

if (!tape.coordinated) {
  return;
}

function initiateHttpsRequestToPeer(peerDetails){

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

  var req = https.request(options, function (res) {
    res.on('data', function (chunk) {
      if (chunk){
        var textChunk = chunk.toString('utf8');
        if (textChunk === HELLO) {
          globals.httpsResponseCountSuccess++;
        }
      }
    });
  });
  req.on('error', function (err) {
    globals.httpsResponseCountFailed++;
    console.log(err);
  });
  req.end();
}

test('Client to server request coordinated', function (t) {

  // For this test we share our own public key with other peers and collect
  // their public keys. Then we wait until we get notification event
  // from each of these peers.

  // Second phase of the test is to connect to other peers over https.
  // All peers have a https service and they listen on path /hello.
  // Each peer needs to make a https request to all other peers it
  // sees and peer needs to response to all these request.

  var addressBook = [];

  // We use replies table to ensure we get response back from all peers.
  var replies = {};

  if (t.participants) {
    t.participants.forEach(function (participant) {
      if (participant.data !== globals.myPublicBase64) {
        var publicKey = new Buffer(participant.data, 'base64');
        addressBook.push(publicKey);
        var publicKeyHash = NotificationBeacons.createPublicKeyHash(publicKey);
        replies[publicKeyHash] = false;
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

  // Initializes test server that just says 'hello world'
  var helloWorld = function (req, res) {
    // req.connection.pskIdentity
    globals.httpsServerRequestCount++;
    res.set('Content-Type', 'text/plain');
    res.setHeader('Cache-Control', 'no-cache');
    res.send(HELLO);
  };

  globals.expressRouter.get(HELLO_PATH,
    helloWorld);

  var finished = false;

  notificationClient.on(ThaliNotificationClient.Events.PeerAdvertisesDataForUs,
    function (res) {

      initiateHttpsRequestToPeer(res);

      var publicKeyHash = NotificationBeacons.createPublicKeyHash(res.keyId);
      replies[publicKeyHash] = true;

      var allReplied = true;
      Object.keys(replies).forEach(function (key) {
        if (!replies[key]) {
          allReplied = false;
        }
      });
      if (allReplied && !finished) {
        finished = true;
        ThaliMobile.stopListeningForAdvertisements().then(function () {
          notificationClient.stop();
          // Kills the server after 10 seconds.
          // This gives other peers time to finish their
          // ongoing requests.
          setTimeout( function () {
            notificationServer.stop().then(function () {
              t.pass('received keys from all peers. Peer count:'+
                addressBook.length);

              t.equal(globals.httpsResponseCountSuccess, addressBook.length,
                'Peer made right amount of https requests.');

              t.equal(globals.httpsServerRequestCount, addressBook.length,
              'Peer received right amount of http requests.');

              t.end();
            }).catch(function (failure) {
              t.fail('Stopping failed:' + failure);
              t.end();
            });
          }, 10000);
        }).catch(function (failure) {
          t.fail('Failed to call stopListeningForAdvertisements:' + failure);
          t.end();
        });
      }
    });

  ThaliMobile.start(globals.expressRouter,
    notificationServer.getPskIdToSecret())
  .then(function () {
    return notificationServer.start(addressBook);
  }).then(function () {
    notificationClient.start(addressBook);
    return ThaliMobile.startListeningForAdvertisements().then(function () {
      console.log('startListeningForAdvertisements');
    });
  });
});

