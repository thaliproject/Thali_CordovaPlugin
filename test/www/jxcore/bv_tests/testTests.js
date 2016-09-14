'use strict';

var tape = require('../lib/thaliTape');

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
  console.log(JSON.stringify(t.participants));
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

if (!jxcore.utils.OSInfo().isMobile) {
  test('can continue after disconnect from server', function (t) {
    t.timeoutAfter(5000);
    var reconnected = false;
    tape._testServer.once('connect', function () {
      if (reconnected) {
        return;
      }
      reconnected = true;
      t.ok(true, 'got connect event');
      t.end();
    });
    tape._testServer.once('reconnect', function () {
      if (reconnected) {
        return;
      }
      reconnected = true;
      t.ok(true, 'got reconnect event');
      t.end();
    });
    tape._testServer.disconnect();
    setTimeout(function () {
      tape._testServer.connect();
    }, 500);
  });

  test('test after disconnect', function (t) {
    t.ok(true, 'worked');
    t.end();
  });
}
