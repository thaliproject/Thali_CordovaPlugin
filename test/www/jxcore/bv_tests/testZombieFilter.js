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

var xtest = function (){};

function testScenario(t, sandbox, filterOptions, steps) {
  var realHandler = function () {};
  var realSpy = sandbox.spy(realHandler);
  var filteredHandler = zombieFilter(realSpy, filterOptions);
  var filteredSpy = sandbox.spy(filteredHandler);

  var clock = sandbox.useFakeTimers();

  steps.forEach(function (step) {
    var time = step[0];
    var event = step[1];
    var expectedFilteredEvent = step[2];

    realSpy.reset();
    filteredSpy.reset();

    clock.tick(time);

    filteredHandler(event);

    var eventString = JSON.stringify(event);

    if (step.length < 3) {
      t.equal(realSpy.callCount, 0, eventString + ' is filtered');
    } else {
      t.equal(realSpy.callCount, 1, eventString + ' is passed');
      t.deepEqual(realSpy.firstCall.args[0], expectedFilteredEvent);
    }
  });
}

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

xtest('Always passes recreated events', function (t) {
  var id = DEFAULT_UUID;
  var time = DEFAULT_FILTER_OPTIONS.generationUpdateWindow;

  testScenario(t, sandbox, DEFAULT_FILTER_OPTIONS, [
    [time, peer(id, true, 0,   true), peer(id, true, 0,   true)],
    [time, peer(id, true, 1,   true), peer(id, true, 1,   true)],
    [time, peer(id, true, 2,   true), peer(id, true, 2,   true)],
    [time, peer(id, true, 240, true), peer(id, true, 240, true)],
    [time, peer(id, true, 77,  true), peer(id, true, 77,  true)],
    [time / 100, peer(id, true, 222, true), peer(id, true, 222, true)],
    [time / 100, peer(id, true, 11,  true), peer(id, true, 11,  true)],
  ]);

  t.end();
});

xtest('Always passes unavailable events', function (t) {
  var id = DEFAULT_UUID;
  var time = DEFAULT_FILTER_OPTIONS.generationUpdateWindow;

  testScenario(t, sandbox, DEFAULT_FILTER_OPTIONS, [
    [time, peer(id, false, 0),  peer(id, false, 0)],
    [time, peer(id, false, 1),  peer(id, false, 1)],
    [time, peer(id, false, 77), peer(id, false, 77)],
    [time, peer(id, false, 1),  peer(id, false, 1)],
    [time / 100, peer(id, false, 0), peer(id, false, 0)],
    [time / 100, peer(id, false, 'anything'), peer(id, false, 'anything')],
  ]);

  t.end();
});

xtest('Passes valid peers', function (t) {
  var id = DEFAULT_UUID;
  var time = DEFAULT_FILTER_OPTIONS.generationUpdateWindow;

  testScenario(t, sandbox, DEFAULT_FILTER_OPTIONS, [
    [time, peer(id, true, 0), peer(id, true, 0)],
    [time, peer(id, true, 1), peer(id, true, 1)],
    [time, peer(id, true, 2), peer(id, true, 2)],
    [time, peer(id, true, 3), peer(id, true, 3)],
    [time, peer(id, true, 4), peer(id, true, 4)],
  ]);

  t.end();
});


xtest('Fixes generations order', function (t) {
  var id = DEFAULT_UUID;

  // We emulate the case when peer disappears for some time and then appears
  // after multiple updates on his side. So we need more time for every update
  var time = DEFAULT_FILTER_OPTIONS.generationUpdateWindow * 15;

  testScenario(t, sandbox, DEFAULT_FILTER_OPTIONS, [
    [time, peer(id, true, 1),  peer(id, true, 0)],
    [time, peer(id, true, 2),  peer(id, true, 1)],
    [time, peer(id, true, 3),  peer(id, true, 2)],
    [time, peer(id, true, 5),  peer(id, true, 3)],
    [time, peer(id, true, 8),  peer(id, true, 4)],
    [time, peer(id, true, 13), peer(id, true, 5)],
    [time, peer(id, true, 21), peer(id, true, 6)],
  ]);

  t.end();
});

xtest('Unavailable peer removed from filter cache', function (t) {
  var id = DEFAULT_UUID;
  // We emulate the case when peer disappears for some time and then appears
  // after multiple updates on his side. So we need more time for every update
  var time = DEFAULT_FILTER_OPTIONS.generationUpdateWindow * 15;

  testScenario(t, sandbox, DEFAULT_FILTER_OPTIONS, [
    [time, peer(id, true,  1),    peer(id, true,  0)],
    [time, peer(id, true,  2),    peer(id, true,  1)],
    [time, peer(id, false, null), peer(id, false, null)],
    [time, peer(id, true,  5),    peer(id, true,  0)],
    [time, peer(id, true,  13),   peer(id, true,  1)]
  ]);

  t.end();
});

xtest('Filters zombies', function (t) {
  var id = DEFAULT_UUID;
  var time = DEFAULT_FILTER_OPTIONS.generationUpdateWindow;

  testScenario(t, sandbox, DEFAULT_FILTER_OPTIONS, [
    [time, peer(id, true, 244),    peer(id, true, 0)],
    [time, peer(id, true, 245),    peer(id, true, 1)],
    [time, peer(id, true, 246),    peer(id, true, 2)],
    [time, peer(id, true, 244),    peer(id, true, 3)]
  ]);

  t.end();
});
