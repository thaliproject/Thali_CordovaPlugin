'use strict';

var util   = require('util');
var format = util.format;

var EventEmitter = require('events').EventEmitter;

var tape = require('../lib/thaliTape');
if (!tape.coordinated) {
  return;
}

var UnitTestFramework = require('../../../TestServer/UnitTestFramework.js');
var TestDevice        = require('../../../TestServer/TestDevice.js');

var test = tape({
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    t.end();
  }
});

var createTestDevice = function (socket, platform, index) {
  var tests = ['test-1', 'test-2'];
  return new TestDevice(
    socket,
    {
      name:              platform + ' device ' + index,
      uuid:              platform + '-uuid-' + index,
      os:                platform,
      type:              'unittest',
      supportedHardware: true,
      tests:             tests,
      btaddress:         null
    }
  );
};

var DEVICES_COUNT = 3;

var config = {
  devices: {
    ios:     DEVICES_COUNT,
    android: DEVICES_COUNT
  },
  minDevices: {
    ios:     DEVICES_COUNT,
    android: DEVICES_COUNT
  }
};

var addSetupHandler = function (device, cb) {
  device.tests.forEach(function (test) {
    var socket = device._socket._rawSocket;
    socket.on('setup_' + test, function (data) {
      socket.emit(format('setup_%s_confirmed', test), data);
      cb();
      socket.emit(format('setup_%s_finished', test), {
        success: true
      });
    });
  });
  return device;
};

test('should get right number of setup emits', function (t) {
  var iosSetupCount     = 0;
  var androidSetupCount = 0;
  var iosSetupDone      = false;

  var mockSocket        = new EventEmitter();
  var mockAndroidSocket = new EventEmitter();

  mockSocket.on('schedule', function (data) {
    mockSocket.emit('schedule_confirmed', data);
    mockSocket.emit('schedule_finished', {
      success: true
    });
  });

  function addAndroidSetupHandlers(device) {
    return addSetupHandler(device, function () {
      androidSetupCount++;
      if (androidSetupCount === config.devices.ios) {
        t.ok(true, 'received right amount of setup commands from the server');
        t.end();
      }
    });
  }

  function addIOSSetupHandlers(device) {
    return addSetupHandler(device, function () {
      iosSetupCount++;
      if (iosSetupCount === config.devices.ios) {
        iosSetupDone = true;
        for (var i = 0; i < DEVICES_COUNT; i++) {
          unitTestFramework.addDevice(
            addAndroidSetupHandlers(
              createTestDevice(mockAndroidSocket, 'android', i)
            )
          );
        }
      }
    });
  }

  mockAndroidSocket.on('schedule', function (data) {
    mockAndroidSocket.emit('schedule_confirmed', data);
    mockAndroidSocket.emit('schedule_finished', {
      success: true
    });
  });

  var unitTestFramework = new UnitTestFramework(config);
  for (var i = 0; i < DEVICES_COUNT; i++) {
    unitTestFramework.addDevice(
      addIOSSetupHandlers(
        createTestDevice(mockSocket, 'ios', i)
      )
    );
  }
});

test('should discard surplus devices', function (t) {
  var unitTestFramework = new UnitTestFramework(config);

  unitTestFramework.startTests = function (devices) {
    t.equals(unitTestFramework.platforms.ios.devices.length, DEVICES_COUNT,
      'should have discarded the extra devices');
    t.end();
  };

  // Add two devices more than required in the test config
  for (var i = 0; i < DEVICES_COUNT + 2; i++) {
    unitTestFramework.addDevice(
      addSetupHandler(createTestDevice(new EventEmitter(), 'ios', i))
    );
  }
});

test('should disqualify unsupported device', function (t) {
  var unitTestFramework = new UnitTestFramework(config);
  unitTestFramework.startTests = function () {
    // NOOP
  };

  var mockSocket = new EventEmitter();
  mockSocket.on('disqualify', function (data) {
    mockSocket.emit('disqualify_confirmed', data);
    t.ok(true, 'disqualified unsupported device');
    t.end();
  });

  // Add one device less than required in the test config
  for (var i = 0; i < DEVICES_COUNT - 1; i++) {
    unitTestFramework.addDevice(
      addSetupHandler(createTestDevice(new EventEmitter(), 'ios', i))
    );
  }

  unitTestFramework.addDevice(
    addSetupHandler(new TestDevice(
      mockSocket,
      {
        name: 'some-name',
        uuid: 'some-uuid',
        os: 'ios',
        type: 'unittest',
        supportedHardware: false, // this means the device doesn't have supported hardware
        tests: ['test'],
        btaddress: null
      }
    ))
  );
});
