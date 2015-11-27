/**
 * Unit test framework used with thali-tape.
 */

'use strict';

var util = require('util');
var TestFramework = require('./TestFramework');

function UnitTestFramework(testConfig) {
  UnitTestFramework.super_.call(this, testConfig);
}

util.inherits(UnitTestFramework, TestFramework);

UnitTestFramework.prototype.startTests = function(platform, tests) {

  var toComplete;
  var results = {};

  // Copy arrays
  var _tests = tests.slice();
  var devices = this.devices[platform].slice();

  var self = this;
  function doTest(test, cb) {

    console.log("Running test: " + test);

    // Perform a single test
    function doNext(stage) {
      // We need to have seen all devices report in before we
      // can proceed to the next stage
      if (--toComplete == 0) {
        toComplete = devices.length;
        devices.forEach(function(device) {
          // Tell each device to proceed to the next stage
          device.socket.emit(stage, test);
        });
      }
    }

    // Add event handlers for each stage of a single test
    // Test proceed in the order shown below
    toComplete = devices.length;
    devices.forEach(function(device) {

      // The device has completed setup for this test
      device.socket.once("setup_complete", function(info) {
        doNext("start_test");
      });

      // The device has completed it's test
      device.socket.once("test_complete", function(result) {
        result = JSON.parse(result);
        if (!results[result.test])
          results[result.test] = result.success;
        else
          results[result.test] &= result.success;
        doNext('teardown');
      });

      // The device has completed teardown for this test
      device.socket.once("teardown_complete", function(info) {
        if (--toComplete == 0) {
          cb();
        }
      });

      // Start setup for this test
      device.socket.emit("setup", test);
    });
  }

  function nextTest() {
    // Pop the completed test off the list
    // and move to next test
    tests.shift();
    if (tests.length) {
      process.nextTick(function() {
        doTest(tests[0], nextTest);
      });
    } else {
      // ALL DONE !!
      console.log("Test run complete");
      self.testReport(_tests, results);
      process.exit(0);
    }
  }

  toComplete = devices.length;
  devices.forEach(function(device) {
    // Wait for devices to signal they've scheduled their
    // test runs and then begin
    device.socket.once("schedule_complete", function() {
      if (--toComplete == 0) {
        doTest(tests[0], nextTest);
      }
    });
    
    // Tell devices to set tests up to run in the order we supply
    device.socket.emit("schedule", JSON.stringify(tests));
  });
}

UnitTestFramework.prototype.testReport = function(tests, results) {

  console.log("\n\n-== UNIT TEST RESULTS ==-");

  var passed = 0;
  for (var test in results) {
    passed += results[test];
  }

  console.log("RESULT: %s", passed == tests.length ? "PASS" : "FAIL");
  console.log("%d of %d tests completed", Object.keys(results).length, tests.length);
  console.log("%d/%d passed (%d failures)", passed, tests.length, tests.length - passed);

  console.log("---\n\n");

  for (test in results) {
    console.log(test + " - " + (results[test] ? "pass" : "fail"));
  }

  console.log("-== END ==-");
}

module.exports = UnitTestFramework;
