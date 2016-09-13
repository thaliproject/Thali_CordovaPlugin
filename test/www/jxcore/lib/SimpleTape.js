'use strict';

var util   = require('util');
var extend = util._extend;

var tape    = require('tape-catch');
var assert  = require('assert');
var Promise = require('bluebird');

var asserts   = require('./utils/asserts');
var testUtils = require('./testUtils');


var logger = testUtils.logger;

function SimpleThaliTape (options) {
  // We are calling this function directly without 'new'.
  if (!this) {
    return new SimpleThaliTape(options);
  }

  asserts.isObject(options);
  this._options = extend({}, options);

  var setup = this._options.setup;
  if (setup) {
    asserts.isFunction(setup);
  }
  var teardown = this._options.teardown;
  if (teardown) {
    asserts.isFunction(teardown);
  }

  this._tests = [];
  this._nextTestOnly = false;
  this._ignoreRemainingTests = false;

  this._state = SimpleThaliTape.states.created;

  this.resolveInstance();

  // test('name', ...) -> 'this.addTest('name, ...)'
  // test.only('name', ...) -> 'this.only('name, ...)'
  this._handler = this.addTest.bind(this);
  this._handler.only = this.only.bind(this);
  return this._handler;
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
  var setup    = this._options.setup;
  var teardown = this._options.teardown;

  return new Promise(function (resolve, reject) {
    function bindResult(tape) {
      // 'end' can be called without 'result', so success is true by default.
      // We can receive 'result' many times.
      // For example each 'tape.ok' will provide a 'result'.
      var success = true;
      tape
      .on('result', function (result) {
        if (!result.ok) {
          success = false;
        }
      })
      .once('end', function () {
        if (!success) {
          logger.error('test failed');
          reject(new Error('test failed'));
        }
      });
    }
    function bindExit(tape) {
      tape.once('end', resolve);
    }

    if (setup) {
      tape('setup', function (tape) {
        bindResult(tape);
        setup(tape);
      });
    }

    tape(test.name, function (tape) {
      if (test.expect !== undefined && test.expect !== null) {
        tape.plan(test.expect);
      }
      bindResult(tape);
      if (!teardown) {
        // 'teardown' is not defined, we can exit after test itself.
        bindExit(tape);
      }
      test.fun(tape);
    });

    if (teardown) {
      tape('teardown', function (tape) {
        bindResult(tape);
        // We should exit after test teardown.
        bindExit(tape);
        teardown(tape);
      });
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
