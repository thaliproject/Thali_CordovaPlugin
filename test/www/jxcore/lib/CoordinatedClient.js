'use strict';

var util     = require('util');
var format   = util.format;
var inherits = util.inherits;

var objectAssign   = require('object-assign');
var assert         = require('assert');
var tape           = require('tape-catch');
var Promise        = require('bluebird');
var SocketIOClient = require('socket.io-client');
var EventEmitter   = require('events').EventEmitter;

var asserts       = require('./utils/asserts');
var testUtils     = require('./testUtils');
var serverAddress = require('../server-address');


var logger = testUtils.logger;

function CoordinatedClient(tests, uuid, platform, version, hasRequiredHardware) {
  asserts.isArray(tests);
  tests.forEach(function (test) {
    asserts.isString(test.name);
    asserts.isFunction(test.fun);
    asserts.isFunction(test.options.setup);
    asserts.isFunction(test.options.teardown);
    asserts.isNumber(test.options.setupTimeout);
    asserts.isNumber(test.options.testTimeout);
    asserts.isNumber(test.options.teardownTimeout);
    asserts.isNumber(test.options.emitRetryCount);
    asserts.isNumber(test.options.emitRetryTimeout);
  });
  assert(
    tests.length > 0,
    'we should have at least one test'
  );
  // We will use emit retry options from first test as default.
  this._defaults = {
    emitRetryCount:   tests[0].options.emitRetryCount,
    emitRetryTimeout: tests[0].options.emitRetryTimeout
  };

  this._tests = tests.slice(0);
  this._testNames = this._tests.map(function (test) {
    return test.name;
  });

  asserts.isString(uuid);
  this._uuid = uuid;

  asserts.isString(platform);
  this._platform = platform;

  asserts.exists(version);
  this._version = version;

  asserts.isBool(hasRequiredHardware);
  this._hasRequiredHardware = hasRequiredHardware;

  this._state = CoordinatedClient.states.created;

  this._io = SocketIOClient(
    'http://' + serverAddress + ':' + 3000 + '/',
    {
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 200,
      reconnectionDelayMax: 1000,
      randomizationFactor: 0,

      transports: ['websocket']
    }
  );

  this._bind();
}

inherits(CoordinatedClient, EventEmitter);

CoordinatedClient.states = {
  created:   'created',
  connected: 'connected',
  completed: 'completed'
};

