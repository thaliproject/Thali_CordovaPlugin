'use strict';

var originalMobile = typeof Mobile === 'undefined' ? undefined : Mobile;
var mockMobile = require('../bv_tests/mockmobile.js');
var PerfTestFrameworkClient = require('../perf_tests/PerfTestFrameworkClient.js');
var tape = require('../lib/thali-tape');
var EventEmitter = require("events").EventEmitter;

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

test('#passing wrong test name should throw', function (t) {

  var mockServer = new EventEmitter();
  var perfTestFrameworkClient = new PerfTestFrameworkClient('Some device name', null, mockServer);

  mockServer.on("error", function(msg) {
    t.ok(msg != null, msg);
    t.end();
  });

  var testData = {
    'testName': 'testThatDoesNotExist',
    'addressList': []
  };

  mockServer.emit("start", testData); 
});
