'use strict';

var PerfTestFramework = require('../../../TestServer/PerfTestFramework.js');
var TestDevice = require('../../../TestServer/TestDevice.js');
var tape = require('../lib/thaliTape');

var test = tape({
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    t.end();
  }
});

test('should be able to add devices to the framework', function (t) {
  var testConfig = {
    devices: {
      ios: 2
    },
    honorCount: true
  };
  var perfTestFramework = new PerfTestFramework(testConfig);
  var testDevice = new TestDevice(
    null, 'Some name', 'uuid', 'ios', 'perftest', [], true, null
  );
  perfTestFramework.addDevice(testDevice);
  t.equal(perfTestFramework.devices.ios.length, 1);
  t.end();
});