CoordinatedClient.prototype._bind = function () {
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
CoordinatedClient.prototype._connect = function () {
  logger.debug('connected to the test server');
  this._newConnection();
}
CoordinatedClient.prototype._reconnect = function () {
  logger.debug('reconnected to the test server');
  this._newConnection();
}

CoordinatedClient.prototype._newConnection = function () {
  assert(
    this._state === CoordinatedClient.states.created ||
    this._state === CoordinatedClient.states.connected,
    'we should be in created or connected state'
  );
  this._state = CoordinatedClient.states.connected;

  this._emit('present', JSON.stringify({
    name: testUtils.getName(),
    uuid: this._uuid,
    type: 'unittest',
    tests: this._testNames,
    os: this._platform,
    version: this._version,
    supportedHardware: this._hasRequiredHardware,
  }));
}

CoordinatedClient.prototype._schedule = function (testNamesString) {
  var self = this;

  asserts.isString(testNamesString);
  var testNames = JSON.parse(testNamesString);
  asserts.arrayEquals(testNames, this._testNames);

  var promises = this._tests.map(function (test) {
    return self._scheduleTest(test);
  });
  Promise.all(promises);

  this._emit('schedule_confirmed', testNamesString);
}

CoordinatedClient.prototype._discard = function () {
  var self = this;

  this._emit('discard_confirmed')
  .then(function () {
    logger.debug('device discarded as surplus from the test server');

    // We are waiting for 'disconnect' event.
    self._state = CoordinatedClient.states.completed;
  });
}

CoordinatedClient.prototype._disqualify = function () {
  var self = this;

  this._emit('disqualify_confirmed')
  .then(function () {
    logger.debug('device disqualified from the test server');

    testUtils.returnsValidNetworkStatus()
    .then(function (validStatus) {
      if (!validStatus) {
        self._failed(new Error(
          'test client failed, network status is not valid'
        ));
      }

      // We are waiting for 'disconnect' event.
      self._state = CoordinatedClient.states.completed;
    });
  });
}

CoordinatedClient.prototype._disconnect = function () {
  if (this._state === CoordinatedClient.states.completed) {
    logger.debug('test client disconnected');
    this._succeed();
  } else {
    // Just log the error since socket.io will try to reconnect.
    logger.debug('device disconnected from the test server');
  }
}

CoordinatedClient.prototype._error = function (error) {
  asserts.isString(error);
  this._failed(new Error(error));
}

CoordinatedClient.prototype._complete = function () {
  var self = this;

  this._emit('complete_confirmed')
  .then(function () {
    logger.debug('all tests completed');

    // We are waiting for 'disconnect' event.
    self._state = CoordinatedClient.states.completed;
  });
}

CoordinatedClient.prototype._succeed = function () {
  logger.debug('test client succeed');
  this._io.close();
  this.emit('finished');
}

CoordinatedClient.prototype._failed = function (error) {
  logger.debug('test client failed');
  this._io.close();
  this.emit('finished', error);
}

// Emitting message to 'connected' socket without confirmation.
// We will just check that socket is 'connected'.
CoordinatedClient.prototype._emit = function (event, data, externalOptions) {
  var self = this;

  var options = objectAssign({}, this._defaults, externalOptions);
  var timeout;
  var retryIndex = 0;
  data = data || '';

  return new Promise(function (resolve, reject) {
    function emit() {
      if (retryIndex >= options.emitRetryCount) {
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
      timeout = setTimeout(emit, options.emitRetryTimeout);
    }
    emit();
  })
  .finally(function () {
    clearTimeout(timeout);
  });
}

CoordinatedClient.prototype._scheduleTest = function (test) {
  var self = this;

  function processEvent(tape, event, fun, timeout) {
    return new Promise(function (resolve, reject) {
      self._io.once(event, function (data) {
        self._emit(event + '_confirmed', data, test.options);

        // 'end' can be called without 'result', so success is true by default.
        // We can receive 'result' many times.
        // For example each 'tape.ok' will provide a 'result'.
        var success = true;
        function resultHandler (result) {
          if (!result.ok) {
            success = false;
          }
        }
        tape.on('result', resultHandler);

        function endHandler () {
          clearTimeout(timer);
          tape.removeListener('result', resultHandler);

          self._emit(
            event + '_finished',
            JSON.stringify({
              'success': success,
              'data':    tape.data
            }),
            test.options
          )
          .then(function () {
            if (success) {
              resolve();
            } else {
              var error = format(
                'test failed, name: \'%s\'',
                test.name
              );
              logger.error(error);
              reject(new Error(error));
            }
          });
        }
        tape.once('end', endHandler);

        var timer = setTimeout(function () {
          tape.removeListener('result', resultHandler);
          tape.removeListener('end', endHandler);

          var error = format(
            'timeout exceed, test: \'%s\'',
            test.name
          );
          logger.error(error);
          reject(new Error(error));
        }, timeout);

        // Only for testing purposes.
        if (data) {
          tape.participants = JSON.parse(data);
        }
        fun(tape);
      });
    });
  }

  return new Promise(function (resolve, reject) {
    tape('setup', function (tape) {
      processEvent(tape, 'setup_' + test.name, test.options.setup, test.options.setupTimeout)
      .catch(function (error) {
        reject(error);
      });
    });

    tape(test.name, function (tape) {
      if (test.expect !== undefined && test.expect !== null) {
        tape.plan(test.expect);
      }
      processEvent(tape, 'run_' + test.name, test.fun, test.options.testTimeout)
      .catch(function (error) {
        reject(error);
      });
    });

    tape('teardown', function (tape) {
      processEvent(tape, 'teardown_' + test.name, test.options.teardown, test.options.teardownTimeout)
      .then(function () {
        // We should exit after test teardown.
        resolve();
      })
      .catch(function (error) {
        reject(error);
      });
    });
  });
}

module.exports = CoordinatedClient;
