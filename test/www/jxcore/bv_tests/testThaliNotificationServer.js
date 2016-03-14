'use strict';
var tape = require('../lib/thali-tape');
var express = require('express');
var crypto = require('crypto');
var sinon = require('sinon');
var Promise = require('lie');

var proxyquire = require('proxyquire').noCallThru();

var NotificationBeacons =
  require('thali/NextGeneration/notification/thaliNotificationBeacons');
var ThaliNotificationServer =
  require('thali/NextGeneration/notification/thaliNotificationServer');
var NotificationCommon =
  require('thali/NextGeneration/notification/thaliNotificationCommon');
var MakeIntoCloseAllServer =
  require('thali/NextGeneration/makeIntoCloseAllServer');

var ThaliHttpTester = require('../lib/httpTester');

var SECP256K1 = 'secp256k1';

var globalVariables = {};

/**
 * @classdesc This class is a container for all variables and
 * functionality that are common to most of the ThaliNoficationServer
 * tests.
 */
var GlobalVariables = function () {

  this.sourceKeyExchangeObject = crypto.createECDH(SECP256K1);
  this.sourcePublicKey = this.sourceKeyExchangeObject.generateKeys();
  this.sourcePublicKeyHash =
    NotificationBeacons.createPublicKeyHash(this.sourcePublicKey);

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

  this.spyStartUpdateAdvertisingAndListening =
    sinon.spy(MockThaliMobile, 'startUpdateAdvertisingAndListening');

  this.spyStopAdvertisingAndListening =
    sinon.spy(MockThaliMobile, 'stopAdvertisingAndListening');

};

/**
 * Initializes express router and starts to listen incoming http requests.
 */
GlobalVariables.prototype.init = function () {
  var self = this;
  return new Promise(function (resolve, reject) {
    // Initializes the server with the expressRouter
    self.expressApp.use('/', self.expressRouter);
    self.expressServer = self.expressApp.listen(0, function (err) {
      if (err != null) {
        reject(err);
      } else {
        self.TESTURL = 'http://' + '127.0.0.1' + ':' +
        self.expressServer.address().port +
          NotificationCommon.NOTIFICATION_BEACON_PATH;

        MakeIntoCloseAllServer(self.expressServer);

        self.notificationServer = new self.ThaliNotificationServerProxyquired(
          self.expressRouter, self.sourceKeyExchangeObject, 90000);

        resolve();
      }
    });
  });
};


/**
 * Frees reserved resources from globalVariables after the each test run.
 */
GlobalVariables.prototype.kill = function () {
  var self = this;
  return new Promise(function (resolve, reject) {
    if (self.expressServer) {
      self.expressServer.closeAll(function (error) {
        self.expressServer = null;
        if (error != null) {
          reject(error);
        } else {
          resolve();
        }
      });
    } else {
      resolve();
    }
  });
};

/**
 * Generates public keys for two target devices.
 */
GlobalVariables.prototype.createPublicKeysToNotify = function () {
  this.publicKeysToNotify = [];
  this.targetDeviceKeyExchangeObjects = [];

  var device1 = crypto.createECDH(SECP256K1);
  var device1Key = device1.generateKeys();
  var device2 = crypto.createECDH(SECP256K1);
  var device2Key = device2.generateKeys();

  this.publicKeysToNotify.push(device1Key, device2Key);
  this.targetDeviceKeyExchangeObjects.push(device2, device2);
  return this.publicKeysToNotify;
};

var test = tape({
  setup: function (t) {
    globalVariables = new GlobalVariables();
    globalVariables.init().then(function () {
      t.end();
    }).catch(function (failure) {
      t.fail('Test setting up failed:' + failure);
      t.end();
    });
  },
  teardown: function (t) {
    globalVariables.kill().then(function () {
      t.end();
    }).catch(function (failure) {
      t.fail('Server cleaning failed:' + failure);
      t.end();
    });
  }
});

test('Start and stop ThaliNotificationServer', function (t) {

  var publicKeysToNotify = globalVariables.createPublicKeysToNotify();

  globalVariables.notificationServer.start(publicKeysToNotify).then(function () {
    globalVariables.notificationServer.stop().then(function () {

      t.equals(globalVariables.spyStartUpdateAdvertisingAndListening.callCount,
      1, 'ThaliMobile.StartUpdateAdvertisingAndListening should be called once');

      t.equals(globalVariables.spyStopAdvertisingAndListening.callCount,
      1, 'ThaliMobile.StopAdvertisingAndListening should be called once');

      t.end();
    }).catch(function (failure) {
      t.fail('Stopping failed:' + failure);
      t.end();
    });
  }).catch(function (failure) {
    t.fail('Starting failed:' + failure);
    t.end();
  });
});

