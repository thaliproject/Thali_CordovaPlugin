'use strict';

var tape = require('../lib/thaliTape');
var Promise = require('lie');

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
    // Android phone like to do huge amount of reconnects.
    var RECONNECT_TIMEOUT = 50;
    var RECONNECT_ATTEMPTS = 100;

    t.timeoutAfter(2 * RECONNECT_TIMEOUT * RECONNECT_ATTEMPTS + 3000);

    var reconnectedTimes = 0;
    tape._testServer.on('connect', function () {
      if (reconnectedTimes === RECONNECT_ATTEMPTS - 1) {
        return;
      }
      reconnectedTimes++;
      t.ok(true, 'got connect event');
      if (reconnectedTimes === RECONNECT_ATTEMPTS - 1) {
        t.end();
      }
    });
    tape._testServer.on('reconnect', function () {
      if (reconnectedTimes === RECONNECT_ATTEMPTS - 1) {
        return;
      }
      reconnectedTimes++;
      t.ok(true, 'got reconnect event');
      if (reconnectedTimes === RECONNECT_ATTEMPTS - 1) {
        t.end();
      }
    });

    var promise = Promise.resolve();
    for (var i = 0; i < RECONNECT_ATTEMPTS; i ++) {
      promise = promise.then(function () {
        return new Promise(function (resolve) {
          tape._testServer.disconnect();
          setTimeout(function () {
            tape._testServer.connect();
            setTimeout(resolve, RECONNECT_TIMEOUT);
          }, RECONNECT_TIMEOUT);
        });
      });
    }
  });

  test('test after disconnect', function (t) {
    t.ok(true, 'worked');
    t.end();
  });
}
