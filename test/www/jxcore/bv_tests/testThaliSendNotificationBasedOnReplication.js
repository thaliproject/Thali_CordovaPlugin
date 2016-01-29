'use strict';

var PouchDB = require('PouchDB');
var tape = require('../lib/thali-tape');
var testUtils = require('../lib/testUtils.js');
var ThaliSendNotificationBasedOnReplication =
  require('thali/NextGeneration/thaliSendNotificationBasedOnReplication');
var proxyquire = require('proxyquire');
var sinon = require('sinon');

var test = tape({
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    t.end();
  }
});

test('ChangesFilter Handler', function () {

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
