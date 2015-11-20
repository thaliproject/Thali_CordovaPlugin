'use strict';

var originalMobile = typeof Mobile === 'undefined' ? undefined : Mobile;
var mockMobile = require('../bv_tests/mockmobile.js');
var SendDataConnector = require('../perf_tests/SendDataConnector.js');
var SendDataTCPServer = require('../perf_tests/SendDataTCPServer.js');
var TestSendData = require('../perf_tests/testSendData.js');
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
    sendDataTCPServer.stopServer(function () {
      t.end();
    });
  });
  sendDataConnector.Start(somePeer);
  setTimeout(function () {
    Mobile.invokeDisconnect();
    Mobile.invokeConnect(null, testPort);
  }, retryTimeout + 100);
});

var numberOfPeers = 5;
test('#should run test with ' + numberOfPeers + ' peers', function (t) {
  global.Mobile = function (key) {
    return {
      'callNative': function () {
        if (key === 'Connect') {
          setTimeout(arguments[arguments.length - 1](null, testPort), 100);
        } else {
          setTimeout(arguments[arguments.length - 1], 100);
        }
      },
      'registerToNative': function () {}
    }
  }
  var testData = {
    'timeout': '1500000',
    'rounds': '1',
    'dataTimeout': '10000',
    'dataAmount': '100000',
    'conReTryTimeout': '50',
    'conReTryCount': '5'
  };

  var testPeerList = [];
  for (var i = 0; i < numberOfPeers; i++) {
    testPeerList.push({
      'address': 'device-address-' + i
    });
  }
  var testSendData = new TestSendData(JSON.stringify(testData), 'device-identifier-me', numberOfPeers, testPeerList);
  testSendData.start(testPort);

  testSendData.on('done', function (resultString) {
    t.ok(resultString, 'received a result to the done event');
    var resultData = JSON.parse(resultString);
    t.equal(resultData.sendList.length, numberOfPeers);
    t.end();
  });
});