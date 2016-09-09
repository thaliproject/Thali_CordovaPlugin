'use strict';

var util = require('util');
var inherits = util.inherits;
var extend = util._extend;

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;

require('./utils/polyfills.js');
var asserts = require('./utils/asserts.js');
var TestDevice = require('./TestDevice');


// Base for classes that manage collections of devices and associated tests.
function TestFramework(config, logger) {
  var self = this;

  TestFramework.super_.call(this);

  this.logger = logger || console;
  asserts.exists(this.logger);

  // 'config' provided by the user.
  // Tells us how many devices we need.
  asserts.isObject(config);
  var devices = config.devices;
  asserts.isObject(devices);
  var platformNames = Object.keys(devices);
  assert(
    platformNames.length > 0,
    '\'platformNames\' should not be an empty array'
  );

  this.platforms = platformNames.reduce(function (platforms, platformName) {
    var count = devices[platformName];
    asserts.isNumber(count);

    if (count && count > 0) {
      platforms[platformName] = {
        count: count,
        devices: [],
        deviceIndexes: {},
        success: undefined
      };
    }
    return platforms;
  }, {});
}

inherits(TestFramework, EventEmitter);

TestFramework.prototype.addDevice = function (device) {
  asserts.instanceOf(device, TestDevice);

  if (!device.supportedHardware) {
    this.logger.info(
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

    this.logger.info(
      'updating existing device, name: \'%s\', uuid: \'%s\', platformName: \'%s\'',
      existingDevice.name, existingDevice.uuid, device.platformName
    );

    existingDevice.update(device);
    return;
  }

  if (devices.length === count) {
    this.logger.info(
      'we have enough devices; discarding device, name: \'%s\', platformName: \'%s\'',
      device.name, device.platformName
    );
    device.discard();
    return;
  }

  devices.push(device);
  deviceIndexes[device.uuid] = devices.length - 1;
  this.logger.debug('device added, name: \'%s\'', device.name);

  if (devices.length === count) {
    this.logger.info(
      'all required %d devices are present for platformName: \'%s\'',
      count, device.platformName
    );
    this.startTests(device.platformName, platform);
  }
};

TestFramework.prototype.startTests = function (platformName, platform) {
  throw new Error('should be implemented');
}

TestFramework.prototype.resolveCompleted = function () {
  var self = this;

  var results = Object.keys(this.platforms)
  .map(function (platformName) {
    return self.platforms[platformName].success;
  });
  var isCompleted = results.every(function (result) {
    return result !== undefined;
  })
  if (isCompleted) {
    this.emit('completed', results);
  }
}

module.exports = TestFramework;
