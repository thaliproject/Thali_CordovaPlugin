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
function TestFramework(testConfig, userConfig, logger) {
  var self = this;

  TestFramework.super_.call(this);

  this.logger = logger || console;
  asserts.exists(this.logger);

  // 'testConfig' provided by the CI system.
  // Tells how many devices are available.
  asserts.isObject(testConfig);
  asserts.isObject(testConfig.devices);
  var testPlatforms = Object.keys(testConfig.devices);
  assert(
    testPlatforms.length > 0,
    '\'testPlatforms\' should not be an empty array'
  );

  // 'userConfig' provided by the user (via source).
  // Tells us how many devices we need.
  asserts.isObject(testConfig);
  var userPlatforms = Object.keys(userConfig);
  assert(
    userPlatforms.length > 0,
    '\'userPlatforms\' should not be an empty array'
  );
  asserts.arrayEquals(testPlatforms.sort(), userPlatforms.sort());

  // Number of devices per platform we can use to complete the test
  // that the CI system think deployed succesfully.
  var availableDeviceCounts = testConfig.devices;
  asserts.isObject(availableDeviceCounts);

  // Then use the userConfig which may specify a smaller number of devices.
  this.platforms = testPlatforms.reduce(function (platforms, platform) {
    var platformData = userConfig[platform];
    asserts.isObject(platformData);
    var count = platformData.numDevices;

    var availableCount = availableDeviceCounts[platform];
    asserts.isNumber(availableCount);

    if (count === undefined || count === null || count === -1) {
      // Use all available devices.
      count = availableCount;
    }
    assert(count <= availableCount, 'we should have enough devices');

    platforms[platform] = {
      count: count,
      devices: [],
      deviceIndexes: {}
    };
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

  var platform = this.platforms[device.platform];

  var devices = platform.devices;
  var deviceIndexes = platform.deviceIndexes;
  var count = platform.count;

  var deviceIndex = deviceIndexes[device.uuid];
  if (deviceIndex) {
    var existingDevice = devices[deviceIndex];
    asserts.instanceOf(device, TestDevice);

    // This is annoying.
    // Android devices will randomly disconnect and reconnect during a run.
    // When they do we need to patch the existing device record.
    // with the new socket by comparing the uuid's.
    // The new socket won't have any of the old socket's event handlers though.
    // So we need to transfer them from the old to the new socket.

    this.logger.info(
      'updating existing device, name: \'%s\', uuid: \'%s\'',
      existingDevice.name, existingDevice.uuid
    );

    // Move all the event listeners from the existing device
    // device.socket._events = existingDevice.socket._events;
    // existingDevice.socket = device.socket;
    return;
  }

  if (devices.length === count) {
    this.logger.info(
      'we have enough devices; discarding device, name: \'%s\'',
      device.name
    );
    device.discard();
    return;
  }

  devices.push(device);
  this.logger.debug('device added, name: \'%s\'', device.name);

  if (devices.length === count) {
    this.logger.info(
      'all required %d devices are present for platform: \'%s\'',
      count, device.platform
    );
    this.startTests(device.platform, platform);
  }
};

TestFramework.prototype.startTests = function (platformName, platform) {
  throw new Error('should be implemented');
}

module.exports = TestFramework;
