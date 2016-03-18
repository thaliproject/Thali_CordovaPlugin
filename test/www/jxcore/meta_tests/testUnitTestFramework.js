'use strict';

var UnitTestFramework = require('../../../TestServer/UnitTestFramework.js');
var TestDevice = require('../../../TestServer/TestDevice.js');
var tape = require('../lib/thali-tape');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

var test = tape({
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    t.end();
  }
});

var createTestDevice = function (socket, platform, index) {
  var name = platform + ' device ' + index;
  var uuid = platform + '-uuid-' + index;
  var tests = ['test-1', 'test-2'];
  return new TestDevice(socket, name, uuid, platform, 'unittest', tests, null);
};

var testConfig = {
  devices: {
    ios: 2,
    android: 2
  },
  honorCount: true
};

var addSetupHandler = function (device, cb) {
  device.tests.forEach(function (test) {
    device.socket.on('setup_' + test, function (data) {
      device.socket.emit(util.format('setup_%s_ok', test));
      cb(data);
    });
  });
  return device;
};


test('should get right number of setup emits', function (t) {
  var iosSetupCount = 0;
  var androidSetupCount = 0;
  var iosSetupDone = false;

  var mockSocket = new EventEmitter();
  var mockAndroidSocket = new EventEmitter();

  mockSocket.on('schedule', function () {
    mockSocket.emit('schedule_complete');
  });

  function addAndroidSetupHandlers(device) {
    return addSetupHandler(device, function () {
      androidSetupCount++;
      if (androidSetupCount === testConfig.devices.ios) {
        t.ok(true, 'received right amount of setup commands from the server');
        t.end();
      }
    });
  }

  function addIOSSetupHandlers(device) {
    return addSetupHandler(device, function () {
      iosSetupCount++;
      if (iosSetupCount === testConfig.devices.ios) {
        iosSetupDone = true;
        for (var i = 0; i < 2; i++) {
          unitTestFramework.addDevice(
            addAndroidSetupHandlers(
              createTestDevice(mockAndroidSocket, 'android', i)));
        }
      }
    });
  }

  mockAndroidSocket.on('schedule', function () {
    mockAndroidSocket.emit('schedule_complete');
  });

  var unitTestFramework = new UnitTestFramework(testConfig);
  for (var i = 0; i < 2; i++) {
    unitTestFramework.addDevice(
      addIOSSetupHandlers(createTestDevice(mockSocket, 'ios', i)));
  }
});

test('should discard surplus devices', function (t) {
  var unitTestFramework = new UnitTestFramework(testConfig);
  // Add one device more than required in the test config
  var amountOfDevices = testConfig.devices.ios + 1;
  for (var i = 0; i < amountOfDevices; i++) {
    unitTestFramework.addDevice(
      addSetupHandler(createTestDevice(new EventEmitter(), 'ios', i)));
  }
  t.ok(unitTestFramework.devices.ios.length === amountOfDevices - 1,
    'should have discarded the extra device');
  t.end();
});
