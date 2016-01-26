'use strict';

var PouchDB = require('PouchDB');
var tape = require('../lib/thali-tape');
var testUtils = require('../lib/testUtils.js');
var ThaliSendNotificationBasedOnReplication =
  require('thali/NextGeneration/thaliSendNotificationBasedOnReplication');

var test = tape({
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    t.end();
  }
});

/**
 * @cloassdesc Used to test a callback that will be called multiple times.
 *
 * @param t
 * @constructor
 */
function CallBackTestRig(t) {
  this.t = t;
}

CallBackTestRig.prototype.t = null;

CallBackTestRig.prototype.finalHandlerCalled = false;

CallBackTestRig.prototype.finalHandler = null;

CallBackTestRig.prototype._queuedEventHandlers = [];

CallBackTestRig.prototype._runFunction = function (t, fn, rawArgs) {
  var successOrFailResult = false;
  function successOrFailFunction(result) {
    successOrFailResult = result;
  }

  var newArguments = Array.prototype.push.apply(successOrFailFunction, rawArgs);
  var result = fn.apply(this, newArguments);
  t.ok(successOrFailResult, 'Handler Not Ok');
  return result;
};

CallBackTestRig.prototype.localEventHandler = function () {

  if (this.finalHandler) {
    if (this.finalHandlerCalled) {
      t.fail('We got an event after the final handler was called.');
      return;
    }

    if (this._queuedEventHandlers.length === 0) {
      var result = this._runFunction(t, this.finalHandler, arguments);
      this.finalHandlerCalled = true;
      return result;
    }
  }

  return this._runFunction(t, this._queuedEventHandlers.pop(), arguments);
};

/**
 * This is the function to be passed in the arguments provided by the callback.
 * We will insert a first argument which is a function that MUST be called
 * synchronously before the submitted fn returns that indicates if the call
 * was successful or not.
 * @param fn
 */
CallBackTestRig.prototype.nextEvent = function (fn) {
  if (this.finalHandler) {
    t.fail('Received a nextEvent call after final handler set.');
    return;
  }

  this._queuedEventHandlers.push(fn);
};

CallBackTestRig.prototype.finalEvent = function (fn) {
  if (this.finalHandler) {
    t.fail('finalEvent called more than once.');
    return;
  }

  t.finalHandler = fn;
};




test('ChangesFilter Handler', function () {

});

test('Changes timer logic', function () {

});

function FakeThaliNotificationServer(t) {
  this.t = t;
}

FakeThaliNotificationServer.prototype.t = null;

FakeThaliNotificationServer.prototype.checkNextPublicKeysToNotify = [];

FakeThaliNotificationServer.prototype.timeOfLastCallToSetBeacons = null;

FakeThaliNotificationServer.prototype.setBeacons =
  function (publicKeysToNotify) {
    this.timeOfLastCallToSetBeacons = (new Date()).getTime();
    this.t.equals(publicKeysToNotify.toString(),
                  this.checkNextPublicKeysToNotify.toString());
  };

test('End to end with empty database and empty notification db', function (t) {

  var fakeThaliNotificationServer = new FakeThaliNotificationServer(t);

  // Use a folder specific to this test so that the database content
  // will not interfere with any other databases that might be created
  // during other tests.
  var dbPath = path.join(testUtils.tmpDirectory(),
    'pouch-for-testThaliSendNotificationBasedOnReplication-test');
  var LevelDownPouchDB =
    PouchDB.defaults({db: require('leveldown-mobile'), prefix: dbPath});
  var pouchDB = new LevelDownPouchDB('EndToEnd');

  var changesFilterObject = new ChangeFilterGenerator(t);
  var changesFilter = changesFilterObject.changesFilter;

  var callbackTestRig = new CallBackTestRig(t);

  // noinspection JSCheckFunctionSignatures
  ThaliSendNotificationBasedOnReplication =
    new ThaliSendNotificationBasedOnReplication(
      fakeThaliNotificationServer,
      pouchDB,
      callbackTestRig.localEventHandler);


  var startTime = (new Date()).getTime();
  callbackTestRig.nextEvent();
  // Record current time
  // Set changesFilter to return a known set of names
  // Add a doc
  // Check that setBeacons returned the known set of names
  // Set changesFilter to return a new set of names
  //
  //

});

test('End to end with database with content and empty notification db',
  function () {

  });

test('End to end with database with content and existing notification db',
  function () {

  });
