"use strict";

var ThaliWifiInfrastructure = require('thali/ThaliWifiInfrastructure');
var tape = require('../lib/thali-tape');
var nodessdp = require('node-ssdp');

function noop () { }

var wifiInfrastructure = new ThaliWifiInfrastructure('testDeviceName');

var test = tape({
  setup: function(t) {
    t.end();
  },
  teardown: function(t) {
    // Stop everything at the end of tests to make sure the next test starts from clean state
    wifiInfrastructure.stopAdvertisingAndListeningForIncomingConnections().then(function () {
      wifiInfrastructure.stopListeningForAdvertisements().then(function () {
        t.end();
      });
    });
  }
});

test('#startListeningForAdvertisements should emit wifiPeerAvailabilityChanged after test peer becomes available', function (t) {
  var testLocation = 'http://foo.bar/baz';
  var testServer = new nodessdp.Server({
    location: testLocation,
    allowWildcards: true,
    adInterval: 500,
    udn: 'testServerName'
  });
  wifiInfrastructure.on('wifiPeerAvailabilityChanged', function (data) {
    t.equal(data[0].peerAddress, testLocation);
    testServer.stop();
    t.end();
  });
  testServer.start();
  wifiInfrastructure.startListeningForAdvertisements();
});

test('#startUpdateAdvertisingAndListenForIncomingConnections should use different USN after every invocation', function (t) {
  var originalServer = wifiInfrastructure._server;
  var currentUsn;
  wifiInfrastructure._server = {
    start: noop,
    addUSN: function(usn) {
      currentUsn = usn;
    }
  };
  wifiInfrastructure.startUpdateAdvertisingAndListenForIncomingConnections().then(function() {
    var firstUsn = currentUsn;
    wifiInfrastructure.startUpdateAdvertisingAndListenForIncomingConnections().then(function() {
      t.notEqual(firstUsn, currentUsn);
      wifiInfrastructure._server = originalServer;
      t.end();
    });
  });
});
