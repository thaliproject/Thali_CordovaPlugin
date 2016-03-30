/*
 Thali unit test implementation of tape. Highly inspired by wrapping-tape, and
 usage is very similar to the wrapping tape:

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

var util = require('util');
var uuid = require('node-uuid');
var tape = require('tape-catch');
var io = require('socket.io-client');
var testUtils = require('./testUtils');

process.on('uncaughtException', function (err) {
  console.log('Uncaught Exception: ' + err);
  console.log(err.stack);
  console.log('****TEST_LOGGER:[PROCESS_ON_EXIT_FAILED]****');
  process.exit(1);
});

process.on('unhandledRejection', function (err) {
  console.log('Uncaught Promise Rejection: ' + JSON.stringify(err));
  console.trace(err);
  console.log('****TEST_LOGGER:[PROCESS_ON_EXIT_FAILED]****');
  process.exit(1);
});

var tests = {};
var allSuccess = true;

function declareTest(testServer, name, setup, teardown, opts, cb) {

  // test declaration is postponed until we know the order in which
  // the server wants to execute them.

  // Tape executes tests in strict declaration order once the output stream
  // starts to request results so make sure we declare everything up front
  // before asking for the first result

  // Here we declare setup and teardown functions either side of the actual test
  // They'll be executed in declaration order and will be coordinated across
  // devices by the test server emitting events at the appropriate point

  tape('setup', function (t) {
    // Run setup function when the testServer tells us
    var success = true;
    testServer.once('setup_' + name, function () {
      testServer.emit(util.format('setup_%s_ok', name));
      t.on('result', function (res) {
        success = success && res.ok;
      });
      t.once('end', function () {
        if (!success) {
          allSuccess = false;
        }
        testServer.emit('setup_complete',
          JSON.stringify({
            'test': name,
            'success': success,
            'data': t.data || null
          })
        );
      });
      setup(t);
    });
  });

  tape(name, function (t) {
    var success = true;

    // Listen for the test result
    t.on('result', function (res) {
      success = success && res.ok;
    });

    t.once('end', function () {
      if (!success) {
        allSuccess = false;
      }
      // Tell the server we ran the test and what the result was (true == pass)
      testServer.emit('test_complete',
        JSON.stringify({'test':name, 'success':success}));
    });

    // Run the test (cb) when the server tells us to
    testServer.once('start_test_' + name, function (data) {
      t.participants = JSON.parse(data);
      testServer.emit(util.format('start_test_%s_ok', name));
      cb(t);
    });
  });

  tape('teardown', function (t) {
    // Run teardown function when the server tells us
    var success = true;
    testServer.once('teardown_' + name, function () {
      testServer.emit(util.format('teardown_%s_ok', name));
      t.on('result', function (res) {
        success = success && res.ok;
      });
      t.once('end', function () {
        if (!success) {
          allSuccess = false;
        }
        testServer.emit('teardown_complete',
          JSON.stringify({'test':name, 'success':success}));
      });
      teardown(t);
    });
  });
}

// The running number of the test that together with the test name guarantees
// a unique identifier even if there exists multiple tests with same name
var testRunningNumber = 0;
// Flag used to check if we have completed all the tests we should run
var complete = false;

var thaliTape = function (fixture) {
  // Thali_Tape - Adapt tape such that tests are executed when explicitly
  // triggered by a co-ordinating server executing (perhaps) remotely.
  // This enables us to run tests in lock step across a number of devices

  // test([name], [opts], fn)
  return function (name, opts, fn) {

    // This is the function that declares and performs the test.
    // cb is the test function. We wrap this in setup and

    if (!fn) {
      fn = opts;
      opts = null;
    }

    testRunningNumber++;
    tests[testRunningNumber + '. ' + name] = {
      opts: opts,
      fn: fn,
      fixture: fixture
    };
  };
};

var platform =
  typeof jxcore !== 'undefined' && jxcore.utils.OSInfo().isAndroid ?
  'android' :
  'ios';

thaliTape.begin = function () {

  var serverOptions = {
    transports: ['websocket']
  };

  var testServer = io('http://' + require('../server-address') + ':' + 3000 +
    '/', serverOptions);

  testServer.once('discard', function () {
    // This device not needed, log appropriately so CI doesn't think we've
    // failed
    console.log('--= Surplus to requirements =--');
    console.log('****TEST_LOGGER:[PROCESS_ON_EXIT_SUCCESS]****');
  });

  testServer.on('error', function (data) {
    var errData = JSON.parse(data);
    console.log('Error:' + data + ' : ' + errData.type +  ' : ' + errData.data);
  });

  testServer.on('disconnect', function () {
    if (complete) {
      process.exit(0);
    } else {
      // Just log the error since socket.io will try
      // to reconnect.
      console.log('Disconnected from the test server');
    }
  });

  testServer.on('reconnect', function () {
    testServer.emit('present', JSON.stringify({
      'os': platform,
      'name': testUtils.getName(),
      'uuid': thaliTape.uuid,
      'type': 'unittest'
    }));
  });

  // Wait until we're connected
  testServer.once('connect', function () {

    // Once connected, let the server know who we are and what we do
    testServer.once('schedule', function (schedule) {
      JSON.parse(schedule).forEach(function (test) {
        declareTest(
          testServer,
          test,
          tests[test].fixture.setup,
          tests[test].fixture.teardown,
          tests[test].opts,
          tests[test].fn
        );
      });
      testServer.emit('schedule_complete');
    });

    thaliTape.uuid = uuid.v4();

    testServer.emit('present', JSON.stringify({
      'os': platform,
      'name': testUtils.getName(),
      'uuid': thaliTape.uuid,
      'type': 'unittest',
      'tests': Object.keys(tests)
    }));
  });

  testServer.once('complete', function () {
    complete = true;
    if (allSuccess) {
      console.log('****TEST_LOGGER:[PROCESS_ON_EXIT_SUCCESS]****');
    } else {
      console.log('****TEST_LOGGER:[PROCESS_ON_EXIT_FAILED]****');
    }
  });

  // Only used for testing purposes..
  thaliTape._testServer = testServer;
};

if (typeof jxcore === 'undefined' ||
    typeof Mobile !== 'undefined') {
  // On mobile, or outside of jxcore (some dev scenarios) we use
  // the server-coordinated thaliTape
  exports = thaliTape;
  exports.coordinated = true;
} else {
  // On desktop we just use wrapping-tape
  exports = require('wrapping-tape');
  exports.coordinated = false;

  // thaliTape has a begin function that we patch in here to make
  // the api identical
  exports.begin = function () {
  };
}

module.exports = exports;
