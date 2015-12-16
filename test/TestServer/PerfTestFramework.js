/**
 */

'use strict';

var fs = require('fs');
var inherits = require('util').inherits;
var TestFramework = require('./TestFramework');
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

var logger = console;

function PerfTestFramework(testConfig, _logger) {

  if (_logger) {
    logger =_logger;
  }

  var configFile = "./PerfTestConfig";
  if (testConfig.configFile) {
    configFile = testConfig.configFile;
  }
  this.perfTestConfig = require(configFile);
 
  PerfTestFramework.super_.call(this, testConfig, this.perfTestConfig.userConfig, _logger);

  this.platforms = [];
  this.runningTests = [];
  this.completedTests = [];

  this.startTimeouts = {};
}

inherits(PerfTestFramework, TestFramework);

PerfTestFramework.prototype.addDevice = function(device) {

  PerfTestFramework.super_.prototype.addDevice.call(this, device);

  var platform = device.platform;
  if (this.devices[platform].length == 1) {

    // Start a timer on first device discovery that will start tests regardless of 
    // number found if honorCount is false

    if (!this.testConfig.honorCount) {

      var self = this;

      logger.info(
        "Setting start timeout to: %d (%s)", 
        this.perfTestConfig.userConfig[platform].startTimeout, platform
      );

      this.startTimeouts[platform] = setTimeout(function () {
        logger.info("Start timeout elapsed for platform: %s", platform);
        self.startTests(platform);
      }, this.perfTestConfig.userConfig[platform].startTimeout);
    }
  }
}

PerfTestFramework.prototype.startTests = function(platform, tests) {

  if (this.runningTests.indexOf(platform) != -1 || this.completedTests.indexOf(platform) != -1) {
    logger.info("Tests for %s already running or completed", platform);
    return;
  }

  if (!tests) {
    // Default to all tests on first device
    tests = this.devices[platform][0].tests;
  }
  
  // Copy arrays..
  var testsToRun = tests.slice();
  var devices = this.devices[platform].slice();
  
  logger.info("Starting perf test run for platform: %s", platform);
  logger.info("Using devices:");
  devices.forEach(function(dev) {
    logger.info(dev.deviceName);
  });

  // Filter non-null bluetooth device addresses into array
  var btAddresses = devices.map(function(dev) {
    return dev.btAddress;
  }).filter(function(addr) {
    return (addr != null);
  });

  var toComplete;
  var self = this;
  
  // Record that we're running tests for this platform
  this.runningTests.push(platform);

  var results = [];
  function doTest(test) {

    toComplete = devices.length;
    logger.info("Setting: (%s)", platform, toComplete);

    // Set up the test parameters
    var testData = self.perfTestConfig.testConfig[test];
    testData.peerCount = toComplete;

    devices.forEach(function(device) {

      device.results = null;

      device.socket.once('test data', function (data) {

        logger.info(
          "Received results for %s %s (%d left)", 
          device.deviceName, platform, toComplete
        );

        // Cache results in the device object
        device.results = JSON.parse(data);

        // Cancel server timeout for this device
        if (device.serverTimeoutTimer != null) {
          clearTimeout(device.serverTimeoutTimer);
          device.serverTimeoutTimer = null;
        }

        if (--toComplete == 0) {

          logger.info("All test data retrieved for %s (%s)", test, device.platform);

          devices.forEach(function(_device) {

            if (device.results == null) {
              logger.info("No results from " + _device);
            } else {
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

          testsToRun.shift();
          if (testsToRun.length) {
            // Start the next test if any
            process.nextTick(function() {
              logger.info("Continuing to next test: " + testsToRun[0]);
              doTest(testsToRun[0]);
            });
          } else {
            // All tests are complete, generate the result report
            logger.info("ALL DONE !!!");

            // Cancel the startTimeout
            clearTimeout(self.startTimeouts[platform]);

            var processedResults = ResultsProcessor.process(results, devices);
            logger.info(processedResults);

            // Let the devices know we're completely finished
            toComplete = devices.length;
            devices.forEach(function(_device) {
              _device.socket.once("end_ack", function() {
                if (--toComplete == 0) {
                  
                  // Record we've completed this platform's run
                  self.completedTests.push(platform);

                  // Remove the platform from our set of running tests
                  self.runningTests = self.runningTests.filter(function(p) {
                    return (p != platform);
                  });

                  if (self.runningTests.length == 0) {
                    // We assume all tests runs are started before the first
                    // run finishes. If that's not the case there's not really
                    // any safe place we can exit.
                    logger.info("Server terminating normally");
                    process.exit(0);
                  }
                }
              });
              _device.socket.emit("end", _device.deviceName);
            }); 
          }
        }
      });

      // Set a timeout, forces the device to send any data it has and teardown
      if (testData.serverTimeout) {
        device.serverTimeoutTimer = setTimeout(function() {
          logger.info("server timeout for test: %s (%s)", test, device.platform);
          device.socket.emit("timeout");
          device.serverTimeoutTimer = null;
        }, testData.serverTimeout);
      }

      // Begin the test..
      device.socket.emit(
        "start", 
        { testName: test, testData: testData, addressList: btAddresses }
      );
    });
  }

  doTest(tests[0]);
}

module.exports = PerfTestFramework;
