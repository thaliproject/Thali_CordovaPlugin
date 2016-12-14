'use strict';

var sinon = require('sinon');

var ThaliMobile = require('thali/NextGeneration/thaliMobile');
var ThaliMobileNativeWrapper = require('thali/NextGeneration/thaliMobileNativeWrapper');
var zombieFilter = require('thali/NextGeneration/utils/zombieFilter');

var tape = require('../lib/thaliTape');


var DEFAULT_UUID = '00000000-0000-4000-8000-000000000001';
var DEFAULT_FILTER_OPTIONS = {
  zombieTime: 60 * 1000,
  generationUpdateWindow: 1000,
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
    zombieFilter.clearCache();
    t.end();
  }
});

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


test('Always passes recreated events', function (t) {
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

test('Always passes unavailable events', function (t) {
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

test('Passes valid peers', function (t) {
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


test('Fixes generations order', function (t) {
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

test('Unavailable peer removed from filter cache', function (t) {
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

test('Filters zombies', function (t) {
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
