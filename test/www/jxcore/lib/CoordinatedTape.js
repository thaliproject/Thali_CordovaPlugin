'use strict';

var util     = require('util');
var format   = util.format;
var inherits = util.inherits;
var extend   = util._extend;

var tape    = require('tape-catch');
var assert  = require('assert');
var Promise = require('bluebird');
var uuid    = require('node-uuid');

var SocketIOClient = require('socket.io-client');

var asserts         = require('./utils/asserts');
var testUtils       = require('./testUtils');
var SimpleThaliTape = require('./SimpleTape');
var serverAddress   = require('../server-address');


var logger = testUtils.logger;

function CoordinatedThaliTape (opts) {
  // We are calling this function directly without 'new'.
  if (!this) {
    return new CoordinatedThaliTape(opts);
  }
  return CoordinatedThaliTape.super_.apply(this, arguments);
}

inherits(CoordinatedThaliTape, SimpleThaliTape);

CoordinatedThaliTape.states    = SimpleThaliTape.states;
CoordinatedThaliTape.instances = SimpleThaliTape.instances;
CoordinatedThaliTape.begin     = SimpleThaliTape.begin;

CoordinatedThaliTape.prototype._begin = function (platform, version, hasRequiredHardware) {
  assert(
    this._state === CoordinatedThaliTape.states.created,
    'we should be in created state'
  );
  this._state = CoordinatedThaliTape.states.started;

  var testNames = this._tests.map(function (data) {
    return data.name;
  });
  this._testClient = new TestClient(testNames, platform, version, hasRequiredHardware);
  // Only used for testing purposes.
  this._testServer = this._testClient._io;

  return new Promise(function () {});
}

module.exports = CoordinatedThaliTape;


function TestClient(testNames, platform, version, hasRequiredHardware, options) {
  this._testNames           = testNames;
  this._platform            = platform;
  this._version             = version;
  this._hasRequiredHardware = hasRequiredHardware;

  this._options = extend({}, TestClient.defaults);
  this._options = extend(this._options, options);
  asserts.isNumber(this._options.emitRetryCount);
  asserts.isNumber(this._options.emitRetryTimeout);

  this._state = TestClient.states.created;
  this._uuid  = uuid.v4();
  this._io = SocketIOClient(
    'http://' + serverAddress + ':' + 3000 + '/',
    {
      transports: ['websocket']
    }
  );

  this._bind();
}

TestClient.defaults = {
  emitRetryCount:   20,
  emitRetryTimeout: 1000
}

TestClient.states = {
  created:   'created',
  connected: 'connected',
  completed: 'completed'
};

TestClient.prototype._bind = function () {
  this._io
  .on  ('connect',    this._connect.bind(this))
  .on  ('reconnect',  this._reconnect.bind(this))
  .once('schedule',   this._schedule.bind(this))
  .on  ('discard',    this._discard.bind(this))
  .on  ('disqualify', this._disqualify.bind(this))
  .on  ('disconnect', this._disconnect.bind(this))
  .on  ('error',      this._error.bind(this))
  .once('complete',   this._complete.bind(this));
}

// We are having similar logic in both connect reconnect
// events, because socket.io seems to behave so that sometimes
// we get the connect event even if we have been connected before
// (and sometimes the reconnect event).
TestClient.prototype._connect = function () {
  logger.debug('connected to the test server');
  this._newConnection();
}
TestClient.prototype._reconnect = function () {
  logger.debug('reconnected to the test server');
  this._newConnection();
}

TestClient.prototype._newConnection = function () {
  assert(
    this._state === TestClient.states.created ||
    this._state === TestClient.states.connected,
    'we should be in created or connected state'
  );
  this._state = TestClient.states.connected;

  this._emit('present', JSON.stringify({
    name: testUtils.getName(),
    uuid: this._uuid,
    type: 'unittest',

    os: this._platform,
    version: this._version,
    supportedHardware: this._hasRequiredHardware,
    tests: this._testNames
  }));
}

