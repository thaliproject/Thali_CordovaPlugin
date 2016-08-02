'use strict';

var tape = require('../lib/thaliTape');
var testUtils = require('../lib/testUtils.js');

var fs = require('fs-extra-promise');
var extend = require('js-extend').extend;
var path = require('path');
var crypto = require('crypto');
var PouchDB = require('pouchdb');
var expressPouchDB = require('express-pouchdb');
var LeveldownMobile = require('leveldown-mobile');

var sinon = require('sinon');
var proxyquire = require('proxyquire').noCallThru();

var PouchDBGenerator = require('thali/NextGeneration/utils/pouchDBGenerator');
var thaliConfig = require('thali/NextGeneration/thaliConfig');
var ThaliPeerPoolDefault =
  require('thali/NextGeneration/thaliPeerPool/thaliPeerPoolDefault');

var ThaliMobile = require('thali/NextGeneration/thaliMobile');
var ThaliSendNotificationBasedOnReplication =
  require('thali/NextGeneration/replication/thaliSendNotificationBasedOnReplication');
var ThaliPullReplicationFromNotification =
  require('thali/NextGeneration/replication/thaliPullReplicationFromNotification');

// DB defaultDirectory should be unique among all tests
// and any instance of this test.
// This is especially required for tape.coordinated.
var defaultDirectory = path.join(
  testUtils.getPouchDBTestDirectory(),
  'thali-manager-db-' + testUtils.getUniqueRandomName()
);
// Thali manager will use defaultDirectory as db prefix.
thaliConfig.BASE_DB_PREFIX = defaultDirectory;

// Public base64 key for local device should be passed
// to the tape 'setup' as 'tape.data'.
// This is required for tape.coordinated server to generate participants.
var ecdhForLocalDevice = crypto.createECDH(thaliConfig.BEACON_CURVE);
ecdhForLocalDevice.generateKeys();

var test = tape({
  setup: function (t) {
    fs.ensureDirSync(defaultDirectory);
    t.end();
  },
  teardown: function (t) {
    fs.removeSync(defaultDirectory);
    t.end();
  }
});

test('test thali manager mock', function (t) {
  PouchDB = PouchDBGenerator(PouchDB, thaliConfig.BASE_DB_PREFIX, {
    defaultAdapter: LeveldownMobile
  });

  // All objects should be cloned in order to prevent
  // 'already wrapped' error by 'sinon.spy'.

  var spyExpressPouchDB = sinon.spy(expressPouchDB);
  var spyPouchDB        = sinon.spy(PouchDB);

  var ThaliMobileClone = extend({}, ThaliMobile);

  var spyMobileStart = sinon.spy(ThaliMobileClone, 'start');
  var spyMobileStop  = sinon.spy(ThaliMobileClone, 'stop');

  var spyMobileStartLA = sinon.spy(
    ThaliMobileClone, 'startListeningForAdvertisements'
  );
  var spyMobileStopLA = sinon.spy(
    ThaliMobileClone, 'stopListeningForAdvertisements'
  );

  var spyMobileStartUAA = sinon.spy(
    ThaliMobileClone, 'startUpdateAdvertisingAndListening'
  );
  var spyMobileStopUAA = sinon.spy(
    ThaliMobileClone, 'stopAdvertisingAndListening'
  );

  ThaliSendNotificationBasedOnReplication.prototype = extend(
    {},
    ThaliSendNotificationBasedOnReplication.prototype
  );
  var spyNotificationStart = sinon.spy(
    ThaliSendNotificationBasedOnReplication.prototype, 'start'
  );
  var spyNotificationStop = sinon.spy(
    ThaliSendNotificationBasedOnReplication.prototype, 'stop'
  );

  ThaliPullReplicationFromNotification.prototype = extend(
    {},
    ThaliPullReplicationFromNotification.prototype
  );
  var spyReplicationStart = sinon.spy(
    ThaliPullReplicationFromNotification.prototype, 'start'
  );
  var spyReplicationStop = sinon.spy(
    ThaliPullReplicationFromNotification.prototype, 'stop'
  );

  var dbName = testUtils.getRandomPouchDBName();

  var ThaliManagerProxyquired =
    proxyquire('thali/NextGeneration/thaliManager', {
      './replication/thaliSendNotificationBasedOnReplication':
        ThaliSendNotificationBasedOnReplication,
      './replication/thaliPullReplicationFromNotification':
        ThaliPullReplicationFromNotification,
      './thaliMobile': ThaliMobileClone
    });

  var thaliManager = new ThaliManagerProxyquired(
    spyExpressPouchDB,
    spyPouchDB,
    dbName,
    ecdhForLocalDevice,
    new ThaliPeerPoolDefault()
  );

  thaliManager.start([])
  .then(function () {
    return thaliManager.stop();
  })
  .then(function () {
    t.ok(spyExpressPouchDB.called,     'expressPouchDB has called');
    t.ok(spyExpressPouchDB.calledOnce, 'expressPouchDB has called once');
    var spyExpressPouchDBArgs = spyExpressPouchDB.getCalls()[0].args;
    t.ok(
      spyExpressPouchDBArgs.length >= 1,
      'expressPouchDB has called with >= 1 arguments'
    );
    t.equals(
      spyExpressPouchDBArgs[0],
      spyPouchDB,
      'expressPouchDB has called with PouchDB as 1-st argument'
    );

    t.ok(spyPouchDB.called,     'PouchDB has called');
    t.ok(spyPouchDB.calledOnce, 'PouchDB has called once');
    var spyPouchDBArgs = spyPouchDB.getCalls()[0].args;
    t.equals(
      spyPouchDBArgs.length,
      1,
      'PouchDB has called with 1 argument'
    );
    t.equals(
      spyPouchDBArgs[0],
      dbName,
      'PouchDB has called with dbName as 1-st argument'
    );

    t.ok(spyMobileStart.called,     'thaliMobile.start has called');
    t.ok(spyMobileStart.calledOnce, 'thaliMobile.start has called once');

    t.ok(spyMobileStop.called,     'thaliMobile.stop has called');
    t.ok(spyMobileStop.calledOnce, 'thaliMobile.stop has called once');

    t.ok(
      spyMobileStartLA.called,
      'thaliMobile.startListeningForAdvertisements has called'
    );
    t.ok(
      spyMobileStartLA.calledOnce,
      'thaliMobile.startListeningForAdvertisements has called once'
    );

    t.ok(
      spyMobileStartUAA.called,
      'thaliMobile.startUpdateAdvertisingAndListening has called'
    );
    t.ok(
      spyMobileStartUAA.calledOnce,
      'thaliMobile.startUpdateAdvertisingAndListening has called once'
    );

    t.ok(
      spyMobileStopLA.called,
      'thaliMobile.stopListeningForAdvertisements has called'
    );
    t.ok(
      spyMobileStopLA.calledOnce,
      'thaliMobile.stopListeningForAdvertisements has called once'
    );

    t.ok(
      spyMobileStopUAA.called,
      'thaliMobile.stopAdvertisingAndListening has called'
    );
    t.ok(
      spyMobileStopUAA.calledOnce,
      'thaliMobile.stopAdvertisingAndListening has called once'
    );

    t.end();
  });
});
