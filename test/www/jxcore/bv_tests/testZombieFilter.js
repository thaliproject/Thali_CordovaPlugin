'use strict';

var sinon = require('sinon');

var zombieFilter = require('thali/NextGeneration/utils/zombieFilter');

var tape = require('../lib/thaliTape');


var DEFAULT_UUID = '00000000-0000-4000-8000-000000000001';
var DEFAULT_FILTER_OPTIONS = {
  zombieThreshold: 500,
  maxDelay: 1000,
};
var sandbox = null;

var test = tape({
  setup: function (t) {
    sandbox = sinon.sandbox.create();
    t.end();
  },
  teardown: function (t) {
    if (sandbox) {
      sandbox.restore();
      sandbox = null;
    }
    t.end();
  }
});

function peer(id, available, generation, recreated) {
  return {
    peerIdentifier: id,
    peerAvailable: available,
    generation: generation,
    portNumber: null,
    recreated: Boolean(recreated)
  };
}

function createEmptyHandler() {
  var fn = function () {};
  fn.clearTimeout = function () {};
  return fn;
};

test('cachePeer', function (t) {
  var cache, expectedCache;

  var cachePeer = zombieFilter._cachePeer;

  var handler = createEmptyHandler();
  var handlerClearTimeoutSpy = sandbox.spy(handler, 'clearTimeout');

  // test add
  cache = {};
  expectedCache = {};
  expectedCache[DEFAULT_UUID] = {
    fakeGeneration: 0,
    nativeGeneration: 10,
    handler: handler,
  };
  cachePeer(cache, DEFAULT_UUID, 10, handler);
  t.deepEqual(cache, expectedCache, 'adds peer correctly');

  // test update (without handler overwriting)
  cache = {};
  cache[DEFAULT_UUID] = {
    fakeGeneration: 20,
    nativeGeneration: 40,
    handler: handler,
  };
  expectedCache = {};
  expectedCache[DEFAULT_UUID] = {
    fakeGeneration: 20,
    nativeGeneration: 50,
    handler: handler,
  };
  cachePeer(cache, DEFAULT_UUID, 50, handler);
  t.deepEqual(cache, expectedCache, 'updates peer correctly (same handler)');
  t.equal(handlerClearTimeoutSpy.callCount, 0, 'clearTimeout is not called');

  // test update (with handler overwriting)
  var newHandler = createEmptyHandler(2);
  cache = {};
  cache[DEFAULT_UUID] = {
    fakeGeneration: 1,
    nativeGeneration: 1,
    handler: handler,
  };
  expectedCache = {};
  expectedCache[DEFAULT_UUID] = {
    fakeGeneration: 1,
    nativeGeneration: 2,
    handler: newHandler,
  };
  cachePeer(cache, DEFAULT_UUID, 2, newHandler);
  t.deepEqual(cache, expectedCache, 'updates peer correctly (new handler)');
  t.equal(handlerClearTimeoutSpy.callCount, 1, 'clearTimeout has been called');

  t.end();
});

test('uncachePeer', function (t) {
  var cache, expectedCache;
  var uncachePeer = zombieFilter._uncachePeer;

  var handler = createEmptyHandler();
  var handlerClearTimeoutSpy = sandbox.spy(handler, 'clearTimeout');

  cache = {};
  cache[DEFAULT_UUID] = {
    fakeGeneration: 0,
    nativeGeneration: 0,
    handler: handler,
  };
  expectedCache = {};

  uncachePeer(cache, DEFAULT_UUID);
  t.deepEqual(cache, expectedCache, 'removes peer from cache');
  t.equal(handlerClearTimeoutSpy.callCount, 1, 'clearTimeout has been called');

  t.end();
});

test('clearCache', function (t) {
  var cache, expectedCache;
  var clearCache = zombieFilter._clearCache;

  var handler1 = createEmptyHandler();
  var handler1ClearTimeoutSpy = sandbox.spy(handler1, 'clearTimeout');
  var handler2 = createEmptyHandler();
  var handler2ClearTimeoutSpy = sandbox.spy(handler2, 'clearTimeout');

  cache = {
    '00000000-0000-4000-8000-000000000001': {
      fakeGeneration: 0,
      nativeGeneration: 0,
      handler: handler1,
    },
    '00000000-0000-4000-8000-000000000002': {
      fakeGeneration: 0,
      nativeGeneration: 0,
      handler: handler2,
    },
  };
  expectedCache = {};

  clearCache(cache);
  t.deepEqual(cache, expectedCache, 'removes peers from cache');
  t.equal(handler1ClearTimeoutSpy.callCount, 1,
    'clearTimeout has been called on the first peer handler');
  t.equal(handler2ClearTimeoutSpy.callCount, 1,
    'clearTimeout has been called on the second peer handler');

  t.end();
});

