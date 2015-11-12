/**
 *
 * This is class implementation which is used to load all performance tests from the perf_tests folder
 * Then its expecting start & stop commands for the tests, and also it expects the start command to specify which test
 * file to execute. It also routes the:
 * - 'done' events indicating that the test case has now been finished, and the test now waits teardown to happen with stop command
 * - 'debug' events which are relying some debugging information that could be shown in the applications UI
 */
'use strict';
var events = require('events');
var fs = require('fs-extra-promise');

var currentTest = null;

function TestFrameworkClient(name) {
    var self = this;
    this.deviceName= name;

    this.test = {};

    this.debugCallback = function(data) {
        self.emit('debug',data);
    }

    this.doneCallback = function(data) {
        self.emit('done',data);
    }

    console.log('check test folder');
    fs.readdirSync(__dirname).forEach(function(fileName) {
        if ((fileName.indexOf("test") == 0) &&
            fileName.indexOf(".js", fileName.length - 3) != -1) {
            console.log('found test : ./' + fileName);
            self.test[fileName] = require('./' + fileName);
        }
    });
}

TestFrameworkClient.prototype = new events.EventEmitter;

/*
{
command : start/stop test,
testName: filename of the test to execute,
testData: parameters for the test case
}
*/

TestFrameworkClient.prototype.handleCommand = function(command){
    var self = this;
    var commandData = JSON.parse(command);
    switch(commandData.command){
        case 'start':{
            console.log('Start now : ' + commandData.testName);
            self.stopAllTests(); //Stop any previous tests if still running
            if(self.test[commandData.testName]){
                self.emit('debug',"--- start :" + commandData.testName + "---");
                currentTest = new self.test[commandData.testName](commandData.testData,self.deviceName,commandData.devices);
                self.setCallbacks(currentTest);
                currentTest.start();
            }else{
                self.emit('done',JSON.stringify({"result":"TEST NOT IMPLEMENTED"}));
            }
            break;
        }
        case 'stop':{
            self.emit('debug',"stop");
            self.stopAllTests(true);
            break;
        }
        case 'end':{
            self.emit('debug',"--- ENDING test---");
            Mobile.toggleBluetooth(false, function() {
                self.emit('debug',"toggleBluetooth, OFF");
                Mobile.toggleWiFi(false, function() {
                    self.emit('debug',"toggleWiFi, OFF");
                    console.log("****TEST TOOK:  ms ****" );
                    console.log("****TEST_LOGGER:[PROCESS_ON_EXIT_SUCCESS]****");
                });
            });
            break;
        }
        default:{
            console.log('unknown commandData : ' + commandData.command);
        }
    }
}
TestFrameworkClient.prototype.setCallbacks = function(test) {
    if (test == null) {
        return;
    }
    test.on('done', this.doneCallback);
    test.on('debug', this.debugCallback);
}


TestFrameworkClient.prototype.stopAllTests = function(doReport) {
    console.log('stop tests now !');
    if (currentTest == null) {
        return;
    }
    console.log('stop current!');
    currentTest.stop(doReport);
    currentTest.removeListener('done', this.doneCallback);
    currentTest.removeListener('debug', this.debugCallback);
    currentTest = null;
}

module.exports = TestFrameworkClient;
