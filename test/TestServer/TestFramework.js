/**
 * Created by juksilve on 1.9.2015.
 */

'use strict';

var events = require('events');
var TestDevice = require('./TestDevice');
var configFile = require('./config.json');

/*
 {
 "name": "performance tests",
 "description": "basic performance tests for Thali apps framework",
 "startDeviceCount": "4",
 "tests": [
 {"name": "testFindPeers.js", "timeout": "30000","data": {"count": "3","timeout": "20000"}},
 {"name": "testReConnect.js", "timeout": "700000","data": {"count": "3","timeout": "600000","rounds":"6","dataTimeout":"5000","conReTryTimeout":"2000","conReTryCount":"10"}},
 {"name": "testSendData.js", "timeout": "7000000","data": {"count": "3","timeout": "6000000","rounds":"3","dataAmount":"1000000","dataTimeout":"5000","conReTryTimeout":"2000","conReTryCount":"10"}},
 {"name": "testThaliNativeLayer.js", "timeout": "600000","data": {"timeout": "500000"}},
 {"name": "testThaliEmitter.js", "timeout": "600000","data": {"timeout": "500000"}}

 ]
 }
 */



function TestFramework() {
    this.timerId = null;
    this.testDevices = {};
    this.testResults = [];
    this.currentTest = -1;

    console.log('Start test : ' + configFile.name + ", start tests with " + configFile.startDeviceCount + " devices");

    for(var i=0; i < configFile.tests.length; i++) {
        console.log('Test[' + i + ']: ' + configFile.tests[i].name + ', timeout : ' + configFile.tests[i].timeout + ", data : " + JSON.stringify(configFile.tests[i].data));
    }
}

TestFramework.prototype = new events.EventEmitter;

TestFramework.prototype.addDevice = function(device){

    if(this.currentTest >= 0){
        console.log('test progressing ' + device.getName() + ' not added to tests');
        return;
    }

    this.testDevices[device.getName()] = device;
    console.log(device.getName() + ' added!');

    if(this.getConnectedDevicesCount() == configFile.startDeviceCount){
        console.log('----- start testing now -----');
        this.doNextTest();
    }
}

TestFramework.prototype.removeDevice = function(name){
    console.log(name + ' id now disconnected!');
    if(this.currentTest >= 0){
        if(this.testDevices[name]){
            console.log('test for ' + name + ' cancelled');
            this.ClientDataReceived(name,JSON.stringify({"result":"DISCONNECTED"}));
        }else {
            console.log('test progressing ' + name + ' is not removed from the list');
        }
        return;
    }

    //mark it removed from te list
    this.testDevices[name] = null;
}

TestFramework.prototype.ClientDataReceived = function(name,data){
    var jsonData = JSON.parse(data);

    //save the time and the time we got the results
    this.testDevices[name].data = jsonData;
    this.testDevices[name].endTime = new Date();

    var responseTime = this.testDevices[name].endTime - this.testDevices[name].startTime;
    console.log('with ' + name + ' request took : ' + responseTime + " ms.");

    if(this.getFinishedDevicesCount() == configFile.startDeviceCount){
        console.log('test[ ' + this.currentTest + '] done now.');
        this.testFinished();
    }
}

TestFramework.prototype.getFinishedDevicesCount  = function(){
    var devicesFinishedCount = 0;
    for (var deviceName in this.testDevices) {
        if(this.testDevices[deviceName] != null && this.testDevices[deviceName].data != null){
            devicesFinishedCount = devicesFinishedCount + 1;
        }
    }

    return devicesFinishedCount;
}

