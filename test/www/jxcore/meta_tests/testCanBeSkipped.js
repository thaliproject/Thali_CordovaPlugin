'use strict';

var Promise = require('bluebird');

var tape = require('../lib/thaliTape');


var test = tape({
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    t.end();
  }
});

var PROMISE_TIMEOUT = 10;

// These tests should not be skipped.

test('we should not skip test without \'canBeSkipped\' function', function (t) {
  t.pass('passed');
  t.end();
});

test(
  'we should not skip test with \'canBeSkipped\' returned false',
  function () {
    return false;
  },
  function (t) {
    t.pass('passed');
    t.end();
  }
);

test(
  'we should not skip test with \'canBeSkipped\' returned promise with false',
  function () {
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve(false);
      }, PROMISE_TIMEOUT);
    });
  },
  function (t) {
    t.pass('passed');
    t.end();
  }
);

// These tests should be skipped.

test(
  'we should skip test with \'canBeSkipped\' returned true',
  function () {
    return true;
  },
  function (t) {
    t.fail('failed');
    t.end();
  }
);

test(
  'we should skip test with \'canBeSkipped\' returned promise with true',
  function () {
    return new Promise(function (resolve) {
      setTimeout(function () {
        resolve(true);
      }, PROMISE_TIMEOUT);
    });
  },
  function (t) {
    t.fail('failed');
    t.end();
  }
);
