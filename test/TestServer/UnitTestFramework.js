'use strict';

var util     = require('util');
var inherits = util.inherits;

var assert       = require('assert');
var objectAssign = require('object-assign');

var asserts = require('./utils/asserts.js');
var Promise = require('bluebird');
var logger  = require('./utils/ThaliLogger')('UnitTestFramework');

var TestDevice    = require('./TestDevice');
var TestFramework = require('./TestFramework');
var defaultConfig = require('./config/UnitTest');


function UnitTestFramework(config) {
  var self = this;

  this.config = objectAssign({}, defaultConfig, config);

  UnitTestFramework.super_.call(this, this.config);
}

inherits(UnitTestFramework, TestFramework);

UnitTestFramework.prototype.startTests = function (platformName) {
  var self = this;

  UnitTestFramework.super_.prototype.startTests.apply(this, arguments);

  var platform = this.platforms[platformName];
  var devices = platform.devices;
  var tests   = devices[0].tests;

  logger.debug(
    'starting unit tests on %d devices, platformName: \'%s\'',
    devices.length, platformName
  );

  logger.debug('scheduling tests');

  Promise.all(
    devices.map(function (device) {
      return device.scheduleTests(tests);
    })
  )
  .then(function () {
    logger.debug('tests scheduled');

    return tests.reduce(function (promise, test) {
      return promise.then(function () {
        return self.runTest(devices, test);
      });
    }, Promise.resolve());
  })
  .then(function () {
    platform.state = TestFramework.platformStates.succeeded;
    logger.debug(
      'all unit tests succeeded, platformName: \'%s\'',
      platformName
    );
  })
  .catch(function (error) {
    platform.state = TestFramework.platformStates.failed;
    logger.error(
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

  logger.debug('#setup: \'%s\'', test);

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
    logger.debug('#setup ok: \'%s\'', test);
    logger.debug('#run: \'%s\'', test);

    return Promise.all(
      devices.map(function (device) {
        return device.runTest(test, devicesData);
      })
    );
  })
  .then(function () {
    logger.debug('#run ok: \'%s\'', test);
    logger.debug('#teardown: \'%s\'', test);

    return Promise.all(
      devices.map(function (device) {
        return device.teardownTest(test);
      })
    );
  })
  .then(function () {
    logger.debug('#teardown ok: \'%s\'', test);
  })
  .catch(function (error) {
    logger.error(
      '#run failed: \'%s\', error: \'%s\', stack: \'%s\'',
      test, error.toString(), error.stack
    );
    return Promise.reject(error);
  });
}

module.exports = UnitTestFramework;