TestFramework.prototype.getConnectedDevicesCount  = function(){
    var count = 0;
    for (var deviceName in this.testDevices) {
        if(this.testDevices[deviceName] != null){
            count++;
        }
    }

    return count;
}
TestFramework.prototype.doNextTest  = function(){
    var self = this;
    if(this.timerId != null) {
        clearTimeout(this.timerId);
        this.timerId = null;
    }

    this.currentTest++;
    if(configFile.tests[this.currentTest]){
        //if we have tests, then lets start new tests on all devices
        console.log('start test[' + this.currentTest + ']');
        for (var deviceName in this.testDevices) {
            if(this.testDevices[deviceName] != null){
                this.testDevices[deviceName].startTime = new Date();
                this.testDevices[deviceName].endTime = new Date();
                this.testDevices[deviceName].data = null;
                this.testDevices[deviceName].SendCommand('start',configFile.tests[this.currentTest].name,JSON.stringify(configFile.tests[this.currentTest].data));
           }
        }

        if(configFile.tests[this.currentTest].timeout) {
                this.timerId = setTimeout(function() {
                    console.log('timeout now');
                    if(!self.doneAlready)
                    {
                        console.log('TIMEOUT');
                        self.testFinished();
                    }
                }, configFile.tests[this.currentTest].timeout);

        }
        return;
    }

    console.log('All tests are done, preparing test report.');
    var results = {};
    var combined ={};
    for (var i=0; i < this.testResults.length; i++) {

        if(this.testResults[i].data) {
            if (!results[this.testResults[i].device]) {
                results[this.testResults[i].device] = {};
            }

            if (this.testResults[i].data.peersList) {
                results[this.testResults[i].device].peersList = this.extendArray(this.testResults[i].data.peersList, results[this.testResults[i].device].peersList);

            } else if (this.testResults[i].data.connectList) {
                results[this.testResults[i].device].connectList = this.extendArray(this.testResults[i].data.connectList, results[this.testResults[i].device].connectList);

            } else if (this.testResults[i].data.sendList) {
                results[this.testResults[i].device].sendList = this.extendArray(this.testResults[i].data.sendList, results[this.testResults[i].device].sendList);

            } else {
                console.log('Test[' + this.testResults[i].test + '] for ' + this.testResults[i].device + ' has unknown data : ' + JSON.stringify(this.testResults[i].data));
            }
        }
    }

    console.log('--------------- test report ---------------------');

    for( var devName in results){
        console.log('--------------- ' + devName + ' ---------------------');

        if(results[devName].peersList && (results[devName].peersList.length > 0)) {

            results[devName].peersList.sort(this.compare);
            console.log(devName + ' has ' + results[devName].peersList.length + ' peersList result, range ' + results[devName].peersList[0].time + ' ms  to  '  + results[devName].peersList[(results[devName].peersList.length - 1)].time + " ms.");
            console.log("100% : " + this.getValueOf(results[devName].peersList,1.00) + " ms, 99% : " + this.getValueOf(results[devName].peersList,0.90)  + " ms, 95 %: " + this.getValueOf(results[devName].peersList,0.95)  + " ms, 90% : " + this.getValueOf(results[devName].peersList,0.90) + " ms.");
            combined.peersList = this.extendArray(results[devName].peersList,combined.peersList);
        }

        if(results[devName].connectList && (results[devName].connectList.length > 0)) {
            results[devName].connectList.sort(this.compare);
            console.log(devName + ' has ' + results[devName].connectList.length + ' connectList result , range ' + results[devName].connectList[0].time + ' ms to  '  + results[devName].connectList[(results[devName].connectList.length - 1)].time + " ms.");
            console.log("100% : " + this.getValueOf(results[devName].connectList,1.00) + " ms, 99% : " + this.getValueOf(results[devName].connectList,0.99)  + " ms, 95% : " + this.getValueOf(results[devName].connectList,0.95)  + " ms, 90% : " + this.getValueOf(results[devName].connectList,0.90) + " ms.");
            combined.connectList = this.extendArray(results[devName].connectList,combined.connectList);
        }

        if(results[devName].sendList && (results[devName].sendList.length > 0)) {
            results[devName].sendList.sort(this.compare);
            console.log(devName + ' has ' + results[devName].sendList.length + ' sendList result , range ' + results[devName].sendList[0].time + ' ms to  '  + results[devName].sendList[(results[devName].sendList.length - 1)].time + " ms.");
            console.log("100% : " + this.getValueOf(results[devName].sendList,1.00) + " ms, 99% : " + this.getValueOf(results[devName].sendList,0.99)  + " ms, 95 : " + this.getValueOf(results[devName].sendList,0.95)  + " ms, 90% : " + this.getValueOf(results[devName].sendList,0.90) + " ms.");
            combined.sendList = this.extendArray(results[devName].sendList,combined.sendList);
        }
    }

    console.log('--------------- Combined ---------------------');

    if(combined.peersList){
        combined.peersList.sort(this.compare);
        console.log("peersList : 100% : " + this.getValueOf(combined.peersList,1.00) + " ms, 99% : " + this.getValueOf(combined.peersList,0.99)  + " ms, 95 : " + this.getValueOf(combined.peersList,0.95)  + " ms, 90% : " + this.getValueOf(combined.peersList,0.90) + " ms.");
    }

    if(combined.connectList){
        combined.connectList.sort(this.compare);
        console.log("connectList : 100% : " + this.getValueOf(combined.connectList,1.00) + " ms, 99% : " + this.getValueOf(combined.connectList,0.99)  + " ms, 95 : " + this.getValueOf(combined.connectList,0.95)  + " ms, 90% : " + this.getValueOf(combined.connectList,0.90) + " ms.");
    }

    if(combined.sendList){
        combined.sendList.sort(this.compare);
        console.log("sendList : 100% : " + this.getValueOf(combined.sendList,1.00) + " ms, 99% : " + this.getValueOf(combined.sendList,0.99)  + " ms, 95 : " + this.getValueOf(combined.sendList,0.95)  + " ms, 90% : " + this.getValueOf(combined.sendList,0.90) + " ms.");
    }

    console.log('--------------- end of test report ---------------------');
}

TestFramework.prototype.getValueOf  = function(array, presentage) {
    var index = Math.round(array.length * presentage);
    if(index > 0){
        index = index - 1;
    }
    if(index < array.length) {
        return array[index].time;
    }
}

TestFramework.prototype.extendArray  = function(source, target) {
    if(!target)
        return source;
    return target.concat(source);
}
TestFramework.prototype.compare  = function (a,b) {
    if (a.time < b.time)
        return -1;
    if (a.time > b.time)
        return 1;
    return 0;
}

TestFramework.prototype.testFinished  = function(){

    this.doneAlready = true;
    for (var deviceName in this.testDevices) {
        if (this.testDevices[deviceName] != null) {
            var responseTime = this.testDevices[deviceName].endTime - this.testDevices[deviceName].startTime;
            this.testResults.push({"test": this.currentTest, "device":deviceName,"time": responseTime,"data": this.testDevices[deviceName].data});

            //lets finalize the test by stopping it.
            this.testDevices[deviceName].SendCommand('stop',"","");

            //reset values for next testing round
            this.testDevices[deviceName].startTime = new Date();
            this.testDevices[deviceName].endTime = new Date();
            this.testDevices[deviceName].data = null;
        }
    }

    this.doNextTest()
}

module.exports = TestFramework;