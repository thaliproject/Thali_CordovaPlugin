'use strict';

var util     = require('util');
var inherits = util.inherits;
var format   = util.format;

var assert       = require('assert');
var Promise      = require('bluebird');
var objectAssign = require('object-assign');

var asserts       = require('./utils/asserts.js');
var TestDevice    = require('./TestDevice');
var TestFramework = require('./TestFramework');
var defaultConfig = require('./UnitTestConfig');


function UnitTestFramework(config, logger) {
  var self = this;

  this.logger = logger || console;
  this.config = objectAssign({}, defaultConfig, config);

  UnitTestFramework.super_.call(this, this.config, this.logger);
}

inherits(UnitTestFramework, TestFramework);

UnitTestFramework.prototype.startTests = function (platformName, platform) {
  var self = this;

  UnitTestFramework.super_.prototype.startTests.call(this, platformName, platform);

  assert(platform.success === undefined, 'platform should not be finished');

  asserts.isObject(platform);
  asserts.isString(platformName);

  var devices = platform.devices;
  asserts.isArray(devices);

  var count = platform.count;
  asserts.isNumber(count);
  assert(
    count > 0,
    'we should have at least one device'
  );

  assert(
    count === devices.length,
    format(
      'we should receive %d devices for platform: \'%s\', but received %d devices instead',
      count, platformName, devices.length
    )
  );

  devices.forEach(function (device) {
    asserts.instanceOf(device, TestDevice);
  });

  var tests = devices[0].tests;
  devices.slice(1).forEach(function (device) {
    asserts.arrayEquals(tests, device.tests);
  });

  this.logger.debug(
    'starting unit tests on %d devices, platformName: \'%s\'',
    devices.length, platformName
  );

  this.logger.debug('scheduling tests');

  Promise.all(
    devices.map(function (device) {
      return device.scheduleTests(tests);
    })
  )
  .then(function () {
    self.logger.debug('tests scheduled');

    return tests.reduce(function (promise, test) {
      return promise.then(function () {
        return self.runTest(devices, test);
      });
    }, Promise.resolve());
  })
  .then(function () {
    platform.success = true;
    self.logger.debug(
      'all unit tests succeed, platformName: \'%s\'',
      platformName
    );
  })
  .catch(function (error) {
    platform.success = false;
    self.logger.error(
      'failed to run tests, platformName: \'%s\', error: \'%s\', stack: \'%s\'',
      platformName, error.toString(), error.stack
    );
  })
  .finally(function () {
    return Promise.all(
      devices.map(function (device) {
        return device.complete();
      })
    );
  })
  .finally(function () {
    self.resolveCompleted();
  });
}

UnitTestFramework.prototype.runTest = function (devices, test) {
  var self = this;

  this.logger.debug('#setup: \'%s\'', test);

  return Promise.all(
    devices.map(function (device) {
      return device.setupTest(test)
      .then(function (data) {
        return {
          uuid: device.uuid,
          data: data
        }
      });
    })
  )
  .then(function (devicesData) {
    self.logger.debug('#setup ok: \'%s\'', test);
    self.logger.debug('#run: \'%s\'', test);

    return Promise.all(
      devices.map(function (device) {
        return device.runTest(test, devicesData);
      })
    );
  })
  .then(function () {
    self.logger.debug('#run ok: \'%s\'', test);
    self.logger.debug('#teardown: \'%s\'', test);

    return Promise.all(
      devices.map(function (device) {
        return device.teardownTest(test);
      })
    );
  })
  .then(function () {
    self.logger.debug('#teardown ok: \'%s\'', test);
  })
  .catch(function (error) {
    self.logger.error(
      '#run failed: \'%s\', error: \'%s\', stack: \'%s\'',
      test, error.toString(), error.stack
    );
    return Promise.reject(error);
  });
}

module.exports = UnitTestFramework;
