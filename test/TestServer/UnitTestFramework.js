/**
 * Unit test framework used with thaliTape.
 */

'use strict';

var util = require('util');
var TestFramework = require('./TestFramework');

var logger = console;

function UnitTestFramework(testConfig, _logger)
{
  if (_logger) {
    logger = _logger;
  }

  var configFile = './UnitTestConfig';
  var unitTestConfig = require(configFile);
  if (testConfig.userConfig) {
    unitTestConfig = testConfig.userConfig;
  }

  UnitTestFramework.super_.call(this, testConfig, unitTestConfig, _logger);

  // Track which platforms we expect to be running on
  var self = this;
  self.runningTests = Object.keys(self.requiredDevices).filter(
    function (platform) {
      logger.info(
        'Require %d %s devices',
        self.requiredDevices[platform] || 0, platform
      );
      return self.requiredDevices[platform];
    }
  );
}

util.inherits(UnitTestFramework, TestFramework);

UnitTestFramework.prototype.abortRun =
  function (devices, platform, tests, results) {
    // Tests on all devices are aborted
    logger.info('Test run on %s aborted', platform);

    this.finalizeRun(devices, platform, tests, results, 'aborted');
  };

UnitTestFramework.prototype.finishRun =
  function (devices, platform, tests, results) {
    // All devices have completed all their tests
    logger.info('Test run on %s complete', platform);

    this.finalizeRun(devices, platform, tests, results, 'complete');
  };

UnitTestFramework.prototype.finalizeRun =
  function (devices, platform, tests, results, finalizeMessage) {

    // Log test results from the server
    this.testReport(platform, tests, results);

    // Signal devices to quit
    devices.forEach(function (device) {
      device.socket.emit(finalizeMessage);
    });

    // We're done running for this platform..
    this.runningTests = this.runningTests.filter(function (p) {
      return p !== platform;
    });

    // There may be other platforms still running
    if (this.runningTests.length === 0) {
      this.emit('completed');
    }
  };

UnitTestFramework.prototype.startTests = function (platform, tests) {

  var toComplete;
  var results = {};

  if (!tests) {
    if (this.devices[platform].length) {
      // Default to all tests named by first device
      tests = this.devices[platform][0].tests;
    } else {
      tests = [];
    }
  }

  // Copy arrays
  var _tests = tests.slice();
  var devices = this.devices[platform].slice();

  if (devices.length < 2) {
    logger.warn(
      'Aborting unit test run for %s. At least 2 devices needed, having %d device(s)',
      platform, this.devices[platform].length
    );
    this.abortRun(devices, platform, tests, results);
    return;
  }

  logger.info(
    'Starting unit test run on %d %s devices',
    this.devices[platform].length, platform
  );

  var self = this;
  function doTest(test, cb) {

    logger.info('Running on %s test: %s', platform, test);

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

      // Emit message every second until acknowledged
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
            logger.debug('Too many emit retries to device: %s',
              device.deviceName);
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

    // Add event handlers for each stage of a single test
    // Test proceed in the order shown below
    toComplete = devices.length;
    devices.forEach(function (device) {

      function setResult(result) {
        results[result.test] = result.success &&
          (result.test in results ? results[result.test] :
            true);
      }

      // The device has completed setup for this test
      device.socket.once('setup_complete', function (result) {
        var parsedResult = JSON.parse(result);
        setResult(parsedResult);
        doNext('start_test', {
          uuid: device.uuid,
          data: parsedResult.data
        });
      });

      // The device has completed it's test
      device.socket.once('test_complete', function (result) {
        setResult(JSON.parse(result));
        doNext('teardown');
      });

      // The device has completed teardown for this test
      device.socket.once('teardown_complete', function (result) {
        var parsedResult = JSON.parse(result);
        setResult(parsedResult);
        if (--toComplete === 0) {
          if (!results[parsedResult.test]) {
            logger.warn(
              'Failed on %s test: %s', platform, test
            );
          }
          cb();
        }
      });

      // All server-side handlers for this test are now installed, let's go..
      emit(device, 'setup_' + test);
    });
  }

  function nextTest() {
    // Pop the completed test off the list
    // and move to next test
    tests.shift();
    if (tests.length) {
      process.nextTick(function () {
        doTest(tests[0], nextTest);
      });
    } else {
      // ALL DONE !!
      self.finishRun(devices, platform, _tests, results);
    }
  }

  toComplete = devices.length;

  devices.forEach(function (device) {
    // Wait for devices to signal they've scheduled their
    // test runs and then begin
    device.socket.once('schedule_complete', function () {
      if (tests.length) {
        if (--toComplete === 0) {
          doTest(tests[0], nextTest);
        }
      } else {
        logger.warn('Schedule complete with no tests to run');
        self.finishRun(devices, platform, _tests, results);
      }
    });

    // Tell devices to set tests up to run in the order we supply
    device.socket.emit('schedule', JSON.stringify(tests));
  });
};

UnitTestFramework.prototype.testReport = function (platform, tests, results) {

  logger.info('\n\n-== UNIT TEST RESULTS ==-');

  var passed = 0;
  for (var test in results) {
    passed += results[test];
  }
  var failed = tests.length - passed;

  logger.info('PLATFORM: %s', platform);
  logger.info('RESULT: %s', passed === tests.length ? 'PASS' : 'FAIL');
  logger.info('%d of %d tests completed',
    Object.keys(results).length, tests.length);
  logger.info('%d/%d passed (%d failures)',
    passed, tests.length, failed);

  if (failed > 0) {
    logger.info('\n\n--- Failed tests ---');
    for (test in results) {
      if (!results[test]) {
        logger.warn(test + ' - fail');
      }
    }
  }

  logger.info('\n\n-== END ==-');
};

module.exports = UnitTestFramework;
