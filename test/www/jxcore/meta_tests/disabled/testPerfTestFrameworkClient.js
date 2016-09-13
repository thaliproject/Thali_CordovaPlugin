'use strict';

var originalMobile = typeof Mobile === 'undefined' ? undefined : Mobile;
var mockMobile = require('../bv_tests/disabled/mockmobile.js');
var PerfTestFrameworkClient = require('../perf_tests/PerfTestFrameworkClient.js');
var tape = require('../lib/thaliTape');
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

test('passing wrong test name should throw', function (t) {

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

test('own address should be filtered out and try count reseted', function (t) {
  var myAddress = 'C0:EE:EE:EE:42:00'
  var dummyAddress = 'C0:FF:FF:EE:42:00';

  var mockServer = new EventEmitter();
  var perfTestFrameworkClient = new PerfTestFrameworkClient('Some device name', myAddress, mockServer);

  perfTestFrameworkClient.tests = {
    'mockTest': function (testData, deviceName, addressList) {
      t.ok(addressList.length === 1, 'own address filtered out');
      t.ok(addressList[0].address === dummyAddress, 'other addresses in the address property');
      t.ok(addressList[0].tryCount === 0, 'try count is 0 in the beginning');
      return {
        start: function () {
          t.end();
        },
        on: function () {}
      };
    }
  };

  var testData = {
    'testName': 'mockTest',
    'addressList': [myAddress, dummyAddress]
  };

  mockServer.emit('start', testData);
});
