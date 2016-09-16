'use strict';

var util     = require('util');
var inherits = util.inherits;

var objectAssign = require('object-assign');
var assert       = require('assert');
var EventEmitter = require('events').EventEmitter;

var asserts = require('./utils/asserts.js');
var logger  = require('./utils/logger')('TestFramework');

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

    if (count && count > 0) {
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
  created: 'created',
  started: 'started',
  succeed: 'succeed',
  failed:  'failed'
}

TestFramework.prototype._setOptions = function (options) {
  var self = this;

  // 'options' provided by the user.
  // Tells us how many devices we need.
  this._options = objectAssign({}, options);

  asserts.isObject(this._options);
  asserts.isObject(this._options.devices);

  var platformNames = Object.keys(this._options.devices);
  assert(
    platformNames.length > 0,
    '\'platformNames\' should not be an empty array'
  );
  platformNames.forEach(function (platformName) {
    asserts.isString(platformName);
    asserts.isNumber(self._options.devices[platformName]);
  });

  asserts.isObject(this._options.minDevices);
  var minPlatformNames = Object.keys(this._options.minDevices);
  asserts.arrayEquals(platformNames.sort(), minPlatformNames.sort());
  minPlatformNames.forEach(function (platformName) {
    asserts.isString(platformName);
    asserts.isNumber(self._options.minDevices[platformName]);
  });
}

TestFramework.prototype.addDevice = function (device) {
  asserts.instanceOf(device, TestDevice);

  if (!device.supportedHardware) {
    logger.info(
      'disqualifying device with unsupported hardware, name: \'%s\'',
      device.name
    );
    device.disqualify();
    return;
  }

  var platform = this.platforms[device.platformName];

  var devices = platform.devices;
  var deviceIndexes = platform.deviceIndexes;
  var count = platform.count;

  var deviceIndex = deviceIndexes[device.uuid];
  if (deviceIndex !== undefined) {
    var existingDevice = devices[deviceIndex];
    asserts.instanceOf(device, TestDevice);

    logger.info(
      'updating existing device, name: \'%s\', uuid: \'%s\', platformName: \'%s\'',
      existingDevice.name, existingDevice.uuid, device.platformName
    );

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
    this.startTests(device.platformName, platform);
  }
};

TestFramework.prototype.startTests = function (platformName, platform) {
  platform.state = TestFramework.platformStates.started;
  this.resolveStarted();
}

TestFramework.prototype.resolveStarted = function () {
  var self = this;

  var isStarted = Object.keys(this.platforms)
  .every(function (platformName) {
    return self.platforms[platformName].state === TestFramework.platformStates.started;
  });
  if (isStarted) {
    this.emit('started');
  }
}

TestFramework.prototype.resolveCompleted = function () {
  var self = this;

  var states = Object.keys(this.platforms)
  .map(function (platformName) {
    return self.platforms[platformName].state;
  });

  var isCompleted = states.every(function (state) {
    return (
      state === TestFramework.platformStates.succeed ||
      state === TestFramework.platformStates.failed
    );
  });
  if (isCompleted) {
    var results = states.map(function (state) {
      return state === TestFramework.platformStates.succeed;
    });
    this.emit('completed', results);
  }
}

module.exports = TestFramework;
