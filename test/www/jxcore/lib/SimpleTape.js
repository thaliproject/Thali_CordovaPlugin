'use strict';

var util   = require('util');
var format = util.format;

var objectAssign = require('object-assign');
var tape         = require('tape-catch');
var assert       = require('assert');
var Promise      = require('bluebird');

var asserts   = require('./utils/asserts');
var testUtils = require('./testUtils');


var logger = testUtils.logger;

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

  this.resolveInstance();

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

SimpleThaliTape.prototype.only = function (name, expect, fun) {
  this._nextTestOnly = true;
  return this.addTest(name, expect, fun);
};

SimpleThaliTape.prototype.addTest = function (name, expect, fun) {
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

  // Users can optionally specify the number of assertions
  // expected when they define the test.
  if (!fun) {
    fun = expect;
    expect = null;
  }

  asserts.isString(name);
  asserts.isFunction(fun);
  this._tests.push({
    name: name,
    expect: expect,
    fun: fun
  });

  return this._handler;
}

SimpleThaliTape.prototype._runTest = function (test) {
  var self = this;

  return new Promise(function (resolve, reject) {
    function bindResult(tape, timeout) {
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

    tape('setup', function (tape) {
      bindResult(tape, self._options.setupTimeout);
      self._options.setup(tape);
    });

    tape(test.name, function (tape) {
      if (test.expect !== undefined && test.expect !== null) {
        tape.plan(test.expect);
      }
      bindResult(tape, self._options.testTimeout);
      test.fun(tape);
    });

    tape('teardown', function (tape) {
      bindResult(tape, self._options.teardownTimeout);
      tape.once('end', resolve);
      self._options.teardown(tape);
    });
  });
}

SimpleThaliTape.prototype._begin = function () {
  var self = this;
  assert(
    this._state === SimpleThaliTape.states.created,
    'we should be in created state'
  );
  this._state = SimpleThaliTape.states.started;

  var promises = this._tests.map(function (test) {
    return self._runTest(test);
  });
  return Promise.all(promises);
}

// We will run 'begin' on all 'SimpleThaliTape' instances.
SimpleThaliTape.instances = [];

SimpleThaliTape.prototype.resolveInstance = function () {
  SimpleThaliTape.instances.push(this);
}

SimpleThaliTape.begin = function (platform, version, hasRequiredHardware) {
  var promises = SimpleThaliTape.instances.map(function (thaliTape) {
    return thaliTape._begin();
  });
  SimpleThaliTape.instances = [];

  return Promise.all(promises)
  .then(function () {
    logger.debug('all tests succeed');
    logger.debug('****TEST_LOGGER:[PROCESS_ON_EXIT_SUCCESS]****');
  })
  .catch(function (error) {
    logger.error(
      'tests failed, error: \'%s\', stack: \'%s\'',
      error.toString(), error.stack
    );
    logger.debug('****TEST_LOGGER:[PROCESS_ON_EXIT_FAILED]****');
    return Promise.reject(error);
  });
}

module.exports = SimpleThaliTape;
