/* TestFramework - Base for classes that manage collections of devices and associated tests
 */

'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;
var assert = require('assert');

var logger = console;

function TestFramework(testConfig, userConfig, _logger) {

  if (_logger) {
    logger = _logger;
  }

  TestFramework.super_.call(this);

  this.devices = {};

  // testConfig - Config provided by the CI system. Tells how many devices are available
  // userConfig - Config provided by the user (via source). Tells us how many devices we need
  this.testConfig = testConfig;
  this.userConfig = userConfig;

  var self = this;

  // availableDevices is the number of devices per platform
  // we need to complete the test
  this.availableDevices = {};

  // requiredDevices is the number of devices per platform
  // we need to complete the test
  this.requiredDevices = {};

  // Populate first from the original testConfig which is
  // the number of available devices the CI system think deployed succesfully
  Object.keys(this.testConfig.devices).forEach(function (platform) {
    self.availableDevices[platform] = self.testConfig.devices[platform];
  });

  // Then use the userConfig which may specify a smaller number
  // of devices
  Object.keys(this.userConfig).forEach(function (platform) {
    // -1 indicates to use all devices
    if (self.userConfig[platform].numDevices &&
        self.userConfig[platform].numDevices !== -1) {
      self.requiredDevices[platform] = self.userConfig[platform].numDevices;
    } else {
      self.requiredDevices[platform] = self.availableDevices[platform];
    }
    if (self.requiredDevices[platform] > self.availableDevices[platform]) {
      self.requiredDevices[platform] = self.availableDevices[platform];
    }
  });
}

util.inherits(TestFramework, EventEmitter);

// the Fisher-Yates (aka Knuth) Shuffle.
// http://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
var shuffle = function (array) {
  var currentIndex = array.length, temporaryValue, randomIndex;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
};

TestFramework.prototype.addDevice = function (device) {

  // this.devices = { 'ios' : [dev1, dev2], 'android' : [dev3, dev4] }
  if (!this.devices[device.platform]) {
    this.devices[device.platform] = [device];
  } else {

    // This is annoying.. android devices will randomly disconnect and reconnect during a run
    // When they do we need to patch the existing device record with the new socket by comparing
    // the uuid's. The new socket won't have any of the old socket's event handlers though..
    // .. so we need to transfer them from the old to the new socket.

    var existing = this.devices[device.platform].filter(function (d) {
      return d.uuid === device.uuid;
    });

    assert(existing.length <= 1,
      'should not have more than 1 device with same uuid');

    if (existing.length === 1) {
      var existingDevice = existing[0];

      logger.info(
        'Updating existing device: %s (%s)',
        existingDevice.deviceName, existingDevice.uuid
      );

      // Move all the event listeners from the existing device
      device.socket._events = existingDevice.socket._events;
      existingDevice.socket = device.socket;

      return;
    }

    // Straightforward add new device
    this.devices[device.platform].push(device);
  }

  // See if we have added all devices of platform type
  if (this.devices[device.platform].length ===
      this.availableDevices[device.platform]) {
    logger.info(
      'All %d %s devices are present',
      this.availableDevices[device.platform], device.platform
    );

    var finalDevices = this.devices[device.platform]
      .filter(function (deviceCandidate) {
        if (!deviceCandidate.supportedHardware) {
          logger.info('Disqualifying device with unsupported hardware: %s',
            deviceCandidate.deviceName);
          deviceCandidate.socket.emit('disqualify');
          return false;
        } else if (deviceCandidate.nativeUTFailed) {
          logger.info('Disqualifying device on which native unit tests failed: %s',
            deviceCandidate.deviceName);
          deviceCandidate.socket.emit('disqualify');
          return false;
        }
        return true;
      }
    );
    shuffle(finalDevices);

    var requiredDevices = this.requiredDevices[device.platform].length;
    var deviceNumber = 0;
    this.devices[device.platform] = finalDevices
      .filter(function (deviceCandidate) {
        deviceNumber++;
        if (deviceNumber > requiredDevices) {
          // Discard surplus devices..
          logger.info('Discarding surplus device: %s',
            deviceCandidate.deviceName);
          deviceCandidate.socket.emit('discard');
          return false;
        }
        return true;
      }
    );

    this.startTests(device.platform);
  }
};

module.exports = TestFramework;
