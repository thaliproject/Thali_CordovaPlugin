'use strict';
var tape = require('../lib/thali-tape');
var express = require('express');
var crypto = require('crypto');
var sinon = require('sinon');
var Promise = require('lie');
var http = require('http');
var https = require('https');

var proxyquire = require('proxyquire').noCallThru();
var ThaliNotificationClient =
  require('thali/NextGeneration/notification/thaliNotificationClient');
var ThaliNotificationServer =
  require('thali/NextGeneration/notification/thaliNotificationServer');
var ThaliMobile =
  require('thali/NextGeneration/thaliMobile');
var ThaliPeerPoolDefault =
  require('thali/NextGeneration/thaliPeerPool/thaliPeerPoolDefault');
var makeIntoCloseAllServer =
  require('thali/NextGeneration/makeIntoCloseAllServer');
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

  this.local = true;
  this.expressApp = express();
  this.expressRouter = express.Router();

  // Creates a proxyquired ThaliNotificationServer class.
  var MockThaliMobile = { };
  this.ThaliNotificationServerProxyquired =
    proxyquire('thali/NextGeneration/notification/thaliNotificationServer',
      { '../thaliMobile':
      MockThaliMobile});

  // Mocks ThaliMobile.startUpdateAdvertisingAndListening function
  MockThaliMobile.startUpdateAdvertisingAndListening = function () {
    console.log('startUpdateAdvertisingAndListening');
    return Promise.resolve();
  };

  // Mocks ThaliMobile.stopAdvertisingAndListening function
  MockThaliMobile.stopAdvertisingAndListening = function () {
    console.log('stopAdvertisingAndListening');
    return Promise.resolve();
  };

  this.TCPEvent = {
    peerIdentifier: 'id123',
    hostAddress: '127.0.0.1',
    portNumber: 0,
    connectionType: ThaliMobile.connectionTypes.TCP_NATIVE,
    suggestedTCPTimeout: 10000
  };
};

GlobalVariables.prototype.initLocal = function () {
  var self = this;
  self.createKeysForLocalTest();
  // Initializes ThaliNotificationServer
  self.notificationServer = new globals.ThaliNotificationServerProxyquired(
    self.expressRouter, globals.serverKeyExchangeObject, 90000);

  return new Promise(function (resolve, reject) {

    var options = {
      ciphers: thaliConfig.SUPPORTED_PSK_CIPHERS,
      pskCallback: self.notificationServer.getPskIdToSecret(),
      key: thaliConfig.BOGUS_KEY_PEM,
      cert: thaliConfig.BOGUS_CERT_PEM
    };

    self.expressApp.use('/', self.expressRouter);
    self.expressServer = self.expressApp.listen(0, function (err) {
      if (err) {
        reject(err);
      } else {
        makeIntoCloseAllServer(self.expressServer);
        self.TCPEvent.portNumber = self.expressServer.address().port;
        resolve();
      }
    });
  });
};

GlobalVariables.prototype.initCoordinated = function () {
  this.local = false;
  this.expressApp.use('/', this.expressRouter);
};

/**
 * Frees GlobalVariables instance's resources.
 * @returns {Promise<?Error>} Returns a promise that will resolve when the
 * resources are released.
 */
GlobalVariables.prototype.kill = function () {
  if (this.expressServer && this.local) {
    return this.expressServer.closeAllPromise();
  }
  return Promise.resolve();
};

GlobalVariables.prototype.createKeysForLocalTest = function () {

  // These keys are for local test
  this.targetPublicKeysToNotify = [];
  this.targetDeviceKeyExchangeObjects = [];

  this.serverKeyExchangeObject = crypto.createECDH(SECP256K1);
  this.serverPublicKey = this.serverKeyExchangeObject.generateKeys();

  var device1 = crypto.createECDH(SECP256K1);
  var device1Key = device1.generateKeys();
  var device2 = crypto.createECDH(SECP256K1);
  var device2Key = device2.generateKeys();

  this.targetPublicKeysToNotify.push(device1Key, device2Key);
  this.targetDeviceKeyExchangeObjects.push(device2, device2);

};

