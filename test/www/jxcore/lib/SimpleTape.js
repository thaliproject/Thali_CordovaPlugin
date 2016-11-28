'use strict';

var util   = require('util');
var format = util.format;

var objectAssign = require('object-assign');
var tape         = require('tape-catch');
var assert       = require('assert');
var uuid         = require('node-uuid');

var asserts = require('./utils/asserts');
var Promise = require('./utils/Promise');

var logger = require('thali/ThaliLogger')('SimpleThaliTape');


function SimpleThaliTape (options) {
  // We are calling this function directly without 'new'.
  if (!this) {
    return new SimpleThaliTape(options);
  }

  this._options = objectAssign({}, this.defaults, options);
  asserts.isFunction(this._options.setup);
  asserts.isFunction(this._options.teardown);
  asserts.isNumber(this._options.setupTimeout);
  asserts.isNumber(this._options.testTimeout);
  asserts.isNumber(this._options.teardownTimeout);

  this._tests = [];
  this._nextTestOnly = false;
  this._ignoreRemainingTests = false;

  this._state = SimpleThaliTape.states.created;

  this._resolveInstance();

  // test('name', ...)      -> 'this.addTest('name, ...)'
  // test.only('name', ...) -> 'this.only('name, ...)'
  this._handler      = this.addTest.bind(this);
  this._handler.only = this.only.bind(this);
  return this._handler;
}

SimpleThaliTape.prototype.defaults = {
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    t.end();
  },
  setupTimeout:     1 * 60 * 1000,
  testTimeout:      10 * 60 * 1000,
  teardownTimeout:  1 * 60 * 1000,

  stopAfterError: true
}

SimpleThaliTape.states = {
  created: 'created',
  started: 'started'
};

SimpleThaliTape.prototype.only = function () {
  this._nextTestOnly = true;
  return this.addTest.apply(this, arguments);
};

// 'canBeSkipped' is optional argument.
SimpleThaliTape.prototype.addTest = function (name, canBeSkipped, fun) {
  assert(
    this._state === SimpleThaliTape.states.created,
    'we should be in created state'
  );

  if (this._ignoreRemainingTests) {
    return this._handler;
  }

  if (this._nextTestOnly) {
    // Clear tests added so far.
    this._tests = [];
    this._ignoreRemainingTests = true;
  }

  if (!fun) {
    fun = canBeSkipped;
    canBeSkipped = null;
  }

  asserts.isString(name);
  asserts.isFunction(fun);
  this._tests.push({
    name: name,
    canBeSkipped: canBeSkipped,
    fun: fun
  });

  return this._handler;
}

function processResult(tape, test, timeout) {
  tape.sync = function () {
    // noop
    return Promise.resolve();
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
    }
    tape.on('result', resultHandler);

    endHandler = function () {
      tape.removeListener('result', resultHandler);
      resultHandler = null;
      endHandler    = null;

      if (success) {
        // Only for testing purposes.
        resolve(tape.data);
      } else {
        var error = format('test failed, name: \'%s\'', test.name);
        logger.error(error);
        reject(new Error(error));
      }
    }
    tape.once('end', endHandler);
  })
  .timeout(
    timeout,
    format('timeout exceed while processing result, test: \'%s\'', test.name)
  )
  .finally(function () {
    if (resultHandler) {
      tape.removeListener('result', resultHandler);
    }
    if (endHandler) {
      tape.removeListener('end', endHandler);
    }
  });
}

SimpleThaliTape.prototype._runTest = function (test) {
  var self = this;

  // Test was skipped.
  var skipped = false;

  return new Promise(function (resolve, reject) {
    // TODO This can be implemented using 'tape/lib/test' directly.
    // Example is 'tape.createHarness' https://github.com/substack/tape/blob/master/index.js#L103

    tape('setup', function (tape) {
      processResult(tape, test, self._options.setupTimeout)
        .catch(reject);

      self._options.setup(tape);
    });

    tape(test.name, function (tape) {
      processResult(tape, test, self._options.testTimeout)
        .catch(reject);

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
          tape.end();
          skipped = true;
        } else {
          return test.fun(tape);
        }
      })
      .catch(reject);
    });

    tape('teardown', function (tape) {
      processResult(tape, test, self._options.teardownTimeout)
        .catch(reject);

      tape.once('end', resolve);
      self._options.teardown(tape);
    });
  })
  .then(function () {
    if (skipped) {
      return Promise.reject(
        new Error('skipped')
      );
    }
  });
}

SimpleThaliTape.prototype._begin = function () {
  var self = this;
  assert(
    this._state === SimpleThaliTape.states.created,
    'we should be in created state'
  );
  this._state = SimpleThaliTape.states.started;

  var results  = [];
  var promises = Promise.all(
    this._tests.map(function (test) {
      return self._runTest(test)
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
            if (self._options.stopAfterError) {
              return Promise.reject(error);
            }
          }
        });
    })
  );

  return {
    results:  results,
    promises: promises
  };
}

// We will run 'begin' on all 'SimpleThaliTape' instances.
SimpleThaliTape.instances = [];

SimpleThaliTape.prototype._resolveInstance = function () {
  SimpleThaliTape.instances.push(this);
}

// Note that version, hasRequiredHardware and nativeUTFailed fields are not used and are added
// here for consistency with CoordinatedTape
SimpleThaliTape.begin = function (platform, version, hasRequiredHardware, nativeUTFailed) {
  var thaliTapes = SimpleThaliTape.instances;
  SimpleThaliTape.instances = [];

  var results = [];
  return Promise.all(
    thaliTapes.map(function (thaliTape) {
      var data = thaliTape._begin();
      results.push(data.results);
      return data.promises;
    })
  )
  .finally(function () {
    var lastFailedResult;
    results.reduce(function (allResults, results) {
      return allResults.concat(results);
    }, [])
      .forEach(function (result) {
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
      logger.error('failed to run unit tests, platformName: \'%s\'', platform);
      logger.debug('****TEST_LOGGER:[PROCESS_ON_EXIT_FAILED]****');
      return Promise.reject(lastFailedResult.error);
    } else {
      logger.debug('all unit tests succeeded, platformName: \'%s\'', platform);
      logger.debug('****TEST_LOGGER:[PROCESS_ON_EXIT_SUCCESS]****');
    }
  });
}

module.exports = SimpleThaliTape;
