'use strict';

var tape = require('../lib/thaliTape');

var test = tape({
  setup: function (t) {
    t.fail('Deliberatly setup failure');
    t.end();
  },
  teardown: function (t) {
    t.end();
  }
});

test('Issue #691: test failure during setup', function (t) {
  t.end();
});

test = tape({
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    t.fail('Deliberatly teardown failure');
    t.end();
  }
});

test('Issue #691: test failure during teardown', function (t) {
  t.end();
});
