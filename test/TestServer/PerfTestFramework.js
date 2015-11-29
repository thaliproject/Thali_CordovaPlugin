/**
 */

'use strict';

var fs = require('fs');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
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

  /*for (var i=0; i < configFile.tests.length; i++) {
    console.log('Test ID ' + i + ' configuration: ' + configFile.tests[i].name + ', server timeout: ' + configFile.tests[i].servertimeout + ", data:");
    console.log(configFile.tests[i].data);
  }*/
}

inherits(PerfTestFramework, EventEmitter);

PerfTestFramework.prototype.startTests = function(platform, tests) {
  // Copy arrays..
  var _tests = tests.slice();
  var devices = this.devices[platform].slice();
}

PerfTestFramework.prototype.ClientDataReceived = function(name,data) {

  var jsonData = JSON.parse(data);

  //save the time and the time we got the results
  this.testDevices[name].data = jsonData;
  this.testDevices[name].endTime = new Date();

  var responseTime = this.testDevices[name].endTime - this.testDevices[name].startTime;

  var peers = 0;
  if (jsonData.peersList && (jsonData.peersList.length > 0)) {
    peers = jsonData.peersList.length;
  }

  var connects = 0;
  if (jsonData.connectList && (jsonData.connectList.length > 0)) {
    connects =jsonData.connectList.length;
  }

  var sendData = 0;
  if (jsonData.sendList && (jsonData.sendList.length > 0)) {
    sendData =jsonData.sendList.length;
  }

  logger(this.os + ' ' + name + ' test took ' + responseTime + 'ms - results peers[' + peers+ '], reConnects[' + connects + '], sendData[' + sendData+ ']');

  if (this.getFinishedDevicesCount() == this.devicesCount) {
    logger(this.os + ' test ID ' + this.currentTest + ' done now');
    this.testFinished();
  }
}

PerfTestFramework.prototype.getFinishedDevicesCount  = function(){

  var devicesFinishedCount = 0;

  for (var deviceName in this.testDevices) {
    if (this.testDevices[deviceName] != null && this.testDevices[deviceName].data != null){

      if (this.testDevices[deviceName].data.result != "DISCONNECTED") {
        devicesFinishedCount = devicesFinishedCount + 1;
      }
    }
  }

  return devicesFinishedCount;
}

PerfTestFramework.prototype.getBluetoothAddressList = function() {

  var btAddressList = [];
  for (var deviceName in this.testDevices) {
    if (this.testDevices[deviceName] != null) {
      var BtAddress = this.testDevices[deviceName].getBluetoothAddress();
      if (BtAddress) {
        BtAddressList.push({"address":BtAddress,"tryCount":0});
      }
    }
  }

  return BtAddressList;
}

PerfTestFramework.prototype.doNextTest  = function() {

    var self = this;
    if(this.timerId != null) {
        clearTimeout(this.timerId);
        this.timerId = null;
    }

    this.currentTest++;
    if(configFile.tests[this.currentTest]){
        this.doneAlready = false;

        var BluetoothList = this.getBluetoothAddressList();

        // If we have tests, then lets start new tests on all devices
        for (var deviceName in this.testDevices) {
            if(this.testDevices[deviceName] != null){
                this.testDevices[deviceName].startTime = new Date();
                this.testDevices[deviceName].endTime = new Date();
                this.testDevices[deviceName].data = null;
                this.testDevices[deviceName].SendCommand('start',configFile.tests[this.currentTest].name,JSON.stringify(configFile.tests[this.currentTest].data),(this.devicesCount - 1),BluetoothList);
           }
        }

        if(configFile.tests[this.currentTest].servertimeout) {
                this.timerId = setTimeout(function() {
                    logger('Server timeout reached!');
                    if(!self.doneAlready)
                    {
                        for (var deviceName in self.testDevices) {
                            if (self.testDevices[deviceName] != null && self.testDevices[deviceName].data == null) {
                                logger('Send timeout to ' + self.testDevices[deviceName].getName());
                                self.testDevices[deviceName].SendCommand('timeout',"","","");
                            }
                        }
                        // Above, we were sending the timeout command to all connected devices.
                        // Below, we are having a timer that waits for certain amount of time
                        // for devices to send their test report, but if that doesn't happen within
                        // the time set below, we are forcing the tests to finished.
                        // This is so that in CI, we get to print the result summary before the CI
                        // timeouts are hit.
                        var timeToWaitForReports = 60000; // 1 minute
                        self.timerId = setTimeout(function() {
                            if (!self.doneAlready) {
                                logger('Did not get reports from all devices, but forcing tests to finish!');
                                self.testFinished();
                            }
                        }, timeToWaitForReports);
                    }
                }, configFile.tests[this.currentTest].servertimeout);

        }
        return;
    }

    logger(this.os + ' All tests are done, preparing test report');
    var processedResults = ResultsProcessor.process(this.testResults, this.testDevices);

    for (var deviceName in this.testDevices) {
        if(this.testDevices[deviceName] != null){
            //if really needed, we could send the whole test data back with this command, and do the whole logging in the client side as well
            this.testDevices[deviceName].SendCommand('end','results',JSON.stringify({"result":processedResults[deviceName]}),this.devicesCount);
        }
    }
};

PerfTestFramework.prototype.testFinished = function () {

    this.doneAlready = true;
    for (var deviceName in this.testDevices) {
        if (this.testDevices[deviceName] != null) {
            if(this.testDevices[deviceName].data == null){
                // This is an error scenario, because devices should report
                // their results at the end of tests.
                this.testDevices[deviceName].SendCommand('end', "", "", "");
                this.testDevices[deviceName] = null;
                this.devicesCount = this.getConnectedDevicesCount();
                console.log(deviceName + ' did not have results at the end of tests - check the device logs about why!!');
            }else {
                var responseTime = this.testDevices[deviceName].endTime - this.testDevices[deviceName].startTime;
                this.testResults.push({
                    "test": this.currentTest,
                    "device": deviceName,
                    "time": responseTime,
                    "data": this.testDevices[deviceName].data
                });

                //lets finalize the test by stopping it.
                this.testDevices[deviceName].SendCommand('stop', "", "", "");

                //reset values for next testing round
                this.testDevices[deviceName].startTime = new Date();
                this.testDevices[deviceName].endTime = new Date();
                this.testDevices[deviceName].data = null;
            }
        }
    }

    this.doNextTest()
}

module.exports = PerfTestFramework;
