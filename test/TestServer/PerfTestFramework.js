/**
 */

'use strict';

var fs = require('fs');
var events = require('events');
var configFile = require('./Config_PerfTest.json');

/*
 {
 "name": "performance tests",
 "description": "basic performance tests for Thali apps framework",
 "tests": [
 {"name": "testFindPeers.js", "timeout": "30000","data": {"timeout": "20000"}},
 {"name": "testReConnect.js", "timeout": "700000","data": {"timeout": "600000","rounds":"6","dataTimeout":"5000","conReTryTimeout":"2000","conReTryCount":"10"}},
 {"name": "testSendData.js", "timeout": "7000000","data": {"timeout": "6000000","rounds":"3","dataAmount":"1000000","dataTimeout":"5000","conReTryTimeout":"2000","conReTryCount":"10"}},

 ]
 }

  Test item in the array includes the tests file name and:
  - timeout: defines timeout value which after the coordinator server will cancel the test
  - data: is data that gets sent to the clients devices, and defines what they need to do

   additionally with  re-Connect test data
   - rounds defines how many rounds of connection established needs to be performed for each peers
   - dataTimeout defines timeout which after data sent is determined to be lost, and the connection is disconnected (and reconnected, data send starts from the point we know we managed to deliver to other side)
   - conReTryTimeout defines timeout value used between disconnection (by error) and re-connection
   - conReTryCount defined on how many times we re-try establishing connections before we give up.

   also additionally with  send-data test data
   - dataAmount defines the amount of data sent through each connection before disconnecting
 */

var startTime = new Date().getTime();

function PerfTestFramework(platform,count, honourCount) {
    this.timerId = null;
    this.os = platform;

    this.testResults = [];
    this.currentTest = -1;

    if(honourCount) {
        console.log('Star ' + this.os + ' tests : ' + configFile.name + ", start tests with " + count + " devices");
    }else{
        console.log('Star ' + this.os + ' tests : ' + configFile.name + ", start tests with timer");
    }
    for(var i=0; i < configFile.tests.length; i++) {
        console.log('Test[' + i + ']: ' + configFile.tests[i].name + ', timeout : ' + configFile.tests[i].timeout + ", data : " + JSON.stringify(configFile.tests[i].data));
    }
}

PerfTestFramework.prototype = new events.EventEmitter;

PerfTestFramework.prototype.getCount = function() {
    return this.getConnectedDevicesCount();
}

PerfTestFramework.prototype.addDevice = function(device) {

    var deviceName = device.getName();

    if(!this.testDevices) {
        this.testDevices = {};
    }

    //do we already have it added
    if(this.isDeviceAlreadyAdded(deviceName)){
        console.log(this.os + ' ' + deviceName + ' got re-connected event  ####################################################');
        return true;
    }

    //it was not added, and we have already started, thus this devcei is late
    if (this.currentTest >= 0) {
       // console.log(this.os + ' test progressing ' + device.getName() + ' not added to tests');
        return false;
    }

    this.testDevices[deviceName] = device;
    console.log(this.os + '  ' + deviceName + ' added : ' + ((new Date().getTime() - startTime) / 1000) + " sec., device count " + this.getConnectedDevicesCount());
    return true;
}

PerfTestFramework.prototype.isDeviceAlreadyAdded = function(name) {

    if (!this.testDevices) {
        return false;
    }

    //do we already have it added
    if (this.testDevices[name] && this.testDevices[name] != null) {
        return true;
    }

    return false;
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

    console.log('-----' + this.os + ' start testing now with ' + this.devicesCount + ' devices, time now: ' +  ((new Date().getTime() - startTime) / 1000) + ' sec.');
    this.start =new Date();
    this.doNextTest();
}

