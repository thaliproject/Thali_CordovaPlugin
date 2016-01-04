var tape = require('../lib/thali-tape');

var test = tape({
  setup: function(t) {
    t.end();
  },
  teardown: function(t) {
    t.end();
  }
});

test('basic', function (t) {
  // Sanity test the test framework
  t.ok(true, "sane");
  t.end();
});

test('another', function(t) {
  t.ok(true, "sane");
  t.end();
});
