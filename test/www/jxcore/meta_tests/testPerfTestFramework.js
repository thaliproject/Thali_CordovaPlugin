'use strict';

var PerfTestFramework = require('../../../TestServer/PerfTestFramework.js');
var TestDevice = require('../../../TestServer/TestDevice.js');
var tape = require('../lib/thali-tape');

var test = tape({
  setup: function(t) {
    t.end();
  },
  teardown: function(t) {
    t.end();
  }
});

test('#should be able to add devices to the framework', function (t) {
  var perfTestFramework = new PerfTestFramework('iOS', 2, true, 1000);
  var testDevice = new TestDevice(null, 'Some device name');
  perfTestFramework.addDevice(testDevice);
  t.equal(perfTestFramework.getCount(), 1);
  t.end();
});
