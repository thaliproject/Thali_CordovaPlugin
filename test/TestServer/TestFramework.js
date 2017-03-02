'use strict';

var util     = require('util');
var inherits = util.inherits;
var format   = util.format;

var objectAssign = require('object-assign');
var assert       = require('assert');
var EventEmitter = require('events').EventEmitter;

var asserts = require('./utils/asserts.js');
var logger  = require('./utils/ThaliLogger')('TestFramework');

var TestDevice = require('./TestDevice');


// Base for classes that manage collections of devices and associated tests.
function TestFramework(options) {
  var self = this;

  TestFramework.super_.call(this);

  this._setOptions(options);

  var devices    = this._options.devices;
  var minDevices = this._options.minDevices;
  this.platforms = Object.keys(devices)
  .reduce(function (platforms, platformName) {
    var count    = devices[platformName];
    var minCount = minDevices[platformName];
    asserts.isNumber(count);
    asserts.isNumber(minCount);

    if (count === -1) {
      var timeout = self._options.waiting_for_devices_timeout;
      asserts.isNumber(timeout);
      setTimeout(function () {
        self.startTests(platformName);
      }, timeout);
    }

    if (count === -1 || count > 0) {
      platforms[platformName] = {
        count: count,
        minCount: minCount,
        devices: [],
        deviceIndexes: {},
        state: TestFramework.platformStates.created
      };
    }
    return platforms;
  }, {});
}

inherits(TestFramework, EventEmitter);

TestFramework.platformStates = {
  created:   'created',
  started:   'started',
  succeeded: 'succeeded',
  failed:    'failed'
};

TestFramework.prototype._setOptions = function (options) {
  var self = this;

  // 'options' provided by the user.
  // Tells us how many devices we need.
  this._options = objectAssign({}, options);

  asserts.isObject(this._options, 'TestFramework._setOptions._options');

  // 'this._options.devices' is options for our required platforms.
  asserts.isObject(this._options.devices,
    'TestFramework._setOptions._options.devices');
  var requiredPlatformNames = Object.keys(this._options.devices);
  assert(
    requiredPlatformNames.length > 0,
    '\'requiredPlatformNames\' should not be an empty array'
  );
  requiredPlatformNames.forEach(function (requiredPlatformName) {
    asserts.isString(requiredPlatformName);
    asserts.isNumber(self._options.devices[requiredPlatformName]);
  });

  // 'minDevices' is options for all our desired platforms.
  asserts.isObject(this._options.minDevices,
    'TestFramework._setOptions._options.minDevices');
  var desiredPlatformNames = Object.keys(this._options.minDevices);
  desiredPlatformNames.forEach(function (desiredPlatformName) {
    asserts.isString(desiredPlatformName);
    asserts.isNumber(self._options.minDevices[desiredPlatformName]);
  });

  // Required platforms can not be equal to desired platforms.
  // Required platforms should be included in desired platforms.
  // For example: desired platforms are [ 'android', 'desktop', 'ios' ],
  //   required platforms are [ 'android', 'ios' ].
  requiredPlatformNames.forEach(function (requiredPlatformName) {
    assert(
      desiredPlatformNames.indexOf(requiredPlatformName) !== -1,
      format('platform name: \'%s\' is required', requiredPlatformName)
    );
  });
};

TestFramework.prototype.addDevice = function (device) {
  asserts.instanceOf(device, TestDevice);

  var platform = this.platforms[device.platformName];
  asserts.isObject(platform, 'TestFramework.addDevice.platform');

  var devices = platform.devices;
  var deviceIndexes = platform.deviceIndexes;
  var count = platform.count;

  var deviceDisqualified = false;
  if (!device.hasRequiredHardware) {
    logger.info(
      'disqualifying device with unsupported hardware, name: \'%s\'',
      device.name
    );
    device.disqualify();
    deviceDisqualified = true;
  } else if (device.nativeUTFailed) {
    logger.info(
      'disqualifying device on which native tests failed, name: \'%s\'',
      device.name
    );
    device.disqualify('Native unit tests failed');
    // deviceDisqualified = true;
  }
  // We can require less devices.
  if (deviceDisqualified) {
    if (count > 0) {
      count--;
    }
    return;
  }


  var deviceIndex = deviceIndexes[device.uuid];
  if (deviceIndex !== undefined) {
    var existingDevice = devices[deviceIndex];
    asserts.instanceOf(device, TestDevice);

    logger.info(
      'updating existing device, name: \'%s\', uuid: \'%s\', ' +
      'platformName: \'%s\'', existingDevice.name, existingDevice.uuid,
      device.platformName);

    existingDevice.update(device);
    return;
  }

  if (devices.length === count) {
    logger.info(
      'we have enough devices; discarding device, name: \'%s\', platformName: \'%s\'',
      device.name, device.platformName
    );
    device.discard();
    return;
  }

  devices.push(device);
  deviceIndexes[device.uuid] = devices.length - 1;
  logger.debug('device added, name: \'%s\'', device.name);

  if (devices.length === count) {
    logger.info(
      'all required %d devices are present for platformName: \'%s\'',
      count, device.platformName
    );
    this.startTests(device.platformName);
  }
};

TestFramework.prototype.startTests = function (platformName) {
  asserts.isString(platformName);

  var platform = this.platforms[platformName];
  asserts.isObject(platform, 'TestFramework.startTests.platform');

  assert(
    platform.state === TestFramework.platformStates.created,
    'platform should be in created state'
  );
  platform.state = TestFramework.platformStates.started;

  var devices = platform.devices;
  asserts.isArray(devices);

  var count = platform.count;
  asserts.isNumber(count);
  if (count === -1) {
    count = devices.length;
  } else {
    assert(
      count === devices.length,
      format(
        'we should receive %d devices for platform: \'%s\', ' +
        'but received %d devices instead',
        count, platformName, devices.length
      )
    );
  }

  var minCount = platform.minCount;
  assert(
    count >= minCount,
    format(
      'we should have at least %d devices',
      minCount
    )
  );

  devices.forEach(function (device) {
    asserts.instanceOf(device, TestDevice);
  });

  var tests = devices[0].tests;
  devices.slice(1).forEach(function (device) {
    asserts.arrayEquals(tests, device.tests);
  });

  this.resolveStarted();
};

TestFramework.prototype.resolveStarted = function () {
  var self = this;

  var isStarted = Object.keys(this.platforms)
  .every(function (platformName) {
    return self.platforms[platformName].state ===
      TestFramework.platformStates.started;
  });
  if (isStarted) {
    this.emit('started');
  }
};

TestFramework.prototype.resolveCompleted = function () {
  var self = this;

  var states = Object.keys(this.platforms)
  .map(function (platformName) {
    return self.platforms[platformName].state;
  });

  var isCompleted = states.every(function (state) {
    return (
      state === TestFramework.platformStates.succeeded ||
      state === TestFramework.platformStates.failed
    );
  });
  if (isCompleted) {
    var results = states.map(function (state) {
      return state === TestFramework.platformStates.succeeded;
    });
    this.emit('completed', results);
  }
};

module.exports = TestFramework;
