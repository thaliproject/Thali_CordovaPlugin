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

function PerfTestFramework(platform, count, honorCount, timeOutValueToStart) {
    this.timerId = null;
    this.os = platform;

    this.testResults = [];
    this.currentTest = -1;

    if (count <= 0) {
        // If framework was initialized without devices,
        // no need to do anything.
        return;
    }

    for (var i=0; i < configFile.tests.length; i++) {
        console.log('Test ID ' + i + ' configuration: ' + configFile.tests[i].name + ', server timeout: ' + configFile.tests[i].servertimeout + ", data:");
        console.log(configFile.tests[i].data);
    }

    if (honorCount) {
        logger(this.os + ' tests will start after ' + count + ' devices has connected');
    } else {
        logger(this.os + ' tests will start after waiting for ' + timeOutValueToStart / 1000 + ' seconds');
    }
}

inherits(PerfTestFramework, EventEmitter);

PerfTestFramework.prototype.getCount = function() {
    return this.getConnectedDevicesCount();
}

PerfTestFramework.prototype.addDevice = function(device) {

    var deviceName = device.getName();

    if(!this.testDevices) {
        this.testDevices = {};
    }

    //do we already have it added
    var previousItem = this.getDevice(deviceName);
    if(previousItem && previousItem != null){
        logger(this.os + ' ' + deviceName + ' got re-connected event');

        //need to replace the device to get new socket !!
        this.testDevices[deviceName] = device;
        // but we do need to keep old data
        this.testDevices[deviceName].data = previousItem.data;
        this.testDevices[deviceName].startTime = previousItem.startTime;
        this.testDevices[deviceName].endTime = previousItem.endTime;

        return true;
    }

    // The device was not added and we have already started,
    // thus this device is late.
    if (this.currentTest >= 0) {
        logger(this.os + ' ' + deviceName + ' not added anymore, because tests were already started');
        return false;
    }

    this.testDevices[deviceName] = device;
    logger(this.os + ' ' + deviceName + ' added (current device count ' + this.getConnectedDevicesCount() + ')');
    return true;
}

PerfTestFramework.prototype.isDeviceAlreadyAdded = function(name) {

    var previousItem = this.getDevice(name);
    if(previousItem && previousItem != null){
        return true;
    }

    return false;
}

PerfTestFramework.prototype.getDevice = function(name) {

    if (!this.testDevices) {
        return null;
    }

    return this.testDevices[name];
}

PerfTestFramework.prototype.startTest = function(json){

    //no devices were added
    if(!this.testDevices){
        return;
    }

    if(this.testDevices == null){
        return;
    }

    for (var deviceName in this.testDevices) {
        if(this.testDevices[deviceName] != null){
            this.testDevices[deviceName].start_tests(json);
        }
    }

    this.devicesCount = this.getConnectedDevicesCount();

    logger(this.os + ' start testing now with ' + this.devicesCount + ' devices');
    this.start =new Date();
    this.doNextTest();
}

PerfTestFramework.prototype.removeDevice = function(device) {
    if (this.testDevices && this.testDevices[device.deviceName]) {
        logger(this.os + ' ' + device.deviceName + ' got disconnected');
        // TODO: Right now, we are doing nothing when device disconnects, because
        // we expect that it might reconnect at some point. However, the disconnection
        // might also be due to the app on the device crashing in which case it
        // will never connect back. If that is the case that needs to be tackled here
        // we should probably remove the device from the test devices list.
    }
}

PerfTestFramework.prototype.ClientDataReceived = function(name,data) {
    if(!this.testDevices){
        return;
    }

    if(this.testDevices == null){
        return;
    }

    if(!this.testDevices[name] || this.testDevices[name] == null){
        return;
    }

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
    if(!this.testDevices){
        return 0;
    }

    if(this.testDevices == null){
        return 0;
    }
    var devicesFinishedCount = 0;

    for (var deviceName in this.testDevices) {
        if(this.testDevices[deviceName] != null && this.testDevices[deviceName].data != null){

            if(this.testDevices[deviceName].data.result != "DISCONNECTED") {
                devicesFinishedCount = devicesFinishedCount + 1;
            }
        }
    }

    return devicesFinishedCount;
}

PerfTestFramework.prototype.getConnectedDevicesCount  = function(){
    if(!this.testDevices){
        return 0;
    }

    if(this.testDevices == null){
        return 0;
    }
    var count = 0;
    for (var deviceName in this.testDevices) {
        if(this.testDevices[deviceName] != null){
            count++;
        }
    }

    return count;
}

PerfTestFramework.prototype.getBluetoothAddressList  = function(){
    if(!this.testDevices){
        return [];
    }

    if(this.testDevices == null){
        return [];
    }
    var BtAddressList = [];
    for (var deviceName in this.testDevices) {
        if(this.testDevices[deviceName] != null){
            var BtAddress = this.testDevices[deviceName].getBluetoothAddress();
            if(BtAddress) {
                BtAddressList.push({"address":BtAddress,"tryCount":0});
            }
        }
    }


    return BtAddressList;
}

PerfTestFramework.prototype.doNextTest  = function(){

    //no devices were added
    if(!this.testDevices){
        return;
    }

    if(this.testDevices == null){
        return;
    }

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
    if(!this.testDevices){
        return;
    }

    if(this.testDevices == null){
        return;
    }

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
