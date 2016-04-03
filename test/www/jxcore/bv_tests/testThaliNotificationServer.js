'use strict';
var tape = require('../lib/thaliTape');
var express = require('express');
var crypto = require('crypto');
var sinon = require('sinon');
var Promise = require('lie');
var proxyquire = require('proxyquire').noCallThru();
var NotificationBeacons =
  require('thali/NextGeneration/notification/thaliNotificationBeacons');
var ThaliPskMapCache =
  require('thali/NextGeneration/notification/thaliPskMapCache');
var ThaliConfig =
  require('thali/NextGeneration/thaliConfig');
var makeIntoCloseAllServer =
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
      if (err) {
        reject(err);
      } else {
        self.TESTURL = 'http://' + '127.0.0.1' + ':' +
        self.expressServer.address().port +
          ThaliConfig.NOTIFICATION_BEACON_PATH;

        makeIntoCloseAllServer(self.expressServer);

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
        if (error) {
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

test('Test ThaliPskMapCache clean and expiration', function (t) {

  var cache = new ThaliPskMapCache(500);
  var overFlow = ThaliConfig.MAX_NOTIFICATIONSERVER_PSK_MAP_CACHE_SIZE + 10;

  for (var i = 0 ; i < overFlow ; i++) {
    cache.push({});
  }

  t.equal(cache._queue.length,
    ThaliConfig.MAX_NOTIFICATIONSERVER_PSK_MAP_CACHE_SIZE,
  'ThaliPskMapCache should not exceed' +
  ' MAX_NOTIFICATIONSERVER_PSK_MAP_CACHE_SIZE');

  cache.clean(true);

  t.equal(cache._queue.length,
    ThaliConfig.MAX_NOTIFICATIONSERVER_PSK_MAP_CACHE_SIZE-1,
    'ThaliPskMapCache should not exceed' +
    ' MAX_NOTIFICATIONSERVER_PSK_MAP_CACHE_SIZE-1');


  setTimeout( function () {
    cache.clean();
    t.equal(cache._queue.length,
      0, 'All entries should be expired after 1 second');
    t.end();
  }, 1000);

});

test('Test ThaliPskMapCache getSecret and getPublic', function (t) {

  var cache = new ThaliPskMapCache(500);

  var publicKeysToNotify = globalVariables.createPublicKeysToNotify();
  var beaconStreamAndSecretDictionary =
    NotificationBeacons.generateBeaconStreamAndSecrets(
      publicKeysToNotify, globalVariables.sourceKeyExchangeObject, 500);

  cache.push(beaconStreamAndSecretDictionary.keyAndSecret);

  var match = true;

  Object.keys(cache._queue[0].keySecret).forEach( function (key) {
    if (beaconStreamAndSecretDictionary.keyAndSecret[key].publicKey !==
      cache.getPublic(key) ||
      beaconStreamAndSecretDictionary.keyAndSecret[key].pskSecret !==
      cache.getSecret(key)) {
      match = false;
    }
  });

  t.ok(match, 'All keys need to be available in the cache');

  setTimeout( function () {
    cache.getPublic('irrelevant');
    t.equal(cache._queue.length,
      0, 'All entries should be expired after 1 second');
    t.end();
  }, 1000);

});

test('Test ThaliPskMapCache multiple entries', function (t) {

  var cache = new ThaliPskMapCache(2000);

  var keyExchangeObject1 = crypto.createECDH(SECP256K1);
  keyExchangeObject1.generateKeys();

  var keyExchangeObject2 = crypto.createECDH(SECP256K1);
  keyExchangeObject2.generateKeys();

  var publicKeysToNotify = globalVariables.createPublicKeysToNotify();

  var dictionary1 =
    NotificationBeacons.generateBeaconStreamAndSecrets(
      publicKeysToNotify, keyExchangeObject1, 2000);

  var dictionary2 =
    NotificationBeacons.generateBeaconStreamAndSecrets(
      publicKeysToNotify, keyExchangeObject2, 2000);

  cache.push(dictionary1.keyAndSecret);
  var matches = true;
  setTimeout( function () {
    cache.push(dictionary2.keyAndSecret);
    t.equal(cache._queue.length,
      2, 'Size of the cache should be 2');

    Object.keys(dictionary1.keyAndSecret).
    forEach(function (key) {
      var secret = dictionary1.keyAndSecret[key].pskSecret;
      if (secret.compare(cache.getSecret(key)) !== 0) {
        matches = false;
      }
    });

    t.ok(matches, 'Cache doesn\'t contain dictionary1');
    matches = true;

    setTimeout( function () {
      cache.getPublic('irrelevant');
      t.equal(cache._queue.length,
        1, 'Size of the cache should be 1');

      Object.keys(dictionary2.keyAndSecret).
        forEach(function (key) {
          var secret = dictionary2.keyAndSecret[key].pskSecret;
          if (secret.compare(cache.getSecret(key)) !== 0) {
            matches = false;
          }
        });
      t.ok(matches, 'Cache doesn\'t contain beaconStreamAndSecretDictionary2');
      t.end();
    }, 1200);

  }, 1200);

});

test('Start and stop ThaliNotificationServer', function (t) {

  var publicKeysToNotify = globalVariables.createPublicKeysToNotify();

  globalVariables.notificationServer.start(publicKeysToNotify).
    then(function () {
      globalVariables.notificationServer.stop().then(function () {

        t.equals(
          globalVariables.spyStartUpdateAdvertisingAndListening.callCount,
          1, 'ThaliMobile.StartUpdateAdvertisingAndListening ' +
          'should be called once');

        t.equals(
          globalVariables.spyStopAdvertisingAndListening.callCount,
          1, 'ThaliMobile.StopAdvertisingAndListening' +
          'should be called once');

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

    t.ok(parseResult.unencryptedKeyId.compare(
        globalVariables.sourcePublicKeyHash) === 0);

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

test('Make an HTTP request to /NotificationBeacons'+'' +
  'before calling start', function (t) {

    var httpResponseHandler = function (error, response) {
      t.equal(response.statusCode, 404, 'should be 404' );
      t.end();
    };

    ThaliHttpTester.runTest(globalVariables.TESTURL, httpResponseHandler);
  });
