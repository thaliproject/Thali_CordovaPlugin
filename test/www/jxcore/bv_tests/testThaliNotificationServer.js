var tape = require('../lib/thali-tape');
var express = require('express');
var crypto = require('crypto');
var sinon = require('sinon');
var Promise = require('lie');

var proxyquire = require('proxyquire').noCallThru();
var NotificationBeacons = require('thali/NextGeneration/notification/thaliNotificationBeacons');
var ThaliNotificationServer = require('thali/NextGeneration/notification/thaliNotificationServer');
var thaliHttpTester = require('../lib/httpTester');

var SECP256K1 = 'secp256k1';
var PORT = 3001;
var TESTURL = 'http://localhost:' + PORT + 
  ThaliNotificationServer.NOTIFICATION_BEACON_PATH; 

var globalVariables = {};

/**
 * Initializes globalVariables before the each test run.
 */
function initializeGlobalVariables() {
  globalVariables = {
    clientRequestCounter : 0,
    spyStartUpdateAdvertisingAndListening : null,
    expressApp : express(),
    expressServer : null,
    ThaliNotificationServerProxyquired : null
  };
  
  globalVariables.ThaliNotificationServerProxyquired = 
    proxyquireThaliNotificationServer();
}

/**
 * Frees reserved resources from globalVariables after the each test run.
 */
function destructGlobalVariables() {
  if (globalVariables) {
    if (globalVariables.expressServer) {
      globalVariables.expressServer.close();
    }
  }
}

/**
 * Creates a proxyquired ThaliNotificationServer class. 
 */
function proxyquireThaliNotificationServer() {
  var MockThaliMobile = { };
  var ThaliNotificationServerProxyquired =
    proxyquire('thali/NextGeneration/notification/thaliNotificationServer',
      { '../thaliMobile':
      MockThaliMobile});

  MockThaliMobile.startUpdateAdvertisingAndListening = function () {
    return Promise.resolve();
  };
  
  globalVariables.spyStartUpdateAdvertisingAndListening = 
    sinon.spy(MockThaliMobile, 'startUpdateAdvertisingAndListening');
  
  return ThaliNotificationServerProxyquired;
}

var test = tape({
  setup: function (t) {
    initializeGlobalVariables();
    t.end();
  },
  teardown: function (t) {
    destructGlobalVariables();
    t.end();
  }
});

/**
 * Initializes ThaliNotificationServer from proxyquired 
 * ThaliNotificationServerProxyquired class.
 */
function initializeThaliNotificationServer() {
  var expressRouter = express.Router();
  var myPublicKey = crypto.createECDH(SECP256K1);
  myPublicKey.generateKeys();
  return new globalVariables.ThaliNotificationServerProxyquired( 
    expressRouter, myPublicKey, 90000);
}

/**
 * Generates two public keys for the test. 
 */
function generatePublicKeys() {
  var publicKeys = [];
  var device1 = crypto.createECDH(SECP256K1);
  var device1Key = device1.generateKeys();
  var device2 = crypto.createECDH(SECP256K1);
  var device2Key = device2.generateKeys();
  publicKeys.push(device1Key, device2Key);
  return publicKeys;
}

test('Start and stop ThaliNotificationServer', function (t) {

  var thaliNotificationServerProxyquired = initializeThaliNotificationServer();
  
  thaliNotificationServerProxyquired.start(generatePublicKeys()).then(function () {
    t.ok(true, 'Starting works');
    thaliNotificationServerProxyquired.stop().then(function () {
      thaliNotificationServerProxyquired;
      if (globalVariables.spyStartUpdateAdvertisingAndListening.calledTwice) {
        t.ok(true, 'Stopping works');
      } else {
        t.fail('StartUpdateAdvertisingAndListening is not called twice');
      }
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

test('Makes an HTTP request to /NotificationBeacons', function (t) {
  
  var thaliNotificationServerProxyquired = initializeThaliNotificationServer();

  var httpResponseHandler = function (error, response) { 
    if (error == null && response.statusCode == 200) {
      t.equal(response.headers['cache-control'], 'no-cache');
      t.equal(response.headers['content-type'], 'application/octet-stream');
    } else {
      t.fail('Test failed. Response code is not 200');
    }
    t.end();
  };
  
  var testArray = [
    { url:TESTURL, delay:0, handler: httpResponseHandler}
  ];

  thaliNotificationServerProxyquired.start(generatePublicKeys()).then(function () {
    globalVariables.expressApp.use('/', 
      thaliNotificationServerProxyquired._router);
    globalVariables.expressServer = globalVariables.expressApp.listen(PORT, 
      function () {
      thaliHttpTester.runTest(testArray);
    });
  });
});

test('Makes an HTTP request to /NotificationBeacons (no public keys)', function (t) {
  
  var thaliNotificationServerProxyquired = initializeThaliNotificationServer();

  var httpResponseHandler = function (error, response) { 
    if (error == null && response.statusCode == 204) {
      t.pass('Response code is 204 as expected');
    } else {
      t.fail('Test failed. Response code is not 204');
    }
    t.end();
  };
  
  var testArray = [
    { url:TESTURL, delay:0, handler: httpResponseHandler}
  ];

  thaliNotificationServerProxyquired.start(null).then(function () {
    globalVariables.expressApp.use('/', 
      thaliNotificationServerProxyquired._router);
    globalVariables.expressServer = globalVariables.expressApp.listen(PORT, 
      function () {
      thaliHttpTester.runTest(testArray);
    });
  });
});

test('Test to exceed the rate limit of /NotificationBeacons', function (t) {
  
  var thaliNotificationServerProxyquired = initializeThaliNotificationServer();
  var responseCounter = 0;
  var httpResponseHandler = function (error, response) {
    responseCounter++;
    if (responseCounter >= ThaliNotificationServer.WINDOW_SIZE + 1){
      if (response.statusCode == 503) {
        t.pass('Response is 503 as expected when the rate is exceeded');
      } else {
        t.fail('Server should return 503 when the rate is exceeded');
      }
      t.end();
    } else {
      if (response.statusCode != 200) {
        t.fail('Server should return 200 when the rate limit is not exceeded');
        t.end();
      }
    }
  };
  var testArray = [];

  // RATE+2 ensures that the rate limit is hit
  var delayMultiplayer = 1 / (ThaliNotificationServer.RATE+2); 
  for (var i = 0 ; i < ThaliNotificationServer.WINDOW_SIZE + 1 ; i++) {
    testArray.push({ url:TESTURL, delay:i*delayMultiplayer, 
                      handler: httpResponseHandler});
  }

  thaliNotificationServerProxyquired.start(generatePublicKeys()).then(function () {
    globalVariables.expressApp.use('/', 
      thaliNotificationServerProxyquired._router);
    globalVariables.expressServer = globalVariables.expressApp.listen(PORT, 
      function () {
        thaliHttpTester.runTest(testArray);
      });
  });
});
