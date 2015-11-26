/*
 Thali unit test implementation of tape.
 Highly inspired by wrapping-tape, and usage is very similar to the wrapping tape:

 var tape = require('thali-tape');

 var test = tape({
 setup: function(t) {
 // will be called after each test has started to setup the test
 // after the next line, the actual test code will be executed
 t.end();
 },
 teardown: function(t) {
 // will be called after each device has ended the test
 // do any final tear down for the test in here
 t.end();
 }
 });
 */

'use strict';
var tape = require('tape');
var CoordinatorConnector = require('./CoordinatorConnector');
var parsedJSON = require('../serveraddress.json');

var testUtils = require("./testUtils");

process.on('uncaughtException', function(err) {
  console.log("Uncaught Exception: " + err);
  console.log("****TEST TOOK:  ms ****" );
  console.log("****TEST_LOGGER:[PROCESS_ON_EXIT_FAIL]****");
  throw err;
});

process.on('unhandledRejection', function(err) {
  console.log("Uncaught Promise Rejection: " + JSON.stringify(err));
  console.log("****TEST TOOK:  ms ****" );
  console.log("****TEST_LOGGER:[PROCESS_ON_EXIT_FAILED]****");
});

// Singleton CoordinatorConnector instance
var _coordinator = null;

function getCoordinator()
{
  if (_coordinator != null) {
    return _coordinator;
  }

  _coordinator = new CoordinatorConnector();

  _coordinator.on('error', function (data) {
    var errData = JSON.parse(data);
    console.log('Error:' + data + ' : ' + errData.type +  ' : ' + errData.data);
  });

  _coordinator.on('disconnect', function () {
    // We've become disconnected from the test server

    // Shut down the Wifi & Bluetooth here
    testUtils.toggleRadios(false);
  });

  _coordinator.on('too_late', function (data) {
    console.log('got too_late event, closing connection now.');
    Coordinator.close();
    console.log("****TEST TOOK:  ms ****" );
    console.log("****TEST_LOGGER:[PROCESS_ON_EXIT_FAIL]****");
  });

  _coordinator.connect(parsedJSON[0].address, 3000);

  return _coordinator;
}

var tests = {};
var deviceName = "UNITTEST-" + Math.random();

function declareTest(name, setup, teardown, opts, cb) {

  tape('setup', function(t) {
    getCoordinator().once("setup", function(_name) {
      setup(t);
      getCoordinator().setupComplete(name);
    });
  });

  tape(name, function(t) {
    var success = true;
    t.on("result", function(res) {
      success = success && res.ok;
    });
    getCoordinator().once("start_test", function(_name) {
      cb(t);
      getCoordinator().testComplete(name, success);
    });
  });

  tape("teardown", function(t) {
    getCoordinator().once("teardown", function(_name) {
      teardown(t);
      getCoordinator().teardownComplete(name);
    }); 
  });
};


var thaliTape = function(fixture) 
{
  // Thali_Tape - Adapt tape such that tests are executed when explicitly triggered
  // by a co-ordinating server executing (perhaps) remotely.
  // This enables us to run tests in lock step accross a number of devices

  // test([name], [opts], fn)
  return function(name, opts, fn) {

    // This is the function that declares and performs the test. 
    // cb is the test function. We wrap this in setup and 

    if (!fn) {
      fn = opts;
      opts = null;
    }

    tests[name] = { opts:opts, fn:fn, fixture:fixture };
  }
}

function createStream()
{
  tape.createStream({ objectMode: true })
  .on('data', function (row) {
      // Log for results
      //console.log(JSON.stringify(row));

      /*if (row.type === 'assert') {
          total++;
          row.ok && passed++;
          !row.ok && failed++;
      }
      rows.push(row);

      testUtils.logMessageToScreen(row.id + ' isOK: ' + row.ok + ' : ' + row.name);

      if (row.ok && row.name) {
          if(!row.ok){
              failedRows.push(row);
          }
      }*/
  })
  .on('end', function () {
      // Log final results
      /*testUtils.logMessageToScreen("------ Final results ---- ");

      for(var i = 0; i < failedRows.length; i++){
          testUtils.logMessageToScreen(failedRows[i].id + ' isOK: ' + failedRows[i].ok + ' : ' + failedRows[i].name);
      }

      testUtils.logMessageToScreen('Total: ' + total + ', Passed: ' + passed + ', Failed: ' + failed);
      console.log('Total: %d\tPassed: %d\tFailed: %d', total, passed, failed);
      testUtils.toggleRadios(false);

      console.log("****TEST TOOK:  ms ****" );
      console.log("****TEST_LOGGER:[PROCESS_ON_EXIT_SUCCESS]****");*/
  });
}

thaliTape.begin = function() {

  // Once connected, let the server know who we are and what we do
  getCoordinator().once("connect", function() {
    getCoordinator().once("schedule", function(schedule) {
      JSON.parse(schedule).forEach(function(test) {
        declareTest(
          test, 
          tests[test].fixture.setup, 
          tests[test].fixture.teardown, 
          tests[test].opts, 
          tests[test].fn
        );
      });
      getCoordinator().scheduleComplete();
      createStream();
    });

    getCoordinator().present(deviceName, "unittest", Object.keys(tests));
  });
}

thaliTape.getCoordinator = getCoordinator;

module.exports = (typeof jxcore == 'undefined' || jxcore.utils.OSInfo().isMobile) ? thaliTape : require("WrappingTape");
