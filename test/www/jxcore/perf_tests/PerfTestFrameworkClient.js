/**
 *
 * This is class implementation which is used to load all performance tests from the perf_tests folder
 * Then its expecting start & stop commands for the tests, and also it expects the start command to specify which test
 * file to execute. It also routes the:
 * - 'done' events indicating that the test case has now been finished, and the test now waits teardown to happen with stop command
 * - 'debug' events which are relying some debugging information that could be shown in the applications UI
 */
'use strict';

var fs = require('fs');
var inherits = require('util').inherits;
var testUtils = require('../lib/testutils.js');
var EventEmitter = require('events').EventEmitter;
var CoordinatorConnector = require('../lib/CoordinatorConnector');

// Singleton coordinator
var _coordinator = null;
function getCoordinator()
{
  if (_coordinator != null) {
    return _coordinator;
  }

  _coordinator = new CoordinatorConnector();

  // A flag used to avoid too frequent Wifi toggling
  var wifiRepairOngoing = false;

  _coordinator.on('error', function (data) {

    var errorData = JSON.parse(data);
    var errorMessage = 'Error type "' + errorData.type +  '" when connecting to the test server';
    console.log(errorMessage);
    testUtils.logMessageToScreen(errorMessage);

    if (wifiRepairOngoing) {
      return;
    }

    wifiRepairOngoing = true;
    // If we have a connection error to the test server, we try to repair
    // the connection by toggling Wifi off and on. This forces devices
    // to re-connect to the Wifi access point.
    if (errorData.type === 'connect_error') {
      testUtils.toggleWifi(false, function () {
        testUtils.toggleWifi(true, function () {
          console.log('Wifi toggled for connection repair');
          // This is the time when Wifi toggling is completed, but it
          // doesn't necessarily mean that the connection to the Wifi
          // access point is already restored. There is some time
          // needed from turning Wifi on to the point when the connection
          // is functional.
        });
      });
    }

    setTimeout(function () {
      wifiRepairOngoing = false;
    }, 60 * 1000);
  });


  return _coordinator;
}

function TestFrameworkClient(name) {

  TestFrameworkClient.super_.call(this);

  this.deviceName = name;


  var self = this;
  this.debugCallback = function(data) {
    self.emit('debug',data);
  }

  this.doneCallback = function(data) {
    self.emit('done',data);
    self.printResults(data);
  }

  this.tests = {};
  console.log('check test folder');
  fs.readdirSync(__dirname).forEach(function(fileName) {
    if ((fileName.indexOf("test") == 0) &&
      fileName.indexOf(".js", fileName.length - 3) != -1) {
      console.log('found test : ./' + fileName);
      this.tests[fileName] = require('./' + fileName);
    }
  }, this);

  this.coordinator = getCoordinator();

  this.coordinator.on('too_late', function (data) {
    // We connected too late to take part in a test session
    // signal to CI (via stdout) that we're quitting (and do so)
    console.log("****TEST TOOK:  ms ****" );
    console.log("****TEST_LOGGER:[PROCESS_ON_EXIT_FAILED]****");
    process.exit(0);
  });

  this.coordinator.on('connect', function () {
    console.log('Coordinator is now connected to the server!');
    testUtils.logMessageToScreen('connected to server');
    Coordinator.present(myName, "perftest", Object.keys(self.tests), bluetoothAddress);
  });

  this.coordinator.on('command', function (data) {
    console.log('command received : ' + data);
    TestFramework.handleCommand(data);
  });

  this.coordinator.on('closed', function () {
    console.log('The Coordinator has closed!');

    //we need to stop & close any tests we are running here
    TestFramework.stopAllTests(false);
    testUtils.logMessageToScreen('fully-closed');
    console.log('turning Radios off');
    testUtils.toggleRadios(false);
  });

  this.currentTest = null;

  this.coordinator.connect(require('../serveraddress.json').address, 3000);
}

inherits(TestFrameworkClient, EventEmitter);

/*
{
command : start/stop test,
testName: filename of the test to execute,
testData: parameters for the test case
}
*/

