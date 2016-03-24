'use strict';
var tape = require('../lib/thali-tape');
var express = require('express');
var crypto = require('crypto');
var sinon = require('sinon');
var Promise = require('lie');
var http = require('http');

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

var SECP256K1 = 'secp256k1';

var globals = {};

/**
 * @classdesc This class is a container for all variables and
 * functionality that are common to most of the ThaliNoficationtests.
 */
var GlobalVariables = function () {

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
    return Promise.resolve();
  };

  // Mocks ThaliMobile.stopAdvertisingAndListening function
  MockThaliMobile.stopAdvertisingAndListening = function () {
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
  return new Promise(function (resolve, reject) {
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
  this.expressApp.use('/', this.expressRouter);
};

/**
 * Frees GlobalVariables instance's resources.
 * @returns {Promise<?Error>} Returns a promise that will resolve when the
 * resources are released.
 */
GlobalVariables.prototype.kill = function () {
  if (this.expressServer) {
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
      console.log('killed properly');
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

    notificationClient.on(ThaliNotificationClient.Events.PeerAdvertisesDataForUs,
      function ( res) {
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

        t.end();
      });

    // Initializes ThaliNotificationServer
    var notificationServer = new globals.ThaliNotificationServerProxyquired(
      globals.expressRouter, globals.serverKeyExchangeObject, 90000);

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
var NO_REPLY = 1;
var REPLY = 2;

test('Client to server request coordinated', function (t) {

  globals.initCoordinated();

  var addressBook = [];
  var replies = {};

  if (t.participants) {
    t.participants.forEach(function (participant) {
      if (participant.data !== globals.myPublicBase64) {
        var publicKey = new Buffer(participant.data, 'base64');
        addressBook.push(publicKey);
        var publicKeyHash = NotificationBeacons.createPublicKeyHash(publicKey);
        replies[publicKeyHash] = NO_REPLY;
      }
    });
  }

  if (!t.participants || addressBook.length === 0) {
    t.pass('Can\'t run the test because no participants');
    return t.end();
  }

  console.log('participants:' + addressBook.length);

  var peerPool = new ThaliPeerPoolDefault();

  // Initialize the ThaliNotificationClient
  var notificationClient =
    new ThaliNotificationClient(peerPool,
      globals.ecdh);

  // Initializes ThaliNotificationServer
  var notificationServer = new ThaliNotificationServer(
    globals.expressRouter, globals.ecdh, 90000);

  var finished = false;

  notificationClient.on(ThaliNotificationClient.Events.PeerAdvertisesDataForUs,
    function (res) {

      replies[res.keyId] = REPLY;
      var allReplied = true;
      Object.keys(replies).forEach(function (key) {
        if (replies[key] === NO_REPLY) {
          allReplied = false;
        }
      });
      if (allReplied && !finished) {
        finished = true;
        ThaliMobile.stopListeningForAdvertisements();
        //  Kills services after 3 seconds gives all peers time to run their tests.
        setTimeout( function () {
          t.pass('We pass to any results at this point ');
          t.end();

          notificationServer.stop();
          notificationClient.stop();
        }, 3000);
      }
    });

  var pThaliMobile = ThaliMobile.start(globals.expressRouter);
  pThaliMobile.then( function () {
    return notificationServer.start(addressBook).then(function () {
      console.log('server started!');
      return;
    });
  }).then( function () {
    notificationClient.start(addressBook);
    return ThaliMobile.startListeningForAdvertisements().then( function ( ) {
      console.log('startListeningForAdvertisements');
    });
  });
});

