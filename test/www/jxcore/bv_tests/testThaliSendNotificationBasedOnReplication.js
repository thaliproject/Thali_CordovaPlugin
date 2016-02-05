'use strict';

var PouchDB = require('PouchDB');
var tape = require('../lib/thali-tape');
var testUtils = require('../lib/testUtils.js');
var ThaliNotificationServer =
  require('thali/NextGeneration/thaliNotificationServer');
var proxyquire = require('proxyquire');
var sinon = require('sinon');
var express = require('express');
var crypto = require('crypto');

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

function getTestPouchDBInstance(name) {
  // Use a folder specific to this test so that the database content
  // will not interfere with any other databases that might be created
  // during other tests.
  var dbPath = path.join(testUtils.tmpDirectory(),
    'pouch-for-testThaliSendNotificationBasedOnReplication-test');
  var LevelDownPouchDB =
    PouchDB.defaults({db: require('leveldown-mobile'), prefix: dbPath});
  return new LevelDownPouchDB(name);
}

/*
start with no peers then stop
 */

test('No peers', function (t) {
  var router = express.Router();
  var ecdhForLocalDevice = crypto.createECDH('secp521r1').generateKeys();
  var millisecondsUntilExpiration = 100;
  var pouchDB = getTestPouchDBInstance('nopeers');

  var mockedNotificationServer = sinon.mock(ThaliNotificationServer);
  mockedNotificationServer.expects('start').never();
  mockedNotificationServer.expects('stop').once();
  var spyMockedNotificationServer= sinon.spy(mockedNotificationServer);

  var ThaliSendNotificationBasedOnReplicationMocked =
    proxyquire('thali/NextGeneration/thaliSendNotificationBasedOnReplication',
      { 'thali/NextGeneration/taliNotificationServer':
        spyMockedNotificationServer});

  var thaliSendNotificationBasedOnReplication =
    new ThaliSendNotificationBasedOnReplicationMocked(router,
                      ecdhForLocalDevice, millisecondsUntilExpiration, pouchDB);

  thaliSendNotificationBasedOnReplication.start(null)
    .then(function () {
      return thaliSendNotificationBasedOnReplication.stop();
    }).then(function () {
      mockedNotificationServer.verify();
      t.ok(spyMockedNotificationServer.calledOnce().
      withArgs(router, ecdhForLocalDevice, millisecondsUntilExpiration));
      t.end();
  });
});

test('End to end with empty database and empty notification db', function (t) {

});

test('End to end with database with content and empty notification db',
  function () {

  });

test('End to end with database with content and existing notification db',
  function () {

  });

test('Make sure start is idempotent if called with the same arguments',
  function() {

  });