test('fixPeerGeneration', function (t) {
  var fixPeerGeneration = zombieFilter._fixPeerGeneration;

  var handler = createEmptyHandler();

  var cache = {};
  cache[DEFAULT_UUID] = {
    fakeGeneration: 13,
    nativeGeneration: 23,
    handler: handler,
  };

  var nativePeer = {
    peerIdentifier: DEFAULT_UUID,
    generation: 24,
    peerAvailable: true,
    portNumber: null,
  };

  var fixedPeer = fixPeerGeneration(cache, nativePeer);
  var expectedFixedPeer = {
    peerIdentifier: DEFAULT_UUID,
    generation: 13,
    peerAvailable: true,
    portNumber: null,
  };

  t.deepEqual(fixedPeer, expectedFixedPeer,
    'changes native peer generation to the fakeGeneration from cache');

  t.end();
});

test('fixPeerHandler', function (t) {
  var fixPeerHandler = zombieFilter._fixPeerHandler;

  var cache = {};
  cache[DEFAULT_UUID] = {
    fakeGeneration: 10,
    nativeGeneration: 133,
    handler: createEmptyHandler,
  };

  var nativePeer = {
    peerIdentifier: DEFAULT_UUID,
    generation: 135,
    peerAvailable: true,
    portNumber: null,
  };

  var fixedPeer = {
    peerIdentifier: DEFAULT_UUID,
    generation: 10,
    peerAvailable: true,
    portNumber: null,
  };

  var handler = sandbox.spy();
  var fixedHandler = fixPeerHandler(cache, handler);
  fixedHandler(nativePeer);

  t.equal(handler.callCount, 1, 'real handler called once');
  t.deepEqual(handler.firstCall.args[0], fixedPeer, 'called with fixed peer');
  t.equal(cache[DEFAULT_UUID].fakeGeneration, 11,
    'fake generation in cache is incremented');
  t.end();
});

test('throttle - timing', function (t) {
  sandbox.useFakeTimers();

  var fnCalls = [];
  var fn = function (id) {
    fnCalls.push([Date.now(), id]);
  };

  var throttle = zombieFilter._throttle;

  var throttledFn = throttle(fn, {
    minDelay: 100,
    maxDelay: 200,
  });


  throttledFn(1); throttledFn(2); throttledFn(3);
  sandbox.clock.tick(100);
  throttledFn(4); throttledFn(5); throttledFn(6);
  sandbox.clock.tick(100);

  throttledFn('a'); sandbox.clock.tick(50);
  throttledFn('b'); sandbox.clock.tick(50);
  throttledFn('c'); sandbox.clock.tick(50);
  throttledFn('d'); sandbox.clock.tick(50);
  throttledFn('e');
  sandbox.clock.tick(1000);

  var expectedCalls = [
    [100, 3],
    [200, 6],
    [400, 'd'],
    [500, 'e'],
  ];

  t.deepEqual(fnCalls, expectedCalls,
    'throttled function invokes original function at the correct time');
  t.end();
});

test('throttle - preserves arguments and context', function (t) {
  sandbox.useFakeTimers();
  var throttle = zombieFilter._throttle;

  var fn = sandbox.spy();
  var context = {};

  var throttledFn = throttle(fn, { minDelay: 100, maxDelay: 1000 });

  throttledFn.call(context, 'a', 'b', 'c');
  sandbox.clock.tick(100);

  t.ok(fn.firstCall, 'fn called');
  t.equals(fn.firstCall.thisValue, context, 'fn called with correct context');
  t.deepEqual(fn.firstCall.args, ['a', 'b', 'c'],
    'fn called with correct arguments');
  t.end();
});