test('Pass an empty array to ThaliNotificationServer.start', function (t) {

  var httpResponseHandler = function (error, response) {
    t.equal(error, null, 'no error');
    t.equal(response.statusCode, 204, 'should be 204' );
    t.end();
  };

  globalVariables.notificationServer.start([]).then(function () {
    globalVariables.notificationServer.stop().then(function () {
      t.equals(globalVariables.spyStartUpdateAdvertisingAndListening.callCount,
      0, 'StartUpdateAdvertisingAndListening should not be called');
      ThaliHttpTester.runTest(globalVariables.TESTURL, httpResponseHandler);

      t.equals(globalVariables.spyStopAdvertisingAndListening.callCount,
      1, 'ThaliMobile.StopAdvertisingAndListening should be called once');

    }).catch(function (failure) {
      t.fail('Stopping failed:' + failure);
      t.end();
    });
  }).catch(function () {
    t.fail('Start should not have failed.');
    t.end();
  });
});

test('Pass a string to ThaliNotificationServer.start', function (t) {

  globalVariables.notificationServer.start('wrong key').then(function () {
      t.fail('start should have failed.');
      t.end();
    }).catch(function () {
      t.equals(globalVariables.spyStartUpdateAdvertisingAndListening.callCount,
      0, 'StartUpdateAdvertisingAndListening should not be called');
      t.end();
    });
});

test('Pass an empty parameter to ThaliNotificationServer.start', function (t) {

  globalVariables.notificationServer.start().then(function () {
      t.fail('start should have failed.');
      t.end();
    }).catch(function () {
      t.equals(globalVariables.spyStartUpdateAdvertisingAndListening.callCount,
      0, 'StartUpdateAdvertisingAndListening should not be called');
      t.end();
    });
});

test('Make an HTTP request to /NotificationBeacons', function (t) {

  var publicKeys = globalVariables.createPublicKeysToNotify();

  var addressBookCallback = function (unencryptedKeyId) {
    if (unencryptedKeyId.compare(globalVariables.sourcePublicKeyHash) === 0) {
      return globalVariables.sourcePublicKey;
    }
    return null;
  };

  // This Handler is called after the notification server is stopped
  var httpResponse204Handler = function (error, response) {
    t.equal(error, null, 'no error');
    t.equal(response.statusCode, 204, 'should be 204' );
    t.end();
  };

  // This Handler is called after the notification server is started
  var httpResponse200Handler = function (error, response, body) {
    t.equal(error, null, 'no error');
    t.equal(response.statusCode, 200, 'should be 200' );
    t.equal(response.headers['cache-control'], 'no-cache');
    t.equal(response.headers['content-type'], 'application/octet-stream');

    var parseResult = NotificationBeacons.parseBeacons(body,
      globalVariables.targetDeviceKeyExchangeObjects[0], addressBookCallback);

    t.ok(parseResult.compare(globalVariables.sourcePublicKeyHash) === 0);

    // Stops the server and checks that it returns 204 as expected
    globalVariables.notificationServer.stop().then(function () {
      ThaliHttpTester.runTest(globalVariables.TESTURL, httpResponse204Handler );
    }).catch(function (failure) {
      t.fail('Stopping failed:' + failure);
      t.end();
    });
  };

  globalVariables.notificationServer.start(publicKeys).then(function () {
    ThaliHttpTester.runTest(globalVariables.TESTURL, httpResponse200Handler );
  });
});

test('Make an HTTP request to /NotificationBeacons (no keys)', function (t) {

  var httpResponseHandler = function (error, response) {
    t.equal(error, null, 'error should be null' );
    t.equal(response.statusCode, 204, 'should be 204' );
    t.end();
  };

  globalVariables.notificationServer.start([]).then(function () {
    ThaliHttpTester.runTest(globalVariables.TESTURL, httpResponseHandler);
  });
});

test('Make an HTTP request to /NotificationBeacons before calling start', function (t) {

  var httpResponseHandler = function (error, response) {
    t.equal(response.statusCode, 404, 'should be 404' );
    t.end();
  };

  ThaliHttpTester.runTest(globalVariables.TESTURL, httpResponseHandler);
});
