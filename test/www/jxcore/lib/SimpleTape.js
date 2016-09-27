'use strict';

var util   = require('util');
var format = util.format;

var objectAssign = require('object-assign');
var tape         = require('tape-catch');
var assert       = require('assert');

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
  teardownTimeout:  1 * 60 * 1000
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

SimpleThaliTape.prototype._runTest = function (test) {
  var self = this;

  // Test was skipped.
  var skipped = false;

  return new Promise(function (resolve, reject) {
    function bindResult(tape, timeout) {
      tape.sync = function () {
        // noop
        return Promise.resolve();
      }

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

        if (!success) {
          var error = format(
            'test failed, name: \'%s\'',
            test.name
          );
          logger.error(error);
          reject(new Error(error));
        }
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
    }

    // TODO This can be implemented using 'tape/lib/test' directly.
    // Example is 'tape.createHarness' https://github.com/substack/tape/blob/master/index.js#L103

    tape('setup', function (tape) {
      bindResult(tape, self._options.setupTimeout);
      self._options.setup(tape);
    });

    tape(test.name, function (tape) {
      bindResult(tape, self._options.testTimeout);

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
      bindResult(tape, self._options.teardownTimeout);
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

  var skippedTests = [];
  return Promise.all(
    this._tests.map(function (test) {
      return self._runTest(test)
      .catch(function (error) {
        if (error.message === 'skipped') {
          skippedTests.push(test.name);
          return;
        }
        return Promise.reject(error);
      });
    })
  )
  .then(function () {
    return skippedTests;
  });
}

// We will run 'begin' on all 'SimpleThaliTape' instances.
SimpleThaliTape.instances = [];

SimpleThaliTape.prototype._resolveInstance = function () {
  SimpleThaliTape.instances.push(this);
}

SimpleThaliTape.begin = function (platform, version, hasRequiredHardware) {
  var thaliTapes = SimpleThaliTape.instances;
  SimpleThaliTape.instances = [];

  return Promise.all(
    thaliTapes.map(function (thaliTape) {
      return thaliTape._begin();
    })
  )
  .then(function (skippedTests) {
    logger.debug(
      'all unit tests succeeded, platformName: \'%s\'',
      platform
    );
    skippedTests = skippedTests.reduce(function (allTests, tests) {
      return allTests.concat(tests);
    }, []);
    logger.debug(
      'skipped tests: \'%s\'', JSON.stringify(skippedTests)
    );
    logger.debug('****TEST_LOGGER:[PROCESS_ON_EXIT_SUCCESS]****');
  })
  .catch(function (error) {
    logger.error(
      'failed to run unit tests, platformName: \'%s\', error: \'%s\', stack: \'%s\'',
      platform, error.toString(), error.stack
    );
    logger.debug('****TEST_LOGGER:[PROCESS_ON_EXIT_FAILED]****');
    return Promise.reject(error);
  });
}

module.exports = SimpleThaliTape;
