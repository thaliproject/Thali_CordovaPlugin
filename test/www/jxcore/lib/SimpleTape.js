'use strict';

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
  this._options = options;

  this._tests = [];
  this._nextTestOnly = false;
  this._ignoreRemainingTests = false;

  this._state = SimpleThaliTape.states.created;

  this.resolveInstance();

  // test('name', ...)
  // test.only('name', ...)
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
  var self = this;

  var setup    = this._options.setup;
  var teardown = this._options.teardown;

  return new Promise(function (resolve, reject) {
    if (setup) {
      tape('setup', function (t) {
        t.once('result', function (result) {
          if (!result.ok) {
            reject(new Error('setup failed'));
          }
        });
        asserts.isFunction(setup);
        setup.call(t, t);
      });
    }

    function exit(t) {
      t.once('end', resolve);
    }

    tape(test.name, function (t) {
      if (test.expect !== undefined && test.expect !== null) {
        t.plan(test.expect);
      }
      if (!teardown) {
        // 'teardown' is not defined, we can exit after test itself.
        exit(t);
      }
      t.once('result', function (result) {
        if (!result.ok) {
          reject(new Error('test failed'));
        }
      });
      asserts.isFunction(test.fun);
      test.fun.call(t, t);
    });

    if (teardown) {
      tape('teardown', function (t) {
        // We should exit after test teardown.
        exit(t);
        t.once('result', function (result) {
          if (!result.ok) {
            reject(new Error('teardown failed'));
          }
        });
        asserts.isFunction(teardown);
        teardown.call(t, t);
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
    return thaliTape._begin(platform, version, hasRequiredHardware);
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
