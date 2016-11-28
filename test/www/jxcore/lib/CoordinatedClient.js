'use strict';

var util     = require('util');
var format   = util.format;
var inherits = util.inherits;

var objectAssign   = require('object-assign');
var uuidValidate   = require('uuid-validate');
var assert         = require('assert');
var tape           = require('tape-catch');
var SocketIOClient = require('socket.io-client');
var EventEmitter   = require('events').EventEmitter;

var asserts = require('./utils/asserts');
var Promise = require('./utils/Promise');

var testUtils     = require('./testUtils');
var serverAddress = require('../server-address');

var logger = require('./testLogger')('CoordinatedClient');

var DEFAULT_SERVER_PORT = Number(process.env.COORDINATED_PORT) || 3000;


function CoordinatedClient(tests, uuid, platform, version, hasRequiredHardware,
                           nativeUTFailed) {
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

  this._tests = tests.slice();
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

  asserts.isBool(nativeUTFailed);
  this._nativeUTFailed = nativeUTFailed;

  this._state = CoordinatedClient.states.created;

  var serverUrl = 'http://' + serverAddress + ':' + DEFAULT_SERVER_PORT + '/';
  logger.info('Connecting to coordination server on ' + serverUrl);
  this._io = SocketIOClient(
    serverUrl,
    {
      reconnection: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 200,
      reconnectionDelayMax: 1000,
      randomizationFactor: 0,

      transports: ['websocket'],
      rejectUnauthorized: null
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
    .on  ('connect',           this._connect.bind(this))
    .on  ('connect_timeout',   logger.debug.bind(logger))
    .on  ('connect_error',     this._connectionError.bind(this))
    .on  ('reconnect',         this._reconnect.bind(this))
    .on  ('reconnect_error',   this._connectionError.bind(this))
    .on  ('reconnect_failed',  this._error.bind(this))
    .once('schedule',          this._schedule.bind(this))
    .on  ('discard',           this._discard.bind(this))
    .on  ('disqualify',        this._disqualify.bind(this))
    .on  ('disconnect',        this._disconnect.bind(this))
    .on  ('error',             this._error.bind(this))
    .once('complete',          this._complete.bind(this));
};

// We are having similar logic in both connect reconnect
// events, because socket.io seems to behave so that sometimes
// we get the connect event even if we have been connected before
// (and sometimes the reconnect event).
CoordinatedClient.prototype._connect = function () {
  logger.debug('connected to the test server');
  this._newConnection();
};
CoordinatedClient.prototype._reconnect = function () {
  logger.debug('reconnected to the test server');
  this._newConnection();
};

CoordinatedClient.prototype._newConnection = function () {
  assert(
    this._state === CoordinatedClient.states.created ||
    this._state === CoordinatedClient.states.connected,
    'we should be in created or connected state'
  );
  this._state = CoordinatedClient.states.connected;

  this._emit('present', {
    name:    testUtils.getName(),
    uuid:    this._uuid,
    type:    'unittest',
    tests:   this._testNames,
    os:      this._platform,
    version: this._version,
    hasRequiredHardware: this._hasRequiredHardware,
    nativeUTFailed: this._nativeUTFailed
  });
};

CoordinatedClient.prototype._schedule = function (data) {
  var self = this;

  var testNames = CoordinatedClient.getData(data);
  asserts.arrayEquals(testNames, this._testNames);

  var results = [];
  this._emit('schedule_confirmed', data)
    .then(function () {
      return Promise.all(
        self._tests.map(function (test) {
          return self._scheduleTest(test)
            .then(function () {
              results.push({
                name: test.name,
                text: 'passed'
              });
            })
            .catch(function (error) {
              if (error.message === 'skipped') {
                results.push({
                  name: test.name,
                  text: 'skipped'
                });
              } else {
                results.push({
                  name:  test.name,
                  text:  'failed',
                  error: error
                });
                return Promise.reject(error);
              }
            });
        })
      );
    })
    .finally(function () {
      var lastFailedResult;
      results.forEach(function (result) {
        if (result.text === 'failed') {
          var error = result.error;
          logger.info(
            '***TEST_LOGGER result: %s - failed, error: \'%s\', stack: \'%s\'',
            result.text, result.name, String(error), error? error.stack: ''
          );
          lastFailedResult = result;
        } else {
          logger.info('***TEST_LOGGER result: %s - %s', result.text, result.name);
        }
      });

      if (lastFailedResult) {
        logger.error('failed to run unit tests, platformName: \'%s\'', self._platform);
        self._failed(lastFailedResult.error);
      } else {
        logger.debug('all unit tests succeeded, platformName: \'%s\'', self._platform);
      }
    });
};

CoordinatedClient.prototype._discard = function (data) {
  this._emit('discard_confirmed', data)
    .then(function () {
      logger.debug('device discarded as surplus from the test server');
    });

  // We are waiting for 'disconnect' event.
  this._state = CoordinatedClient.states.completed;
};

CoordinatedClient.prototype._disqualify = function (data) {
  var self = this;

  this._emit('disqualify_confirmed', data)
    .then(function () {
      if (data) {
        var errorText = CoordinatedClient.getData(data);
        logger.error('device disqualified from the test server, reason: \'%s\'',
          errorText);
        self._failed(new Error(
          'Test client failed: ' + errorText
        ));
        return;
      }
      logger.debug('device disqualified from the test server');

      return testUtils.returnsValidNetworkStatus()
        .then(function (validStatus) {
          if (!validStatus) {
            self._failed(new Error(
              'test client failed, network status is not valid'
            ));
          }
        });
    });

  if (!data) {
    // We are waiting for 'disconnect' event.
    self._state = CoordinatedClient.states.completed;
  }
};

CoordinatedClient.prototype._disconnect = function () {
  if (this._state === CoordinatedClient.states.completed) {
    logger.debug('test client disconnected');
    this._succeed();
  } else {
    // Just log the error since socket.io will try to reconnect.
    logger.debug('device disconnected from the test server');
  }
};

CoordinatedClient.prototype._error = function (error) {
  var stack = error ? error.stack : null;
  logger.error(
    'unexpected error: \'%s\', stack: \'%s\'',
    String(error), stack
  );
  this._failed(error);
};

CoordinatedClient.prototype._connectionError = function (error) {
  var stack = error ? error.stack : null;
  var description = error ? error.description : null;
  logger.error(
    'connection error: \'%s\', description: \'%s\', stack: \'%s\'',
    String(error), description, stack
  );
  this._failed(error);
};

CoordinatedClient.prototype._complete = function (data) {
  this._emit('complete_confirmed', data)
  .then(function () {
    logger.debug('all tests completed');
  });

  // We are waiting for 'disconnect' event.
  this._state = CoordinatedClient.states.completed;
};

CoordinatedClient.prototype._succeed = function () {
  logger.debug('test client succeed');
  this._io.close();
  this.emit('finished');
};

CoordinatedClient.prototype._failed = function (error) {
  logger.debug('test client failed');
  this._io.close();
  this.emit('finished', error);
};

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
    .catch(function (error) {
      var stack = error ? error.stack : null;
      logger.error(
        'unexpected error: \'%s\', stack: \'%s\'',
        String(error), stack
      );
      return Promise.reject(error);
    })
    .finally(function () {
      clearTimeout(timeout);
    });
};

CoordinatedClient.prototype._runEvent = function (event, test) {
  var self = this;

  return new Promise(function (resolve, reject) {
    self._io.once(event, function (data) {
      self._emit(event + '_confirmed', data, test.options)
        .then(function () {
          resolve(CoordinatedClient.getData(data));
        })
        .catch(reject);
    });
  });
}

CoordinatedClient.prototype._skipEvent = function (tape, test, event, timeout) {
  var self = this;

  return this._runEvent(event, test)
    .then(function () {
      return new Promise(function (resolve, reject) {
        tape.once('end', function () {
          self._emit(event + '_skipped', undefined, test.options)
            .then(resolve)
            .catch(reject);
        });
        tape.end();
      });
    })
    .timeout(
      timeout,
      format('timeout exceed while skipping test: \'%s\'', test.name)
    );
}

CoordinatedClient.prototype._processEvent = function (tape, test, event, fun, timeout) {
  var self = this;

  return this._runEvent(event, test)
    .then(function (parsedData) {
      // Only for testing purposes.
      if (parsedData) {
        tape.participants = parsedData;
      }

      var resultHandler;
      var endHandler;

      return new Promise(function (resolve, reject) {
        // 'end' can be called without 'result', so success is true by default.
        // We can receive 'result' many times.
        // For example each 'tape.ok' will provide a 'result'.
        var success = true;
        resultHandler = function (result) {
          if (!result.ok) {
            success = false;
          }
        };
        tape.on('result', resultHandler);

        endHandler = function () {
          tape.removeListener('result', resultHandler);
          resultHandler = null;
          endHandler    = null;

          self._emit(
            event + '_finished',
            {
              success: success,
              data:    tape.data
            },
            test.options
          )
            .then(function () {
              if (success) {
                resolve(parsedData);
              } else {
                var error = format('test failed, name: \'%s\'', test.name);
                logger.error(error);
                reject(new Error(error));
              }
            })
            .catch(reject);
        };
        tape.once('end', endHandler);

        fun(tape);
      })
      .finally(function () {
        if (resultHandler) {
          tape.removeListener('result', resultHandler);
        }
        if (endHandler) {
          tape.removeListener('end', endHandler);
        }
      });
    })
    .timeout(
      timeout,
      format('timeout exceed while processing test: \'%s\'', test.name)
    );
}

CoordinatedClient.prototype._sync = function (tape, test, timeout) {
  var self = this;

  // returns something like 'at file:lineNumber'.
  function getCaller (level) {
    var traces = (new Error()).stack.split('\n');
    assert(
      traces.length > level,
      format('stack should have a least %d lines', level + 1)
    );
    return traces[level].trim();
  }
  var callerId = getCaller(3);

  return this._emit('sync', callerId, test.options)
    .then(function () {
      return self._runEvent('syncFinished', test);
    })
    .timeout(
      timeout,
      format('timeout exceed while syncing test: \'%s\'', test.name)
    );
}

CoordinatedClient.prototype._scheduleTest = function (test) {
  var self = this;

  // Test was skipped.
  var skipped = false;

  return new Promise(function (resolve, reject) {
    tape('setup', function (tape) {
      tape.sync = self._sync.bind(self, tape, test, test.options.setupTimeout);

      self._processEvent(tape, test, 'setup_' + test.name, test.options.setup,
        test.options.setupTimeout)
        .catch(reject);
    });

    tape(test.name, function (tape) {
      tape.sync = self._sync.bind(self, tape, test, test.options.testTimeout);

      Promise.try(function () {
        if (test.canBeSkipped) {
          return test.canBeSkipped();
        } else {
          return false;
        }
      })
        .then(function (canBeSkipped) {
          if (canBeSkipped) {
            logger.debug('test was skipped, name: \'%s\'', test.name);
            skipped = true;
            return self._skipEvent(tape, test, 'run_' + test.name, test.options.testTimeout);
          } else {
            return self._processEvent(tape, test, 'run_' + test.name, test.fun,
              test.options.testTimeout);
          }
        })
        .catch(reject);
    });

    tape('teardown', function (tape) {
      tape.sync = self._sync.bind(self, tape, test, test.options.teardownTimeout);

      self._processEvent(tape, test, 'teardown_' + test.name, test.options.teardown,
        test.options.teardownTimeout)
        // We should exit after test teardown.
        .then(resolve)
        .catch(reject);
    });
  })
    .then(function () {
      if (skipped) {
        return Promise.reject(
          new Error('skipped')
        );
      }
    });
};

// We should remove prefix (uuid.v4) from data.
CoordinatedClient.getData = function (data) {
  assert(
    uuidValidate(data.uuid, 4),
    'we should have a valid uuid.v4'
  );
  return data.content;
};

module.exports = CoordinatedClient;
