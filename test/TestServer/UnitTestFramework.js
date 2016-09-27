'use strict';

var util     = require('util');
var inherits = util.inherits;

var assert       = require('assert');
var objectAssign = require('object-assign');

var asserts = require('./utils/asserts.js');
var Promise = require('./utils/Promise');
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

    self.bindSync(devices);

    var skippedTests = [];
    return tests.reduce(function (promise, test) {
      return promise.then(function () {
        return self.runTest(devices, test)
        .catch(function (error) {
          if (error.message === 'skipped') {
            skippedTests.push(test);
            return;
          }
          return Promise.reject(error);
        });
      });
    }, Promise.resolve())
    .then(function () {
      return skippedTests;
    });
  })
  .then(function (skippedTests) {
    platform.state = TestFramework.platformStates.succeeded;
    logger.debug(
      'all unit tests succeeded, platformName: \'%s\'',
      platformName
    );
    logger.debug(
      'skipped tests: \'%s\'', JSON.stringify(skippedTests)
    );
  })
  .catch(function (error) {
    platform.state = TestFramework.platformStates.failed;
    logger.error(
      'failed to run unit tests, platformName: \'%s\', error: \'%s\', stack: \'%s\'',
      platformName, error.toString(), error.stack
    );
  })
  .finally(function () {
    self.unbindSync(devices);

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

  // Some device skipped our test.
  var skipped = false;

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
        return device.runTest(test, devicesData, true)
        .catch(function (error) {
          if (error.message === 'skipped') {
            skipped = true;
            return;
          }
          return Promise.reject(error);
        });
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
  })
  .then(function () {
    if (skipped) {
      return Promise.reject(
        new Error('skipped')
      );
    }
  });
}

UnitTestFramework.prototype.sync = function (devicesData, index, syncData) {
  logger.debug('#sync');

  var isSyncDataTheSame = devicesData.every(function (deviceData) {
    if (deviceData.syncData) {
      return deviceData.syncData === syncData;
    } else {
      return true;
    }
  });
  assert(
    isSyncDataTheSame,
    'syncData should be the same between all devices'
  );

  var deviceData = devicesData[index];
  assert(
    !deviceData.syncData,
    'syncData should be unique'
  );
  deviceData.syncData = syncData;

  var isFinished = devicesData.every(function (deviceData) {
    return !!deviceData.syncData;
  });
  if (isFinished) {
    var promises = devicesData.map(function (deviceData) {
      delete deviceData.syncData;
      return deviceData.device.syncFinished(syncData);
    });
    logger.debug('#sync ok');
    Promise.all(promises)
    .catch(function (error) {
      logger.error(
        '#sync failed: error: \'%s\', stack: \'%s\'',
        error.toString(), error.stack
      );
      return Promise.reject(error);
    })
  }
}

UnitTestFramework.prototype.bindSync = function (devices) {
  var self = this;
  var devicesData = devices.map(function (device) {
    return { device: device };
  });
  this._sync = this.sync.bind(this, devicesData);
  devices.forEach(function (device, index) {
    device.on('sync', function (data) {
      self._sync(index, data);
    });
  });
}

UnitTestFramework.prototype.unbindSync = function (devices) {
  var self = this;
  devices.forEach(function (device) {
    device.removeListener('sync', self._sync);
  });
}

module.exports = UnitTestFramework;
