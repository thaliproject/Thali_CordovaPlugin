/**
 * Created by juksilve on 2.9.2015.
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
    fs.readdirSync(__dirname + '/tests/').forEach(function(fileName) {
        if ((fileName.indexOf("test") == 0) &&
            fileName.indexOf(".js", fileName.length - 3) != -1) {
            console.log('found test : ./' + fileName);
            self.test[fileName] = require('./tests/' + fileName);
        }
    });
}

TestFrameworkClient.prototype = new events.EventEmitter;

TestFrameworkClient.prototype.handleCommand = function(command){
    var self = this;
    var commandData = JSON.parse(command);
    switch(commandData.command){
        case 'start':{
            console.log('Star now : ' + commandData.testName);
            this.stopAllTests(); //Stop any previous tests if still running
            if(self.test[commandData.testName]){
                self.emit('debug',"--- start :" + commandData.testName + "---");
                currentTest = new self.test[commandData.testName](commandData.testData,this.deviceName);
                self.setCallbacks(currentTest);
                currentTest.start();
            }else{
                self.emit('done',JSON.stringify({"result":"TEST NOT IMPLEMENTED"}));
            }
            break;
        }
        case 'stop':{
            self.emit('debug',"stop");
            this.stopAllTests(true);
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