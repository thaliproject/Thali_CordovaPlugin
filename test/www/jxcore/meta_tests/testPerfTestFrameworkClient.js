'use strict';

var originalMobile = typeof Mobile === 'undefined' ? undefined : Mobile;
var mockMobile = require('../bv_tests/mockmobile.js');
var PerfTestFrameworkClient = require('../perf_tests/PerfTestFrameworkClient.js');
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

test('#passing wrong test name should emit done', function (t) {
  var perfTestFrameworkClient = new PerfTestFrameworkClient('Some device name');
  perfTestFrameworkClient.on('done', function (result) {
    t.ok(result, 'received a result to the done event');
    t.end();
  });
  var commandData = {
    'command': 'start',
    'testName': 'commandThatDoesNotExist'
  };
  perfTestFrameworkClient.handleCommand(JSON.stringify(commandData));
});