test('throttle - options', function (t) {
  // Test multiple throttled function with different options

  sandbox.useFakeTimers();

  var fnShortCalls = [];
  var fnShort = function (id) {
    fnShortCalls.push([Date.now(), id]);
  };

  var fnLongCalls = [];
  var fnLong = function (id) {
    fnLongCalls.push([Date.now(), id]);
  };

  var throttle = zombieFilter._throttle;

  var throttledShortFn = throttle(fnShort, {
    minDelay: 50,
    maxDelay: 2000,
  });

  var throttledLongFn = throttle(fnLong, {
    minDelay: 1000,
    maxDelay: 3000,
  });

  throttledLongFn(1);
  throttledShortFn(1);

  t.deepEqual(fnShortCalls, [], 'fn with short delay never called');
  t.deepEqual(fnLongCalls, [], 'fn with long delay never called');

  sandbox.clock.tick(100);

  t.deepEqual(fnShortCalls, [[50, 1]],
    'fn with short delay called after 50 ms');
  t.deepEqual(fnLongCalls, [], 'fn with long delay never called');

  sandbox.clock.tick(1500);

  t.deepEqual(fnShortCalls, [[50, 1]],
    'fn with short delay called after 50 ms');
  t.deepEqual(fnLongCalls, [[1000, 1]],
    'fn with long delay called after 1000ms');

  var start = Date.now();

  while (Date.now() - start < 3000) {
    throttledShortFn(null);
    throttledLongFn(null);
    sandbox.clock.tick(5);
  }

  t.deepEqual(fnShortCalls, [[50, 1], [start + 2000, null]],
    'fn with short delay is called after reaching its maxDelay');
  t.deepEqual(fnLongCalls, [[1000, 1], [start + 3000, null]],
    'fn with long delay is called after reaching its maxDelay');

  t.end();
});

test('throttle - clearTimeout', function (t) {
  sandbox.useFakeTimers();

  var fn1 = sandbox.spy();
  var fn2 = sandbox.spy();
  var opts = { minDelay: 100, maxDelay: 200 };

  var throttle = zombieFilter._throttle;

  var throttledFn1 = throttle(fn1, opts);
  var throttledFn2 = throttle(fn2, opts);

  throttledFn1();
  throttledFn2();
  sandbox.clock.tick(50);
  throttledFn1.clearTimeout();
  sandbox.clock.tick(50);

  t.equal(fn1.callCount, 0, 'fn1 is not called');
  t.equal(fn2.callCount, 1, 'fn2 is called');

  t.end();
});

test('zombieFilter - options', function (t) {
  var noop = function () {};

  // min > max
  t.throws(function () {
    zombieFilter(noop, { zombieThreshold: 100, maxDelay: 50 });
  }, Error, 'minDelay > maxDelay throws');

  // wrong properties
  t.throws(function () {
    zombieFilter(noop, { hello: 'world' });
  }, Error, 'wrong options properties throw');

  // empty
  t.throws(function () {
    zombieFilter(noop);
  }, Error, 'empty options throw');

  t.end();
});

function filterEvents(clock, options, events) {
  var result = [];
  var handler = function (peer) {
    result.push(peer);
  };

  var filteredHandler = zombieFilter(handler, options);

  events.forEach(function (event) {
    var interval = event[0];
    var peer = event[1];
    clock.tick(interval);
    filteredHandler(peer);
  });

  clock.tick(options.maxDelay);
  return result;
}

test('zombieFilter - passes irrelevant events', function (t) {
  sandbox.useFakeTimers();

  var id = DEFAULT_UUID;
  // Set small interval, because these events should be ignored by filter
  var interval = 1;

  var filteredRecreateEvents = filterEvents(
    sandbox.clock,
    DEFAULT_FILTER_OPTIONS,
    [
      [interval, peer(id, true, 0,   true)],
      [interval, peer(id, true, 1,   true)],
      [interval, peer(id, true, 240, true)],
      [interval, peer(id, true, 77,  true)],
    ]
  );
  var filteredUnavailableEvents = filterEvents(
    sandbox.clock,
    DEFAULT_FILTER_OPTIONS,
    [
      [interval, peer(id, false, 0)  ],
      [interval, peer(id, false, 1)  ],
      [interval, peer(id, false, 240)],
      [interval, peer(id, false, 77) ],
    ]
  );

  t.deepEqual(filteredRecreateEvents, [
    peer(id, true,  0,   true),
    peer(id, true,  1,   true),
    peer(id, true,  240, true),
    peer(id, true,  77,  true),
  ], 'passes through recreated events');

  t.deepEqual(filteredUnavailableEvents, [
    peer(id, false, 0),
    peer(id, false, 1),
    peer(id, false, 240),
    peer(id, false, 77),
  ], 'passes through unavailable events');

  t.end();
});


test('Passes valid peers', function (t) {
  sandbox.useFakeTimers();

  var id = DEFAULT_UUID;
  var interval = DEFAULT_FILTER_OPTIONS.zombieThreshold;

  var filteredEvents = filterEvents(sandbox.clock, DEFAULT_FILTER_OPTIONS, [
    [interval, peer(id, true, 0)],
    [interval, peer(id, true, 1)],
    [interval, peer(id, true, 2)],
  ]);
  t.deepEqual(filteredEvents, [
    peer(id, true, 0),
    peer(id, true, 1),
    peer(id, true, 2),
  ], 'passes valid peers');
  t.end();
});