TestClient.prototype._schedule = function (testNamesString) {
  var self = this;

  asserts.isString(testNamesString);
  var testNames = JSON.parse(testNamesString);
  asserts.arrayEquals(testNames, self._testNames);

  this._testNames.forEach(function (testName) {
    // return self._runTest(test);
  });
  this._emit('schedule_confirmed', testNamesString);
}

TestClient.prototype._discard = function () {
  var self = this;

  this._emit('discard_confirmed')
  .then(function () {
    logger.debug('device discarded as surplus from the test server');
    // We are waiting for 'disconnect' event.
    self._state = TestClient.states.completed;
  });
}

TestClient.prototype._disqualify = function () {
  var self = this;

  this._emit('disqualify_confirmed')
  .then(function () {
    logger.debug('device disqualified from the test server');

    testUtils.returnsValidNetworkStatus()
    .then(function (validStatus) {
      if (!validStatus) {
        logger.error('test client failed, network status is not valid');
        TestClient._failed();
      }
      // We are waiting for 'disconnect' event.
      self._state = TestClient.states.completed;
    });
  });
}

TestClient.prototype._disconnect = function () {
  if (this._state === TestClient.states.completed) {
    logger.debug('test client finished');
    TestClient._succeed();
  } else {
    // Just log the error since socket.io will try to reconnect.
    logger.debug('device disconnected from the test server');
  }
}

TestClient.prototype._error = function (error) {
  asserts.isString(error);
  logger.error('test client failed, error: \'%s\'', error);
  TestClient._failed();
}

TestClient.prototype._complete = function () {
  var self = this;

  this._emit('complete_confirmed')
  .then(function () {
    logger.debug('all tests completed');
    // We are waiting for 'disconnect' event.
    self._state = TestClient.states.completed;
  });
}

TestClient._failed = function () {
  process.exit(3);
}
TestClient._succeed = function () {
  process.exit(0);
}

// Emitting message to 'connected' socket without confirmation.
TestClient.prototype._emit = function (event, data) {
  var self = this;

  var timeout;
  var retryIndex = 0;

  return new Promise(function (resolve, reject) {
    function emit() {
      if (retryIndex >= self._options.emitRetryCount) {
        reject(new Error(
          'retry count exceed'
        ));
        return;
      }
      retryIndex ++;

      if (self._io.connected) {
        self._io.emit(event, data);
        resolve();
        return;
      }
      timeout = setTimeout(emit, self._options.emitRetryTimeout);
    }
    emit();
  })
  .finally(function () {
    clearTimeout(timeout);
  });
}

/*
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
      emitWhenConnected(
        testServer,
        format('setup_%s_confirmed', name)
      );

      t.on('result', function (res) {
        success = success && res.ok;
      });
      t.once('end', function () {
        if (!success) {
          allSuccess = false;
        }

        emitWhenConnected(
          testServer,
          format('setup_%s_finished', name),
          JSON.stringify({
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

    t.on('result', function (res) {
      success = success && res.ok;
    });

    t.once('end', function () {
      emitWhenConnected(
        testServer,
        format('run_%s_finished', name),
        JSON.stringify({
          success: success
        })
      );

      if (!success) {
        allSuccess = false;
      }
    });

    // Run the test (cb) when the server tells us to
    testServer.once('run_' + name, function (data) {
      emitWhenConnected(
        testServer,
        format('run_%s_confirmed', name),
        data
      );

      t.participants = JSON.parse(data);
      cb(t);
    });
  });

  tape('teardown', function (t) {
    testServer.once('teardown_' + name, function () {
      emitWhenConnected(
        testServer,
        format('teardown_%s_confirmed', name)
      );

      var success = true;
      t.on('result', function (res) {
        success = success && res.ok;
      });
      t.once('end', function () {
        if (!success) {
          allSuccess = false;
        }

        emitWhenConnected(
          testServer,
          format('teardown_%s_finished', name),
          JSON.stringify({
            success: success
          })
        );
      });
      teardown(t);
    });
  });
}

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
  emitWhenConnected(testServer, 'schedule_confirmed', schedule);
});

*/
