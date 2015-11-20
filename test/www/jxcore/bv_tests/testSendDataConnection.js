'use strict';

var originalMobile = typeof Mobile === 'undefined' ? undefined : Mobile;
var mockMobile = require('./mockmobile');
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

test('#connector should fail if server not running', function (t) {
  var retryTimeout = 200;
  var retryCount = 0; // Make it 0 so that we fail after first attempt
  var sendDataConnector = new SendDataConnector(0, 0, retryTimeout, retryCount, 0);
  
  sendDataConnector.on('done', function (result) {
    t.ok(result, 'received a result to the done event');
    t.end();
  });
  var peer = {
    'peerIdentifier': 'some-peer-identifier'
  };
  sendDataConnector.Start(peer);
  setTimeout(function () {
    Mobile.invokeDisconnect();
    Mobile.invokeConnect(null, 8889);
  }, retryTimeout + 100);
});