test('Fixes generations order', function (t) {
  sandbox.useFakeTimers();

  var id = DEFAULT_UUID;
  var interval = DEFAULT_FILTER_OPTIONS.zombieThreshold;

  var filteredEvents = filterEvents(sandbox.clock, DEFAULT_FILTER_OPTIONS, [
    [interval, peer(id, true, 1) ],
    [interval, peer(id, true, 2) ],
    [interval, peer(id, true, 3) ],
    [interval, peer(id, true, 5) ],
    [interval, peer(id, true, 8) ],
    [interval, peer(id, true, 13)],
    [interval, peer(id, true, 21)],
  ]);

  t.deepEqual(filteredEvents, [
    peer(id, true, 0),
    peer(id, true, 1),
    peer(id, true, 2),
    peer(id, true, 3),
    peer(id, true, 4),
    peer(id, true, 5),
    peer(id, true, 6),
  ], 'changes peers generations');

  t.end();
});

test('Unavailable peer removed from filter cache', function (t) {
  sandbox.useFakeTimers();

  var id = DEFAULT_UUID;
  var interval = DEFAULT_FILTER_OPTIONS.zombieThreshold;

  var filteredEvents = filterEvents(sandbox.clock, DEFAULT_FILTER_OPTIONS, [
    [interval, peer(id, true,  1)],
    [interval, peer(id, true,  2)],
    [interval, peer(id, false, null)],
    [interval, peer(id, true,  5)],
    [interval, peer(id, true,  13)],
  ]);

  t.deepEqual(filteredEvents, [
    peer(id, true,  0),
    peer(id, true,  1),
    peer(id, false, null),
    peer(id, true,  0),
    peer(id, true,  1)
  ]);

  t.end();
});

test('Different peers are handled in parallel', function (t) {
  sandbox.useFakeTimers();
  var id1 = '00000000-0000-4000-8000-000000000001';
  var id2 = '00000000-0000-4000-8000-000000000002';
  var interval = DEFAULT_FILTER_OPTIONS.zombieThreshold;

  var filteredEvents = filterEvents(sandbox.clock, DEFAULT_FILTER_OPTIONS, [
    [interval, peer(id1, true, 1)],
    [interval, peer(id1, true, 2)],
    [0,        peer(id2, true, 66)],
    [interval, peer(id1, true, 5)],
    [5,        peer(id2, true, 69)],
    [interval, peer(id2, true, 8)],
    [5,        peer(id1, true, 70)],
  ]);

  t.deepEqual(filteredEvents, [
    peer(id1, true, 0),
    peer(id1, true, 1),
    peer(id2, true, 0),
    peer(id1, true, 2),
    peer(id2, true, 1),
    peer(id2, true, 2),
    peer(id1, true, 3),
  ]);

  t.end();
});

test('Does not break order of available -> unavailable events', function (t) {
  // This case is practically impossible with android devices because we native
  // layer emits unavailable event only after some inactivity interval.
  //
  // It is here just to make sure, that unavailable events clear all pending
  // timeouts
  sandbox.useFakeTimers();

  var id = DEFAULT_UUID;
  var options = {
    zombieThreshold: 100,
    maxDelay: 1000
  };

  var filteredEvents = filterEvents(
    sandbox.clock,
    options,
    [
      // cache new peer
      [0,   peer(id, true,  1)],
      // schedule new event to be fired after 100ms
      [200, peer(id, true,  2)],
      // emit peer unavailable event before previous event passed to the real
      // handler
      [5, peer(id, false, null)],
    ]
  );

  t.deepEqual(filteredEvents, [
    peer(id, true, 0),
    peer(id, false, null),
  ]);

  t.end();
});

test('Filters zombies', function (t) {
  sandbox.useFakeTimers();

  var id = DEFAULT_UUID;
  var options = { zombieThreshold: 100, maxDelay: 1000 };
  var goodInterval = 100;
  var badInterval = 5;

  var filteredEvents = filterEvents(sandbox.clock, options, [
    [0,            peer(id, true, 1)],

    [goodInterval, peer(id, true, 2)],
    [badInterval,  peer(id, true, 3)],
    [badInterval,  peer(id, true, 4)],
    [badInterval,  peer(id, true, 5)],

    [goodInterval, peer(id, true, 6)],

    [goodInterval, peer(id, true, 7)],
    [badInterval,  peer(id, true, 8)],
  ]);

  t.deepEqual(filteredEvents, [
    peer(id, true, 0),
    peer(id, true, 1),
    peer(id, true, 2),
    peer(id, true, 3),
  ]);

  t.end();
});