TestFrameworkClient.prototype.handleCommand = function(command){

  var commandData = JSON.parse(command);

  switch (commandData.command) {

    case 'start': {
      console.log('Start now : ' + commandData.testName);

      if (this.tests[commandData.testName]) {

        this.emit('debug',"--- start :" + commandData.testName + "---");
        this.currentTest = new this.tests[commandData.testName](
          commandData.testData,
          this.deviceName,
          commandData.devices,
          this.shuffle(commandData.addressList)
        );
        this.setCallbacks(currentTest);
        currentTest.start();

      } else {
        this.emit('done', JSON.stringify({"result":"TEST NOT IMPLEMENTED"}));
      }
    }
    break;

    case 'stop': {
      this.emit('debug',"stop");
      this.stopAllTests(false);
    }
    break;

    case 'timeout': {
     this.emit('debug',"stop-by-timeout");
     this.stopAllTests(true);
    }
    break;

    case 'end': {
      console.log("****TEST TOOK:  ms ****" );
      console.log("****TEST_LOGGER:[PROCESS_ON_EXIT_SUCCESS]****");
      this.stopAllTests(true);
      this.emit('end',"end");
    }
    break;

    default: {
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

  var compareTime = function (a, b) {
    if (a.time < b.time)
      return -1;
    if (a.time > b.time)
      return 1;
    return 0;
  }

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

    if (results.connectList) { // && (results[devName].connectList.length > 0)) {
      results.connectList.sort(compareTime);

      this.printResultLine('connectList',results.connectList);
      this.printMinMaxLine(results.connectList);

      if (results.connectError) {
        this.printFailedLine(
          'connectList',
          results.connectError.failedPeer, 
          results.connectError.notTriedList, 
          results.connectList.length
        );
      }

      } else if (results.connectError && results.connectError.failedPeer > 0) {
        console.log(
          "All (" + results.connectError.failedPeer + ") Re-Connect test connections failed"
        );
      }

      if (results.sendList) { // && (results[devName].sendList.length > 0)) {
        results.sendList.sort(compareTime);

        this.printResultLine('sendList',results.sendList);
        this.printMinMaxLine(results.sendList);

        if (results.sendError) {
          this.printFailedLine(
            'sendList',
            results.sendError.failedPeer, 
            results.sendError.notTriedList, 
            results.sendList.length
          );
        }
    } else if (results.sendError && results.sendError.failedPeer > 0) {
      console.log("All (" + results.sendError.failedPeer + ") SendData test connections failed");
    }
  }
}

TestFrameworkClient.prototype.printFailedLine = function(
  what, failedPeers, notTriedPeers, successCount
) {
  if (!notTriedPeers || !failedPeers ||  (failedPeers.length + successCount) <=0){
      return;
  }

  console.log(
    what + " failed peers count : " + failedPeers.length + 
    " [" + ((failedPeers.length * 100) / (successCount + failedPeers.length)) + " %]"
  );

  failedPeers.forEach(function(peer) {
    console.log("- Peer ID : " + peer.name + ", Tried : " + peer.connections);
  });

  console.log(
    what + " never tried peers count : " + notTriedPeers.length + 
    " [" + ((notTriedPeers.length * 100) / (successCount + failedPeers.length + 
    notTriedPeers.length)) + " %]"
  );

  notTriedPeers.forEach(function(peer) {
    console.log("- Peer ID : " + peer.name);
  });
}

TestFrameworkClient.prototype.printMinMaxLine  = function(list) {
  if (!list || list.length <= 0){
    console.log('Results list does not contain any items');
    return;
  }
  console.log(
    'Result count ' + list.length + ', range ' + list[0].time + ' ms to  ' + 
    list[(list.length - 1)].time + " ms."
  );
}

TestFrameworkClient.prototype.printResultLine  = function(what, list) {

  var percentile  = function(array, percentile) {
    var index = Math.round(array.length * percentile);
    if (index > 0){
      index = index - 1;
    }
    if (index < array.length) {
      return array[index].time;
    }
  }

  console.log(
    what + " : 100% : " + percentile(list, 1.00) + " ms, 99% : " + 
    percentile(list, 0.99)  + " ms, 95 : " + percentile(list, 0.95) + " ms, 90% : " + 
    percentile(list, 0.90) + " ms."
  );
}

TestFrameworkClient.prototype.preProcessResults  = function(source, target, errorTarget){

  if (!target) {
    target = [];
  }

  if (!errorTarget.failedPeer) {
    errorTarget.failedPeer = [];
  }

  if (!errorTarget.notTriedList) {
    errorTarget.notTriedList = [];
  }

  source.forEach(function(roundResult) {

    if (!roundResult || roundResult == null){
      return;
    }

    if (roundResult.result == "OK") {
      target.push(roundResult);
    } else if (roundResult.connections){
      errorTarget.failedPeer.push(roundResult);
    } else { // if connections is zero, then we never got to try to connect before we got timeout
      errorTarget.notTriedList.push(roundResult);
    }
  });
}

module.exports = TestFrameworkClient;