PerfTestFramework.prototype.removeDevice = function(name){

    if(!this.testDevices){
        return;
    }

    if(this.testDevices == null){
        return;
    }

    if(this.testDevices[name]) {
        console.log(this.os + ' ' + name + ' got disconnection event  ####################################################');
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

    console.log(this.os + ' with ' + name + ' request took : ' + responseTime + ' ms. results peers[' + peers+ '], reConnects[' + connects + '], sendData[' + sendData+ '], time now: ' +  ((new Date().getTime() - startTime) / 1000) + ' sec.');

    if (this.getFinishedDevicesCount() == this.devicesCount) {
        console.log("------------------------------------------------------");
        console.log(this.os + ' test[ ' + this.currentTest + '] done now. , time now: ' +  ((new Date().getTime() - startTime) / 1000) + ' sec.');
        this.testFinished(false);
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

        //if we have tests, then lets start new tests on all devices
        console.log('start test[' + this.currentTest + '] with ' + this.devicesCount + ' devices.');
        for (var deviceName in this.testDevices) {
            if(this.testDevices[deviceName] != null){
                this.testDevices[deviceName].startTime = new Date();
                this.testDevices[deviceName].endTime = new Date();
                this.testDevices[deviceName].data = null;
                this.testDevices[deviceName].SendCommand('start',configFile.tests[this.currentTest].name,JSON.stringify(configFile.tests[this.currentTest].data),(this.devicesCount - 1),BluetoothList);
           }
        }

        if(configFile.tests[this.currentTest].timeout) {
                this.timerId = setTimeout(function() {
                    console.log('timeout now');
                    if(!self.doneAlready)
                    {
                        for (var deviceName in self.testDevices) {
                            if (self.testDevices[deviceName] != null && self.testDevices[deviceName].data == null) {
                                console.log('Send timeout now to ' + self.testDevices[deviceName].getName());
                                self.testDevices[deviceName].SendCommand('timeout',"","","");
                            }
                        }
                        self.timerId = setTimeout(function() {
                            console.log('Second -- timeout now');
                            if(!self.doneAlready) {
                                console.log('Actual TIMEOUT now');
                                self.testFinished(true);
                            }
                        },60000); // hard coded minute
                    }
                }, configFile.tests[this.currentTest].timeout);

        }
        return;
    }

    console.log(this.os + ' All tests are done, preparing test report. , time now: ' +  ((new Date().getTime() - startTime) / 1000) + ' sec.');


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

                var ConnectionCount = 0;
                var errorCount = 0;
                var tmpConnectList = [];
                this.testResults[i].data.connectList.forEach(function(roundResult) {

                    if (roundResult.result == "OK") {
                        tmpConnectList.push(roundResult);
                        ConnectionCount = ConnectionCount + roundResult.connections;
                    } else {
                        errorCount++;
                    }
                });

                results[this.testResults[i].device].connectList = this.extendArray(tmpConnectList, results[this.testResults[i].device].connectList);
                results[this.testResults[i].device].connectErrorCount = errorCount;
                if(results[this.testResults[i].device].connectList.length > 0){
                    results[this.testResults[i].device].ConCount = ConnectionCount;
                }

            } else if (this.testResults[i].data.sendList) {

                var ConCount = 0;
                var errCount = 0;
                var tmpSendList = [];
                this.testResults[i].data.sendList.forEach(function(roundResult) {

                    if (roundResult.result == "OK") {
                        //console.log("roundResult : " + JSON.stringify(roundResult));
                        tmpSendList.push(roundResult);
                        ConCount = ConCount + roundResult.connections;
                    } else {
                        errCount++;
                    }
                });

                results[this.testResults[i].device].sendList = this.extendArray(tmpSendList, results[this.testResults[i].device].sendList);
                results[this.testResults[i].device].sendErrorCount = errCount;
                if(results[this.testResults[i].device].sendList.length > 0){
                    results[this.testResults[i].device].ConCount = ConCount;
                }

                //console.log("roundResult : " + results[this.testResults[i].device].sendList.length);

            } else {
                var line00 = 'Test[' + this.testResults[i].test + '] for ' + this.testResults[i].device + ' has unknown data : ' + JSON.stringify(this.testResults[i].data);

                console.log(line00);
            }
        }
    }


    // to prevent ending disconnections etc on being included in reports
    var tmpDevicesList = this.testDevices;
    this.testDevices = null;

    console.log('--------------- test report ---------------------');

    var counter = 0;
    for( var devName in results){

        counter++;
        console.log('--------------- ' + devName + ' --------------------- : ' + counter);

        if(results[devName].peersList && (results[devName].peersList.length > 0)) {

            results[devName].peersList.sort(this.compare);

            var line01 = devName + ' has ' + results[devName].peersList.length + ' peersList result, range ' + results[devName].peersList[0].time + ' ms  to  '  + results[devName].peersList[(results[devName].peersList.length - 1)].time + " ms.";
            console.log(line01);

            var line02 = "100% : " + this.getValueOf(results[devName].peersList,1.00) + " ms, 99% : " + this.getValueOf(results[devName].peersList,0.90)  + " ms, 95 %: " + this.getValueOf(results[devName].peersList,0.95)  + " ms, 90% : " + this.getValueOf(results[devName].peersList,0.90) + " ms.";
            console.log(line02);

            combined.peersList = this.extendArray(results[devName].peersList,combined.peersList);
        }

        if(results[devName].connectList && (results[devName].connectList.length > 0)) {
            results[devName].connectList.sort(this.compare);

            var line03 = devName + ' has ' + results[devName].connectList.length + ' connectList result , range ' + results[devName].connectList[0].time + ' ms to  '  + results[devName].connectList[(results[devName].connectList.length - 1)].time + " ms.";

            console.log(line03);
            if(results[devName].connectList.length > 0 ) {
                console.log("Failed connections " + results[devName].connectErrorCount + "(" + (results[devName].connectErrorCount * 100 / (results[devName].connectList.length + results[devName].connectErrorCount)) + "%)");
            }

            var line04 = "100% : " + this.getValueOf(results[devName].connectList,1.00) + " ms, 99% : " + this.getValueOf(results[devName].connectList,0.99)  + " ms, 95% : " + this.getValueOf(results[devName].connectList,0.95)  + " ms, 90% : " + this.getValueOf(results[devName].connectList,0.90) + " ms.";

            console.log(line04);

            combined.connectList = this.extendArray(results[devName].connectList,combined.connectList);
        }else if (results[devName].connectErrorCount && results[devName].connectErrorCount > 0){
            console.log("All (" + results[devName].connectErrorCount + ") Re-Connect test connections failed");
        }

        if(results[devName].sendList && (results[devName].sendList.length > 0)) {
            results[devName].sendList.sort(this.compare);

            var line05 = devName + ' has ' + results[devName].sendList.length + ' sendList result , range ' + results[devName].sendList[0].time + ' ms to  '  + results[devName].sendList[(results[devName].sendList.length - 1)].time + " ms.";

            console.log(line05);
            if(results[devName].sendList.length > 0 ) {
                console.log("Failed connections " + results[devName].sendErrorCount + "(" + (results[devName].sendErrorCount * 100 / (results[devName].sendList.length + results[devName].sendErrorCount)) + "%)");
            }

            var line06 = "100% : " + this.getValueOf(results[devName].sendList,1.00) + " ms, 99% : " + this.getValueOf(results[devName].sendList,0.99)  + " ms, 95 : " + this.getValueOf(results[devName].sendList,0.95)  + " ms, 90% : " + this.getValueOf(results[devName].sendList,0.90) + " ms.";

            console.log(line06);

            combined.sendList = this.extendArray(results[devName].sendList,combined.sendList);
        }else if (results[devName].sendErrorCount && results[devName].sendErrorCount > 0){
            console.log("All (" + results[devName].sendErrorCount + ") SendData test connections failed");
        }
    }

    console.log('--------------- Combined ---------------------');

    if(combined.peersList){
        combined.peersList.sort(this.compare);
        var line07 = "peersList : 100% : " + this.getValueOf(combined.peersList,1.00) + " ms, 99% : " + this.getValueOf(combined.peersList,0.99)  + " ms, 95 : " + this.getValueOf(combined.peersList,0.95)  + " ms, 90% : " + this.getValueOf(combined.peersList,0.90) + " ms.";

        console.log(line07);
    }

    if(combined.connectList){
        combined.connectList.sort(this.compare);
        var line08 = "connectList : 100% : " + this.getValueOf(combined.connectList,1.00) + " ms, 99% : " + this.getValueOf(combined.connectList,0.99)  + " ms, 95 : " + this.getValueOf(combined.connectList,0.95)  + " ms, 90% : " + this.getValueOf(combined.connectList,0.90) + " ms.";

        console.log(line08);
    }

    if(combined.sendList){
        combined.sendList.sort(this.compare);
        var line09 = "sendList : 100% : " + this.getValueOf(combined.sendList,1.00) + " ms, 99% : " + this.getValueOf(combined.sendList,0.99)  + " ms, 95 : " + this.getValueOf(combined.sendList,0.95)  + " ms, 90% : " + this.getValueOf(combined.sendList,0.90) + " ms.";

        console.log(line09);
    }

    for (var deviceName in tmpDevicesList) {
        if(tmpDevicesList[deviceName] != null){
            //if really needed, we could send the whole test data back with this command, and do the whole logging in the client side as well
            tmpDevicesList[deviceName].SendCommand('end','results',JSON.stringify({"result":results[deviceName],'combined':combined}),this.devicesCount);
        }
    }

    console.log('--------------- end of test report ---------------------');
}



PerfTestFramework.prototype.getValueOf  = function(array, presentage) {
    var index = Math.round(array.length * presentage);
    if(index > 0){
        index = index - 1;
    }
    if(index < array.length) {
        return array[index].time;
    }
}

PerfTestFramework.prototype.extendArray  = function(source, target) {
    if(!target)
        return source;
    return target.concat(source);
}
PerfTestFramework.prototype.compare  = function (a,b) {
    if (a.time < b.time)
        return -1;
    if (a.time > b.time)
        return 1;
    return 0;
}

PerfTestFramework.prototype.testFinished  = function(){
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
                // this device is now out of sync, so we need to take it out from the tests
                console.log(deviceName + ' removed from tests, new count : ' + this.devicesCount);
                this.testDevices[deviceName].SendCommand('end', "", "", "");
                this.testDevices[deviceName] = null;
                this.devicesCount = this.getConnectedDevicesCount();
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
