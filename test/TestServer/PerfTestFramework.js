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

  // The accumulate set of results
  this.results = [];

  // The platfoms we can have concurrently running the test set
  this.platforms = {};
}

inherits(PerfTestFramework, TestFramework);

PerfTestFramework.prototype.addDevice = function(device) {

  PerfTestFramework.super_.prototype.addDevice.call(this, device);

  var platform = device.platform;

  // Create some state for the new platform
  if (!(platform in this.platforms)) {
    this.platforms[platform] = {
      state:"waiting",
      startTimeout:null
    };
  }

  // Start a timer on first device discovery that will start tests regardless of 
  // number found if honorCount is false

  if (this.devices[platform].length == 1) {

    if (!this.testConfig.honorCount) {

      var self = this;

      logger.info(
        "Setting start timeout to: %d (%s)", 
        this.perfTestConfig.userConfig[platform].startTimeout, platform
      );

      this.platforms[platform].startTimeout = setTimeout(function () {
        logger.info("Start timeout elapsed for platform: %s", platform);
        self.startTests(platform);
      }, this.perfTestConfig.userConfig[platform].startTimeout);
    }
  }
}

PerfTestFramework.prototype.completeTest = function(test, platform, devices) {

  logger.info("All test data retrieved for %s (%s)", test, platform);

  var self = this;

  // Collate the results..
  devices.forEach(function(device) {

    if (device.results == null) {
      logger.info("No results from " + device);
    } else {
      self.results.push({
        "test" : test,
        "device" : device.deviceName,
        "time" : null,
        "data" : device.results
      });
    }

    // Let the completed device know it can tear down the current test
    device.socket.emit("teardown");
  });

  // Check if we're done
  this.testsToRun.shift();
  if (!this.testsToRun.length) {

    // All tests are complete, generate the result report
    logger.info("ALL DONE !!!");

    // Cancel the startTimeout
    clearTimeout(this.platforms[platform].startTimeout);

    var processedResults = ResultsProcessor.process(this.results, devices);
    logger.info(processedResults);

    // Let the devices know we're completely finished
    var acksReceived = devices.length;
    devices.forEach(function(device) {

      // Send 'end' and wait for 'end_ack'

      device.socket.once("end_ack", function() {
        if (--acksReceived == 0) {

          // Record we've completed this platform's run
          self.platforms[platform].state = "completed";

          // Are all platforms now complete ?
          var completed = true;
          for (var p in self.platforms) {
            logger.debug("state: %s %s", p, self.platforms[p].state);
            if (self.platforms[p].state != "completed") {
              completed = false;
            }
          }

          if (completed) {
            logger.info("Server terminating normally");
            process.exit(0);
          }
        }
      });

      logger.debug("end to %s", device.deviceName);
      device.socket.emit("end", device.deviceName);
    }); 
  }
}

PerfTestFramework.prototype.startTests = function(platform, tests) {

  if (platform in this.platforms && this.platforms[platform].state != "waiting") {
    logger.info("Tests for %s already running or completed", platform);
    return;
  }

  if (!tests) {
    // Default to all tests listed in config
    tests = this.perfTestConfig.testConfig.map(function(testConfig) {
      return testConfig.name;
    });
  }
 
  // Copy arrays..
  this.testsToRun = tests.slice();
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
  this.platforms[platform].state = "running";

  var results = [];
  function doTest(test) {

    toComplete = devices.length;
    logger.info("Setting: (%s)", platform, toComplete);

    // Set up the test parameters
    var testData = self.perfTestConfig.testConfig.filter(function(testConfig) {
      return (testConfig.name == test);
    });
    if (testData.length != 1) {
      throw new Error("Missing or duplicate config for test %s", test); 
    }
    testData = testData[0];
    testData.peerCount = toComplete;
    logger.debug(testData);

    var nextTest = function() {
      // When all devices have given us a result, complete the current test
      self.completeTest(test, platform, devices);
      
      if (self.testsToRun.length) {
        process.nextTick(function() {
          logger.info("Continuing to next test: " + self.testsToRun[0]);
          doTest(self.testsToRun[0]);
        });
      }
    }

    var serverTimeout = null;
    if (testData.serverTimeout) {
      serverTimeout = setTimeout(function() {
        logger.info("server timeout for test: %s (%s)", test, platform);
        nextTest();
      }, testData.serverTimeout);
    }

    devices.forEach(function(device) {

      // Reset test results for this device
      device.results = null;

      device.socket.once('test data', function (data) {

        logger.info(
          "Received results for %s %s %s (%d left)", 
          data, device.deviceName, platform, toComplete
        );

        // Cache results in the device object
        device.results = JSON.parse(data);

        // Cancel server timeout for this device
        if (device.serverTimeoutTimer != null) {
          clearTimeout(device.serverTimeoutTimer);
          device.serverTimeoutTimer = null;
        }

        if (--toComplete == 0) {
          nextTest();
        }
      });

      // Set a timeout that will move to next test
      // regardless of whether all results are in

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
