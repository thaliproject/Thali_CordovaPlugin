'use strict';

var tape = require('../lib/thali-tape');

var customData = 'custom data';

var test = tape({
  setup: function (t) {
    if (tape.coordinated) {
      t.data = customData;
    }
    t.end();
  },
  teardown: function (t) {
    t.end();
  }
});

test('basic', function (t) {
  // Sanity test the test framework
  t.ok(true, 'sane');
  t.end();
});

test('another', function (t) {
  t.ok(true, 'sane');
  t.end();
});

if (!tape.coordinated) {
  return;
}

test('can pass data in setup', function (t) {
  var uuidFound = false;
  t.participants.forEach(function (participant) {
    if (tape.uuid === participant.uuid) {
      uuidFound = true;
    }
    t.ok(participant.uuid, 'test participant has uuid');
    t.equals(participant.data, customData, 'participant data matches');
  });
  t.equals(uuidFound, true, 'own UUID is found from the participants list');
  t.end();
});
