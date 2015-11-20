'use strict';

var originalMobile = typeof Mobile === 'undefined' ? undefined : Mobile;
var mockMobile = require('../bv_tests/mockmobile.js');
var SendDataConnector = require('../perf_tests/SendDataConnector.js');
var SendDataTCPServer = require('../perf_tests/SendDataTCPServer.js');
var tape = require('../lib/thali-tape');

var test = tape({
  setup: function(t) {
    global.Mobile = mockMobile;
    t.end();
  },
  teardown: function(t) {
    global.Mobile = originalMobile;
    t.end();
  }
});

var somePeer = {
  'peerIdentifier': 'some-peer-identifier'
};
var testPort = 8889;

test('#connector should fail if server not running', function (t) {
  var retryTimeout = 200;
  var retryCount = 0; // Make it 0 so that we fail after first attempt
  var sendDataConnector = new SendDataConnector(1, 0, retryTimeout, retryCount, 0);
  
  sendDataConnector.on('done', function (result) {
    t.ok(result, 'received a result to the done event');
    t.end();
  });
  sendDataConnector.Start(somePeer);
  setTimeout(function () {
    Mobile.invokeDisconnect();
    Mobile.invokeConnect(null, testPort);
  }, retryTimeout + 100);
});

test('#connector should be able to send data to a running server', function (t) {
  var retryTimeout = 200;
  var dataAmount = 1000000; // amount in bytes
  var sendDataConnector = new SendDataConnector(1, dataAmount, retryTimeout, 0, 0);

  var sendDataTCPServer = new SendDataTCPServer(testPort);

  sendDataConnector.on('done', function (result) {
    t.ok(result, 'received a result to the done event');
    sendDataTCPServer.stopServer();
    t.end();
  });
  sendDataConnector.Start(somePeer);
  setTimeout(function () {
    Mobile.invokeDisconnect();
    Mobile.invokeConnect(null, testPort);
  }, retryTimeout + 100);
});
