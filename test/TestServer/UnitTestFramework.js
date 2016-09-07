'use strict';

var util = require('util');
var inherits = util.inherits;
var format = util.format;

var assert = require('assert');
var Promise = require('bluebird');

var asserts = require('./utils/asserts.js');
var TestDevice = require('./TestDevice');
var TestFramework = require('./TestFramework');
var unitTestConfig = require('./UnitTestConfig');


function UnitTestFramework(testConfig, logger) {
  var self = this;

  this.logger = logger || console;
  this.unitTestConfig = testConfig.userConfig || unitTestConfig;

  UnitTestFramework.super_.call(this, testConfig, this.unitTestConfig, this.logger);
}

util.inherits(UnitTestFramework, TestFramework);

UnitTestFramework.prototype.startTests = function (platformName, platform) {
  var self = this;

  asserts.isObject(platform);
  asserts.isString(platformName);

  var devices = platform.devices;
  asserts.isArray(devices);

  var config = this.unitTestConfig[platformName];
  asserts.isObject(config);

  var desigedCount = config.numDevices;
  asserts.isNumber(desigedCount);
  assert(desigedCount > 0, 'we should have at least one device');

  assert(
    devices.length === desigedCount,
    format(
      'we should receive %d devices for platform: \'%s\', but received %d devices instead',
      desigedCount, platformName, devices.length
    )
  );

  devices.forEach(function (device) {
    asserts.instanceOf(device, TestDevice);
  });

  var tests = devices[0].tests;
  devices.slice(1).forEach(function (device) {
    asserts.arrayEquals(tests, device.tests);
  });

  this.logger.info(
    'Starting unit tests on %d devices, platform: \'%s\'',
    devices.length, platformName
  );

  Promise.all(
    devices.map(function (device) {
      return device.scheduleTests();
    })
  )
  .then(function () {
    ;
  })
  .catch(function (error) {
    self.logger.error(
      'failed to run tests, reason: \'%s\'',
      error.stack
    );
  });
}

/*
UnitTestFramework.prototype.startTests = function (platform, tests) {
  var toComplete;
  var results = {};

  function doTest(test, cb) {
    self.logger.info('Running on %s test: %s', platform, test);

    function emit(device, msg, data) {
      // Try to retry 120 times every second, because
      // it might be that the socket connection is temporarily
      // down while the retries are tried so this gives
      // the device 2 minutes to reconnect.
      var retries = 120;
      var retryInterval = 1000;
      var emitTimeout = null;

      var acknowledged = false;
      device.socket.once(util.format('%s_ok', msg), function () {
        acknowledged = true;
        if (emitTimeout !== null) {
          clearTimeout(emitTimeout);
        }
      });

      // Emit message every second until acknowledged.
      function _emit() {
        if (!acknowledged) {
          if (data) {
            device.socket.emit(msg, data);
          } else {
            device.socket.emit(msg);
          }
          if (--retries > 0) {
            emitTimeout = setTimeout(_emit, retryInterval);
          } else {
            self.logger.debug(
              'Too many emit retries to device: %s',
              device.name
            );
          }
        }
      }
      setTimeout(_emit, 0);
    }

    var nextStageData = [];
    // Convenience: Move to next stage in test
    function doNext(stage, stageData) {
      if (stageData) {
        nextStageData.push({
          uuid: stageData.uuid,
          data: stageData.data
        });
      }
      // We need to have seen all devices report in before we
      // can proceed to the next stage
      if (--toComplete === 0) {
        toComplete = devices.length;
        devices.forEach(function (device) {
          // Tell each device to proceed to the next stage
          emit(
            device,
            stage + '_' + test,
            JSON.stringify(nextStageData)
          );
        });
        nextStageData = [];
      }
    }

    // Add event handlers for each stage of a single test.
    // Test proceed in the order shown below.
    toComplete = devices.length;
    devices.forEach(function (device) {

      function setResult(result) {
        results[result.test] = result.success && (
          result.test in results ? results[result.test] : true
        );
      }

      // The device has completed setup for this test.
      device.socket.once('setup_complete', function (result) {
        var parsedResult = JSON.parse(result);
        setResult(parsedResult);
        doNext('start_test', {
          uuid: device.uuid,
          data: parsedResult.data
        });
      });

      // The device has completed it's test.
      device.socket.once('test_complete', function (result) {
        setResult(JSON.parse(result));
        doNext('teardown');
      });

      // The device has completed teardown for this test.
      device.socket.once('teardown_complete', function (result) {
        var parsedResult = JSON.parse(result);
        setResult(parsedResult);
        if (--toComplete === 0) {
          if (!results[parsedResult.test]) {
            self.logger.warn(
              'Failed on %s test: %s', platform, test
            );
          }
          cb();
        }
      });

      // All server-side handlers for this test are now installed, let's go.
      emit(device, 'setup_' + test);
    });
  }

  function nextTest() {
    tests.shift();
    if (tests.length) {
      process.nextTick(function () {
        doTest(tests[0], nextTest);
      });
    } else {
      self.finishRun(devices, platform, _tests, results);
    }
  }

  toComplete = devices.length;

  devices.forEach(function (device) {
    device.socket
    .once('schedule_complete', function () {
      if (--toComplete === 0) {
        doTest(tests[0], nextTest);
      }
    })
    .emit('schedule', JSON.stringify(tests));
  });
};
*/


/*
// Track which platforms we expect to be running on.
this.runningTests = Object.keys(this.platforms)
  .filter(function (platform) {
    var platformData = self.platforms[platform];
    self.logger.info(
      '%d devices is required for platform: \'%s\'',
      platformData.count, platform
    );
    return platformData.count;
  });
*/

/*
UnitTestFramework.prototype.finishRun = function (devices, platform, tests, results) {
  // All devices have completed all their tests.
  this.logger.info('Test run on %s complete', platform);

  // The whole point !! Log test results from the server.
  this.testReport(platform, tests, results);

  // Signal devices to quit.
  devices.forEach(function (device) {
    device.socket.emit('complete');
  });

  // We're done running for this platform.
  this.runningTests = this.runningTests.filter(function (p) {
    return p !== platform;
  });

  // There may be other platforms still running.
  if (this.runningTests.length === 0) {
    this.emit('completed');
  }
};
*/

/*
UnitTestFramework.prototype.testReport = function (platform, tests, results) {
  this.logger.info('\n\n-== UNIT TEST RESULTS ==-');

  var passed = 0;
  for (var test in results) {
    passed += results[test];
  }
  var failed = tests.length - passed;

  this.logger.info('PLATFORM: %s', platform);
  this.logger.info('RESULT: %s', passed === tests.length ? 'PASS' : 'FAIL');
  this.logger.info(
    '%d of %d tests completed',
    Object.keys(results).length, tests.length
  );
  this.logger.info(
    '%d/%d passed (%d failures)',
    passed, tests.length, failed
  );

  if (failed > 0) {
    this.logger.info('\n\n--- Failed tests ---');
    for (test in results) {
      if (!results[test]) {
        this.logger.warn(test + ' - fail');
      }
    }
  }

  this.logger.info('\n\n-== END ==-');
};
*/

module.exports = UnitTestFramework;
