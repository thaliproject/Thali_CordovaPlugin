'use strict';

var tape = require('../lib/thaliTape');
var compareBufferArrays =
  require('thali/NextGeneration/replication/utilities').compareBufferArrays;
var RefreshTimerManager =
  require('thali/NextGeneration/replication/utilities').RefreshTimerManager;
var TransientState =
  require('thali/NextGeneration/replication/utilities').TransientState;

var test = tape({
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    t.end();
  }
});

test('compareBufferArrays', function (t) {
  var aBoolean = true;
  var aNumber = 23;
  var buff1 = new Buffer('foo');
  var buff2 = new Buffer('bar');
  t.throws(function () {
    compareBufferArrays(aBoolean, aNumber);
  });
  t.throws(function () {
    compareBufferArrays(buff1, aNumber);
  });
  t.notOk(compareBufferArrays([buff1], [buff1, buff2]));
  t.notOk(compareBufferArrays([buff1, buff2], [buff2, buff1]));
  t.ok(compareBufferArrays([], []));
  t.ok(compareBufferArrays([buff1], [buff1]));
  t.ok(compareBufferArrays([buff1, buff2], [buff1, buff2]));
  t.end();
});

test('Call start twice and get error', function (t) {
  var rtm = new RefreshTimerManager(100, function () {});
  rtm.start();
  t.throws(function () {
    rtm.start();
  });
  t.end();
});

function loopUntilTrue(conditionFn) {
  function loop() {
    setTimeout(function () {
      if (!conditionFn()) {
        loop();
      }
    }, 2);
  }
  loop();
}

test('Start and make sure it runs', function (t) {
  var ran = false;
  var rtm = new RefreshTimerManager(1, function () { ran = true; } );
  rtm.start();
  loopUntilTrue(function () {
    if (ran) {
      t.end();
      return true;
    }
    return false;
  });
});

test('Make sure getTimeWhenRun is right after start', function (t) {
  var now = Date.now();
  var rtm = new RefreshTimerManager(100, function () {});
  rtm.start();
  t.ok(now + 110 > rtm.getTimeWhenRun() && now < rtm.getTimeWhenRun());
  t.end();
});

test('Make sure getTimeWhenRun is -1 after function is called', function (t) {
  var ran = false;
  var rtm = new RefreshTimerManager(1, function () { ran = true; });
  rtm.start();
  loopUntilTrue(function () {
    if (ran) {
      t.equal(rtm.getTimeWhenRun(), -1);
      t.end();
      return true;
    }
    return false;
  });
});

test('Make sure getTimeWhenRun is -2 when start has not been called ' +
     'and null if stop is called without running',
 function (t) {
   var rtm = new RefreshTimerManager(1, function () {});
   t.equal(rtm.getTimeWhenRun(), -2);
   rtm.stop();
   t.equal(rtm.getTimeWhenRun(), null);
   t.throws(function () {
     rtm.start();
   });
   t.end();
 });

test('Test TransientState', function (t) {
  t.throws(function () {
    /* jshint -W031 */
    new TransientState(null);
    /* jshint +W031 */
  });

  t.throws(function () {
    /* jshint -W031 */
    new TransientState(33);
    /* jshint +W031 */
  });

  var peers = ['a', 'b'];
  var transientState = new TransientState(peers);
  t.equal(transientState.prioritizedPeersToNotifyOfChanges, peers);
  t.equal(transientState.pouchDBChangesCancelObject, null);
  t.equal(transientState.beaconRefreshTimerManager, null);
  t.equal(transientState.lastTimeBeaconsWereUpdated, 0);

  var pouchCancel = false;

  transientState.pouchDBChangesCancelObject = {
    cancel: function () {
      pouchCancel = true;
    }
  };

  var beaconStop = false;

  transientState.beaconRefreshTimerManager = {
    stop: function () {
      beaconStop = true;
    }
  };

  transientState.cleanUp();

  t.ok(pouchCancel);
  t.ok(beaconStop);
  t.end();
});