GlobalVariables.prototype.createKeysForCoordinatedTest = function () {
  this.ecdh = crypto.createECDH(SECP256K1);
  this.myKeyExchangeObject = this.ecdh.generateKeys();
  this.myPublicBase64 = this.ecdh.getPublicKey('base64');
};

var test = tape({
  setup: function (t) {
    globals = new GlobalVariables();

    if (tape.coordinated) {
      globals.createKeysForCoordinatedTest();
      t.data = globals.myPublicBase64;
    }
    t.end();
  },

  teardown: function (t) {
    globals.kill().then(function () {
      t.end();
    }).catch(function (failure) {
      t.fail('Server cleaning failed:' + failure);
      t.end();
    });
  }
});
/*
test('Client to server request locally', function (t) {

  var p = globals.initLocal();

  p.then(function () {

    var peerPool = new ThaliPeerPoolDefault();

    // Simulates how the peer pool runs actions
    var enqueue = function (action) {
      var keepAliveAgent = new http.Agent({ keepAlive: true });
      action.start(keepAliveAgent).then( function () {
      }).catch( function ( ) {
        t.fail('This action should not fail!');
      });
    };

    sinon.stub(peerPool, 'enqueue', enqueue);

    // Initialize the ThaliNotificationClient
    var notificationClient =
      new ThaliNotificationClient(peerPool,
        globals.targetDeviceKeyExchangeObjects[0]);



    notificationClient.on(
      ThaliNotificationClient.Events.PeerAdvertisesDataForUs, function ( res) {

        t.equals(
          res.hostAddress,
          globals.TCPEvent.hostAddress,
          'Host address must match');
        t.equals(
          res.suggestedTCPTimeout,
          globals.TCPEvent.suggestedTCPTimeout,
          'suggestedTCPTimeout must match');
        t.equals(
          res.connectionType,
          globals.TCPEvent.connectionType,
          'connectionType must match');
        t.equals(
          res.portNumber,
          globals.TCPEvent.portNumber,
          'portNumber must match');
        notificationClient.stop();
        notificationServer.stop().then(function () {

          t.end();
        }).catch(function (failure) {
          t.fail('Stopping failed:' + failure);
          t.end();
        });

      });

    notificationServer.start(globals.targetPublicKeysToNotify).
    then(function () {
      notificationClient.start([globals.serverPublicKey]);
      notificationClient._peerAvailabilityChanged(globals.TCPEvent);
    });

  }).catch(function (failure) {
    t.fail('Test setting up failed:' + failure);
    t.end();
  });

});

 */

if (!tape.coordinated) {
  return;
}

function connectToPeer(peerDetails){

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
        console.log(chunk);
      }
    });
  });

  req.on('error', function (err) {
    console.log('http request error - ' + err);
  });

  req.end();

}

test('Client to server request coordinated', function (t) {

  // For this test we share our own public key with other peers and collect
  // their public keys. Then we wait until we get notification event
  // from each of these peers.

  globals.initCoordinated();

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
    // req.connection.psIdentity
    console.log('request');
    res.send('hello world');
  };

  globals.expressRouter.get(HELLO_PATH,
    helloWorld);

  var finished = false;

  notificationClient.on(ThaliNotificationClient.Events.PeerAdvertisesDataForUs,
    function (res) {

      connectToPeer(res);
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
          // Kills the server after 6 seconds.
          // This gives other peers time to finish their
          // ongoing requests.
          setTimeout( function () {
            notificationServer.stop().then(function () {
              t.pass('received keys from all peers. Peer count:'+
                addressBook.length);
              t.end();
            }).catch(function (failure) {
              t.fail('Stopping failed:' + failure);
              t.end();
            });
          }, 6000);
        }).catch(function (failure) {
          t.fail('Failed to call stopListeningForAdvertisements:' + failure);
          t.end();
        });
      }
    });

  ThaliMobile.start(globals.expressRouter, notificationServer.getPskIdToSecret())
  .then(function () {
    return notificationServer.start(addressBook);
  }).then(function () {
    notificationClient.start(addressBook);
    return ThaliMobile.startListeningForAdvertisements().then(function () {
      console.log('startListeningForAdvertisements');
    });
  });
});

