'use strict';

var originalMobile = typeof Mobile === 'undefined' ? undefined : Mobile;
var mockMobile = require('../bv_tests/mockmobile.js');
var PerfTestFramework = require('../perf_tests/PerfTestFramework.js');
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
  var perfTestFramework = new PerfTestFramework('Some device name');
  perfTestFramework.on('done', function (result) {
    t.ok(result, 'received a result to the done event');
    t.end();
  });
  var commandData = {
    'command': 'start',
    'testName': 'commandThatDoesNotExist'
  };
  perfTestFramework.handleCommand(JSON.stringify(commandData));
});
