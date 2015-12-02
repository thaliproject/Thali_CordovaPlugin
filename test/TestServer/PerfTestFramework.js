/**
 */

'use strict';

var fs = require('fs');
var inherits = require('util').inherits;
var TestFramework = require('./TestFramework');
var configFile = require('./Config_PerfTest.json');
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
  PerfTestFramework.super_.call(this, testConfig);
}

inherits(PerfTestFramework, TestFramework);

PerfTestFramework.prototype.startTests = function(platform, tests) {

  // Copy arrays..
  var _tests = tests.slice();
  var devices = this.devices[platform].slice();
  
  // Filter non-null bluetooth device addresses into array
  var btAddresses = devices.map(function(dev) {
    return dev.btAddress;
  }).filter(function(addr) {
    return (addr != null);
  });

  var toComplete;
  var self = this;

  var results = [];
  function doTest(test) {

    toComplete = devices.length;

    devices.forEach(function(device) {

      device.results = null;

      device.socket.once('test data', function (data) {

        device.results = JSON.parse(data);

        if (--toComplete == 0) {

          logger(platform + ' test ID ' + test + ' done now');

          devices.forEach(function(_device) {

            if (device.results == null) {
              console.log("No results from " + _device);
            } else {
              results.push({
                "test" : test,
                "device" : _device.deviceName,
                "time" : null,
                "data" : _device.results
              });
            }

            _device.socket.emit("stop");
          });

          tests.shift();
          if (tests.length) {
            process.nextTick(function() {
              console.log("Continuing to next test: " + tests[0]);
              doTest(tests[0]);
            });
          } else {
            console.log("ALL DONE !!!");
            var processedResults = ResultsProcessor.process(results, devices);
            console.log(processedResults);
            process.exit(0);
          }
        }
      });

      console.log("starting:" + test);
      var testData = configFile[test];
      console.log(testData);

      device.socket.emit(
        "start", 
        { testName: test, testData: testData, device: null, addressList: btAddresses }
      );
    });
  }

  doTest(tests[0]);
}

module.exports = PerfTestFramework;
