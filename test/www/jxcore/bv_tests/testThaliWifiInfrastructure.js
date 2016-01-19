'use strict';

var ThaliWifiInfrastructure = require('thali/NextGeneration/thaliWifiInfrastructure');
var tape = require('../lib/thali-tape');
var nodessdp = require('node-ssdp');
var express = require('express');
var http = require('http');

var TEST_DEVICE_NAME = 'testDeviceName'

var wifiInfrastructure = new ThaliWifiInfrastructure(TEST_DEVICE_NAME);

var test = tape({
  setup: function(t) {
    wifiInfrastructure.start(express()).then(function () {
      t.end();
    });
  },
  teardown: function(t) {
    // Stop everything at the end of tests to make sure
    // the next test starts from clean state
    wifiInfrastructure.stop().then(function () {
      t.end();
    });
  }
});

test('#startListeningForAdvertisements should emit wifiPeerAvailabilityChanged after test peer becomes available', function (t) {
  var testLocation = 'http://foo.bar/baz';
  var testServer = new nodessdp.Server({
    location: testLocation,
    allowWildcards: true,
    adInterval: 500,
    udn: 'somePeerDeviceName' + ':' + wifiInfrastructure.thaliUsn
  });
  wifiInfrastructure.on('wifiPeerAvailabilityChanged', function (data) {
    t.equal(data[0].peerLocation, testLocation);
    testServer.stop(function () {
      t.end();
    });
  });
  testServer.start(function () {
    wifiInfrastructure.startListeningForAdvertisements();
  });
});

test('#startUpdateAdvertisingAndListening should use different USN after every invocation', function (t) {
  var originalAddUsn = wifiInfrastructure._server.addUSN;
  var currentUsn;
  wifiInfrastructure._server.addUSN = function(usn) {
    currentUsn = usn;
  };
  wifiInfrastructure.startUpdateAdvertisingAndListening()
  .then(function() {
    var firstUsn = currentUsn;
    wifiInfrastructure.startUpdateAdvertisingAndListening()
    .then(function() {
      t.notEqual(firstUsn, currentUsn);
      wifiInfrastructure._server.addUSN = originalAddUsn;
      t.end();
    });
  });
});

test('verify that Thali-specific messages are filtered correctly', function (t) {
  var irrelevantMessage = {
    USN: 'foobar'
  };
  t.equal(true, wifiInfrastructure._shouldBeIgnored(irrelevantMessage), 'irrelevant messages should be ignored');
  var relevantMessage = {
    USN: wifiInfrastructure.thaliUsn
  };
  t.equal(false, wifiInfrastructure._shouldBeIgnored(relevantMessage), 'relevant messages should not be ignored');
  var messageFromSelf = {
    USN: TEST_DEVICE_NAME + ':' + wifiInfrastructure.thaliUsn
  };
  t.equal(true, wifiInfrastructure._shouldBeIgnored(messageFromSelf), 'messages from this device should be ignored');
  t.end();
});

test('#start should fail if called twice in a row', function (t) {
  // The start here is already the second since it is being
  // done once in the setup phase
  wifiInfrastructure.start(express())
  .catch(function (error) {
    t.ok(error === 'Call Stop!', 'specific error should be received');
    t.end();
  });
});

test('#start should start hosting given router object', function (t) {
  var app = express();
  app.get('/', function (req, res) {
    res.send('foobar');
  });
  wifiInfrastructure.stop()
  .then(function () {
    return wifiInfrastructure.start(app);
  })
  .then(function () {
    http.get({
      port: wifiInfrastructure.port,
      agent: false // to prevent connection keep-alive
    }, function (res) {
      t.ok(res.statusCode === 200, 'server should respond with code 200');
      t.end();
    });
  });
});

test('#stop can be called multiple times in a row', function (t) {
  wifiInfrastructure.stop()
  .then(function () {
    t.ok(wifiInfrastructure.started === false, 'should be in stopped state');
    return wifiInfrastructure.stop();
  })
  .then(function () {
    t.ok(wifiInfrastructure.started === false, 'should still be in stopped state');
    t.end();
  });
});