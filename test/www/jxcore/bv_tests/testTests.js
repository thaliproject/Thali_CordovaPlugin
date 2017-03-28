'use strict';

var tape = require('../lib/thaliTape');
var platform = require('thali/NextGeneration/utils/platform');
var Promise = require('lie');
var logger = require('thali/ThaliLogger')('testTests');

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

var testObject = {
  testSpyMethod: function() {
    logger.debug('test spy method for global sinon sansbox');
  },
  testStubMethod: function () {
    return 'test stub method for global sinon sansbox';
  }
};

var testSanboxObject = testObject;

test('test sinon sansbox spy', tape.sinonTest(function (t) {
  var spy = this.spy(testObject, 'testSpyMethod');
  testObject.testSpyMethod();
  t.equal(spy.callCount, 1,
    'test sandbox spy works correctly');
  t.end();
}));

test('test sinon sansbox stub', tape.sinonTest(function (t) {
  var callback = this.stub().returns(42);
  t.equal(callback(), 42, 'test sandbox stub works correctly');
  t.end();
}));

test('test sinon sansbox stub override', tape.sinonTest(function (t) {
  var result = testObject.testStubMethod();
  var stub = this.stub(testObject, 'testStubMethod', function () { return 'test';});
  t.notEqual(stub(), result, 'test sandbox stub works correctly');
  t.end();
}));

test('test sinon sansbox mock', tape.sinonTest(function (t) {
  var mock = this.mock(testObject);
  mock.expects('testStubMethod').twice();
  testObject.testStubMethod();
  testObject.testStubMethod();
  mock.verify();
  t.end();
}));

test('test sinon sansbox restore after test end', tape.sinonTest(function (t) {
  var result = testObject.testStubMethod();
  t.equal(result, 'test stub method for global sinon sansbox', 'test restore');
  t.end();
}));

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

if (!platform.isMobile) {
  test('can continue after disconnect from server', function (t) {
    // Android phone like to do huge amount of reconnects.
    var RECONNECT_TIMEOUT = 50;
    var RECONNECT_ATTEMPTS = 10;

    t.timeoutAfter(2 * RECONNECT_TIMEOUT * RECONNECT_ATTEMPTS + 2000);

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
