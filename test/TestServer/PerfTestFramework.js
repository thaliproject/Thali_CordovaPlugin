/**
 */

'use strict';

var fs = require('fs');
var inherits = require('util').inherits;
var TestFramework = require('./TestFramework');
var perfTestConfig = require('./PerfTestConfig');
var ResultsProcessor = require('./ResultsProcessor.js');

/*
 {
 "name": "performance tests",
 "description": "basic performance tests for Thali apps framework",
 "tests": [
 {"name": "testFindPeers.js", "servertimeout": "30000","data": {"timeout": "20000"}},
 {"name": "testReConnect.js", "servertimeout": "700000","data": {"timeout": "600000","rounds":"1","dataTimeout":"5000","conReTryTimeout":"2000","conReTryCount":"1"}},
 {"name": "testSendData.js", "servertimeout": "7000000","data": {"timeout": "6000000","rounds":"1","dataAmount":"1000000","dataTimeout":"5000","conReTryTimeout":"2000","conReTryCount":"5"}},

 ]
 }

  Test item in the array includes the tests file name and:
  - timeout: defines timeout value which after the coordinator server will cancel the test
  - data: is data that gets sent to the clients devices, and defines what they need to do

   additionally with  re-Connect test data
   - rounds defines how many rounds of connection established needs to be performed for each peers (use 1 for now)
   - dataTimeout defines timeout which after data sent is determined to be lost, and the connection is disconnected (and reconnected, data send starts from the point we know we managed to deliver to other side)
   - conReTryTimeout defines timeout value used between disconnection (by error) and re-connection
   - conReTryCount defined on how many times we re-try establishing connections before we give up.

   also additionally with  send-data test data
   - dataAmount defines the amount of data sent through each connection before disconnecting
 */

var startTime = new Date().getTime();
var getSecondsFromStart = function () {
    return Math.round((new Date().getTime() - startTime) / 1000);
};

var logger = function (value) {
  console.log(new Date().toJSON() + ' (' + getSecondsFromStart() + ' sec) - ' + value);
};

function PerfTestFramework(testConfig) {
  PerfTestFramework.super_.call(this, testConfig, perfTestConfig.userConfig);
  this.runningTests = [];
}

inherits(PerfTestFramework, TestFramework);

PerfTestFramework.prototype.addDevice = function(device) {

  PerfTestFramework.super_.prototype.addDevice.call(this, device);

  if (!this.testsRunning && this.devices[device.platform].length == 1) {

    // Start a timer on first device discovery that will start tests regardless of 
    // number found if honorCount is false

    if (!this.testConfig.honorCount) {

      var self = this;

      setTimeout(function () {
        if (!self.testsRunning) {
          console.log("-------- Starting perf test (after timeout) --------");
          self.startTests('ios');
          self.startTests('android');
        }
      }, 120000);
    }
  }
}

PerfTestFramework.prototype.startTests = function(platform, tests) {

  if (!tests) {
    // Default to all tests on first device
    tests = this.devices[platform][0].tests;
  }

  // Copy arrays..
  var _tests = tests.slice();
  var devices = this.devices[platform].slice();
  
  console.log("Starting perf test run for platform: %s", platform);
  console.log("Using devices:");
  devices.forEach(function(dev) {
    console.log(dev.deviceName);
  });

  // Filter non-null bluetooth device addresses into array
  var btAddresses = devices.map(function(dev) {
    return dev.btAddress;
  }).filter(function(addr) {
    return (addr != null);
  });

  var toComplete;
  var self = this;
  var serverTimeoutTimer = null;
  
  // Record that we're running tests for this platform
  this.runningTests.push(platform);

  var results = [];
  function doTest(test) {

    toComplete = devices.length;

    // Set up the test parameters
    var testData = perfTestConfig.testConfig[test];
    testData.peerCount = toComplete;

    devices.forEach(function(device) {

      device.results = null;

      device.socket.once('test data', function (data) {

        // Cache results in the device object
        device.results = JSON.parse(data);

        // Cancel server timeout
        if (serverTimeoutTimer != null) {
          clearTimeout(serverTimeoutTimer);
          serverTimeoutTimer = null;
        }

        if (--toComplete == 0) {

          // When all devices have completed, collate results
          logger(platform + ' test ID ' + test + ' done now');

          devices.forEach(function(_device) {

            if (device.results == null) {
              console.log("No results from " + _device);
            } else {
              console.log("%s (%s) results from: %s", test, platform, _device.name);
              results.push({
                "test" : test,
                "device" : _device.deviceName,
                "time" : null,
                "data" : _device.results
              });
            }

            // Let the completed device know it can tear down the current test
            _device.socket.emit("teardown");
          });

          tests.shift();
          if (tests.length) {
            // Start the next test if any
            process.nextTick(function() {
              console.log("Continuing to next test: " + tests[0]);
              doTest(tests[0]);
            });
          } else {
            // All tests are complete, generate the result report
            console.log("ALL DONE !!!");
            var processedResults = ResultsProcessor.process(results, devices);
            console.log(processedResults);

            // Let the devices know we're completely finished
            toComplete = devices.length;
            devices.forEach(function(_device) {
              _device.socket.once("end_ack", function() {
                if (--toComplete == 0) {
                  // Remove the platform from our set of running tests
                  self.runningTests = self.runningTests.filter(function(p) {
                    return (p != platform);
                  });
                  if (self.runningTests.length == 0) {
                    // We assume all tests runs are started before the first
                    // run finishes. If that's not the case there's not really
                    // any safe place we can exit.
                    process.exit(0);
                  }
                }
              });
              _device.socket.emit("end");
            }); 
          }
        }
      });

      // Begin the test..
      device.socket.emit(
        "start", 
        { testName: test, testData: testData, addressList: btAddresses }
      );

      // Set a timeout, forces the test to send any data it has
      // and shut down
      if (testData.serverTimeout) {
        serverTimeoutTimer = setTimeout(function() {
          console.log("server timeout for test: %s", test);
          device.socket.emit("timeout");
          serverTimeoutTimer = null;
        }, testData.serverTimeout);
      }
    });
  }

  doTest(tests[0]);
}

module.exports = PerfTestFramework;
