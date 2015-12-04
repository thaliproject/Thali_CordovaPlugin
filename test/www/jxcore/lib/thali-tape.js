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
var tape = require('tape-catch');
var CoordinatorConnector = require('./CoordinatorConnector');
var serverAddress = require('../server-address.js');

var testUtils = require("./testUtils");

process.on('uncaughtException', function(err) {
  console.log("Uncaught Exception: " + err);
  console.log(err.stack);
  console.log("****TEST TOOK:  ms ****" );
  console.log("****TEST_LOGGER:[PROCESS_ON_EXIT_FAILED]****");
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

  _coordinator.connect(serverAddress, 3000);

  return _coordinator;
}

var tests = {};
var deviceName = "UNITTEST-" + Math.random();

function declareTest(name, setup, teardown, opts, cb) {

  // test declaration is postponed until we know the order in which 
  // the server wants to execute them. 

  // Tape executes tests in strict declaration order once the output stream starts to request 
  // results so make sure we declare everything up front before asking for the first result

  // Here we declare setup and teardown functions either side of the actual test
  // They'll be executed in declaration order and will be coordinated across devices
  // by the test server emitting events at the appropriate point

  tape('setup', function(t) {
    // Run setup function when the coordinator tells us
    getCoordinator().once("setup", function(_name) {
      setup(t);
      // Tell the coordinator we ran setup for this test
      getCoordinator().setupComplete(name);
    });
  });

  tape(name, function(t) {
    var success = true;

    // Listen for the test result
    t.on("result", function(res) {
      success = success && res.ok;
    });

    t.on("end", function() {
      // Tell the coordinator we ran the test and what the result was (true == pass)
      getCoordinator().testComplete(name, success);
    });

    // Run the test (cb) when the server tells us to    
    getCoordinator().once("start_test", function(_name) {
      cb(t);
    });
  });

  tape("teardown", function(t) {
      console.log("--- running teardown");
    // Run teardown function when the coordinator tells us
    getCoordinator().once("teardown", function(_name) {
      console.log("running teardown");
      teardown(t);
      // The the coordinator we ran teardown for this test
      getCoordinator().teardownComplete(name);
    }); 
  });
};


var thaliTape = function(fixture) 
{
  // Thali_Tape - Adapt tape such that tests are executed when explicitly triggered
  // by a co-ordinating server executing (perhaps) remotely.
  // This enables us to run tests in lock step across a number of devices

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
  // tape is slightly counter-intuitive in that no tests will
  // run until the output streams are set up. 

  // ** Nothing will run until this function is called !! **

  var total = 0;
  var passed = 0;
  var failed = 0;
  var failedRows = [];

  getCoordinator().once("complete", function() {

    // Log final results once server tells us all is done..
    testUtils.logMessageToScreen("------ Final results ---- ");

    for (var i = 0; i < failedRows.length; i++) {
      testUtils.logMessageToScreen(
        failedRows[i].id + ' isOK: ' + failedRows[i].ok + ' : ' + failedRows[i].name
      );
    }

    testUtils.logMessageToScreen('Total: ' + total + ', Passed: ' + passed + ', Failed: ' + failed);
    console.log('Total: %d\tPassed: %d\tFailed: %d', total, passed, failed);
    testUtils.toggleRadios(false);

    console.log("****TEST TOOK:  ms ****" );
    console.log("****TEST_LOGGER:[PROCESS_ON_EXIT_SUCCESS]****");
  });

  tape.createStream({ objectMode: true })
  .on('data', function(row) {
    
    // Collate and log results as they come in

    console.log(JSON.stringify(row));

    if (row.type === 'assert') {
      total++;
      row.ok && passed++;
      !row.ok && failed++;
    }
    rows.push(row);

    testUtils.logMessageToScreen(row.id + ' isOK: ' + row.ok + ' : ' + row.name);

    if (row.ok && row.name) {
      if(!row.ok) {
        failedRows.push(row);
      }
    }
  })
  .on('end', function() {
    console.log("Tests Complete");
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

module.exports = (typeof jxcore == 'undefined' || jxcore.utils.OSInfo().isMobile) ? thaliTape : require("wrapping-tape");
