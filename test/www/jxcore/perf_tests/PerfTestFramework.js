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
    };

    this.doneCallback = function(data) {
        self.emit('done',data);

        self.printResults(data);
    };

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
                currentTest = new self.test[commandData.testName](commandData.testData, self.deviceName,
                                                                  commandData.devices,
                                                                  self.shuffle(commandData.addressList));
                self.setCallbacks(currentTest);
                currentTest.start();
            }else{
                self.emit('done',JSON.stringify({"result":"TEST NOT IMPLEMENTED"}));
            }
            break;
        }
        case 'stop':{
            self.emit('debug',"stop");
            self.stopAllTests(false);
            break;
        }
        case 'timeout':{
            self.emit('debug',"stop-by-timeout");
            self.stopAllTests(true);
            break;
        }
        case 'end':{
            console.log("****TEST TOOK:  ms ****" );
            console.log("****TEST_LOGGER:[PROCESS_ON_EXIT_SUCCESS]****");
            self.stopAllTests(true);
            self.emit('end',"end");
            break;
        }
        default:{
            console.log('unknown commandData : ' + commandData.command);
        }
    }
}
//the Fisher-Yates (aka Knuth) Shuffle.
// http://stackoverflow.com/questions/2450954/how-to-randomize-shuffle-a-javascript-array
TestFrameworkClient.prototype.shuffle = function(array) {
    var currentIndex = array.length, temporaryValue, randomIndex ;

    // While there remain elements to shuffle...
    while (0 !== currentIndex) {

        // Pick a remaining element...
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex -= 1;

        // And swap it with the current element.
        temporaryValue = array[currentIndex];
        array[currentIndex] = array[randomIndex];
        array[randomIndex] = temporaryValue;
    }

    return array;
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

TestFrameworkClient.prototype.printResults = function(data) {

    console.log("-- RESULT DATA " + data);
    var jsonData = JSON.parse(data);

    if (jsonData) {

        var results = {};

        if (jsonData.peersList) {
            this.printResultLine('peersList',jsonData.peersList);
            this.printMinMaxLine(jsonData.peersList);

        } else if (jsonData.connectList) {
            results.connectList = [];
            results.connectError = {};
            this.preProcessResults(jsonData.connectList, results.connectList, results.connectError);
        } else if (jsonData.sendList) {
            results.sendList = [];
            results.sendError = {};
            this.preProcessResults(jsonData.sendList, results.sendList, results.sendError);
        } else {
            console.log('has unknown data : ' + data);
        }

        if(results.connectList){// && (results[devName].connectList.length > 0)) {
            results.connectList.sort(this.compare);

            this.printResultLine('connectList',results.connectList);
            this.printMinMaxLine(results.connectList);

            if(results.connectError) {
                this.printFailedLine('connectList',results.connectError.failedPeer, results.connectError.notTriedList, results.connectList.length);
        }

        }else if (results.connectError && results.connectError.failedPeer > 0){
            console.log("All (" + results.connectError.failedPeer + ") Re-Connect test connections failed");
        }

        if(results.sendList){// && (results[devName].sendList.length > 0)) {
            results.sendList.sort(this.compare);

            this.printResultLine('sendList',results.sendList);
            this.printMinMaxLine(results.sendList);

            if(results.sendError) {
                this.printFailedLine('sendList',results.sendError.failedPeer, results.sendError.notTriedList, results.sendList.length);
            }
        }else if (results.sendError && results.sendError.failedPeer > 0){
            console.log("All (" + results.sendError.failedPeer + ") SendData test connections failed");
        }
    }
}

TestFrameworkClient.prototype.printFailedLine = function(what,failedPeers, notTriedPeers,successCount) {

    if(!notTriedPeers || !failedPeers ||  (failedPeers.length + successCount) <=0){
        return;
    }
    console.log(what + " failed peers count : " + failedPeers.length + " [" + ((failedPeers.length * 100) / (successCount + failedPeers.length)) + " %]");

    failedPeers.forEach(function(peer) {
        console.log("- Peer ID : " + peer.name + ", Tried : " + peer.connections);
    });

    console.log(what + " never tried peers count : " + notTriedPeers.length + " [" + ((notTriedPeers.length * 100) / (successCount + failedPeers.length + notTriedPeers.length)) + " %]");

    notTriedPeers.forEach(function(peer) {
        console.log("- Peer ID : " + peer.name);
    });
}

TestFrameworkClient.prototype.printMinMaxLine  = function(list) {
    if(!list || list.length <= 0){
        console.log('Results list does not contain any items');
        return;
    }
    console.log('Result count ' + list.length + ', range ' + list[0].time + ' ms to  '  + list[(list.length - 1)].time + " ms.");
}

TestFrameworkClient.prototype.printResultLine  = function(what, list) {
    console.log(what + " : 100% : " + this.getValueOf(list,1.00) + " ms, 99% : " + this.getValueOf(list,0.99)  + " ms, 95 : " + this.getValueOf(list,0.95)  + " ms, 90% : " + this.getValueOf(list,0.90) + " ms.");
}

TestFrameworkClient.prototype.preProcessResults  = function(source, target,errorTarget){

    if(!target) {
        target = [];
    }
    if(!errorTarget.failedPeer) {
        errorTarget.failedPeer = [];
    }
    if(!errorTarget.notTriedList) {
        errorTarget.notTriedList = [];
    }

    source.forEach(function(roundResult) {

        if(!roundResult || roundResult == null){
            return;
        }

        if (roundResult.result == "OK") {
            target.push(roundResult);
        } else if(roundResult.connections){
            errorTarget.failedPeer.push(roundResult);
        }else{ // if connections is zero, then we never got to try to connect before we got timeout
            errorTarget.notTriedList.push(roundResult);
        }
    });
}

TestFrameworkClient.prototype.getValueOf  = function(array, presentage) {

    if(array.length <= 0){
        return;
    }

    var index = Math.round(array.length * presentage);
    if(index > 0){
        index = index - 1;
    }
    if(index < array.length) {
        return array[index].time;
    }
}

TestFrameworkClient.prototype.extendArray  = function(source, target) {
    if(!target)
        return source;
    return target.concat(source);
}
TestFrameworkClient.prototype.compare  = function (a,b) {
    if (a.time < b.time)
        return -1;
    if (a.time > b.time)
        return 1;
    return 0;
}

module.exports = TestFrameworkClient;
