'use strict';

var tape = require('../lib/thaliTape');
var test = tape({

  setup: function (t) {
        t.end();
      },
  teardown: function (t) {
        t.end();
      }
});

test('The test that always pass', function (t) {
  t.ok(true);
  t.end();
});
