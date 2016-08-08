'use strict';

var tape = require('../lib/thaliTape');
var testUtils = require('../lib/testUtils.js');

var fs = require('fs-extra-promise');
var extend = require('js-extend').extend;
var path = require('path');
var crypto = require('crypto');
var Promise = require('lie');
var PouchDB = require('pouchdb');
var expressPouchDB = require('express-pouchdb');
var LeveldownMobile = require('leveldown-mobile');

var sinon = require('sinon');
var proxyquire = require('proxyquire').noCallThru();

var Salti = require('salti');
var PouchDBGenerator = require('thali/NextGeneration/utils/pouchDBGenerator');
var thaliConfig = require('thali/NextGeneration/thaliConfig');
var ThaliPeerPoolDefault =
  require('thali/NextGeneration/thaliPeerPool/thaliPeerPoolDefault');

var ThaliMobile = require('thali/NextGeneration/thaliMobile');
var ThaliSendNotificationBasedOnReplication =
  require('thali/NextGeneration/replication/thaliSendNotificationBasedOnReplication');
var ThaliPullReplicationFromNotification =
  require('thali/NextGeneration/replication/thaliPullReplicationFromNotification');

// DB 'defaultDirectory' should be unique among all tests
// and any instance of this test.
// This is especially required for 'tape.coordinated'.
var defaultDirectory = path.join(
  testUtils.getPouchDBTestDirectory(),
  'thali-manager-db-' + testUtils.getUniqueRandomName()
);
// Thali manager will use 'defaultDirectory' as db prefix.
thaliConfig.BASE_DB_PREFIX = defaultDirectory;

// Public key for local device should be passed
// to the tape 'setup' as 'tape.data'.
var ecdhForLocalDevice = crypto.createECDH(thaliConfig.BEACON_CURVE);
var publicKeyForLocalDevice = ecdhForLocalDevice.generateKeys();

PouchDB = PouchDBGenerator(PouchDB, thaliConfig.BASE_DB_PREFIX, {
  defaultAdapter: LeveldownMobile
});

var TEST_TIMEOUT = 5 * 60 * 1000; // 5 minutes

var test = tape({
  setup: function (t) {
    t.data = publicKeyForLocalDevice.toJSON();
    fs.ensureDirSync(defaultDirectory);
    t.end();
  },
  teardown: function (t) {
    fs.removeSync(defaultDirectory);
    t.end();
  }
});

function getMocks() {
  // All objects should be cloned in order to prevent
  // 'already wrapped' error by 'sinon.spy'.

  var spyExpressPouchDB = sinon.spy(expressPouchDB);
  var spyPouchDB        = sinon.spy(PouchDB);

  var spyThaliMobile = extend({}, ThaliMobile);

  var spyMobileStart = sinon.spy(spyThaliMobile, 'start');
  var spyMobileStop  = sinon.spy(spyThaliMobile, 'stop');

  var spyMobileStartLA = sinon.spy(
    spyThaliMobile, 'startListeningForAdvertisements'
  );
  var spyMobileStopLA = sinon.spy(
    spyThaliMobile, 'stopListeningForAdvertisements'
  );

  var spyMobileStartUAA = sinon.spy(
    spyThaliMobile, 'startUpdateAdvertisingAndListening'
  );
  var spyMobileStopUAA = sinon.spy(
    spyThaliMobile, 'stopAdvertisingAndListening'
  );

  var spyNotification = sinon.spy(
    ThaliSendNotificationBasedOnReplication
  );
  spyNotification.prototype = extend(
    {},
    ThaliSendNotificationBasedOnReplication.prototype
  );
  var spyNotificationStart = sinon.spy(
    spyNotification.prototype, 'start'
  );
  var spyNotificationStop = sinon.spy(
    spyNotification.prototype, 'stop'
  );

  var spyReplication = sinon.spy(
    ThaliPullReplicationFromNotification
  );
  spyReplication.prototype = extend(
    {},
    ThaliPullReplicationFromNotification.prototype
  );
  var spyReplicationStart = sinon.spy(
    spyReplication.prototype, 'start'
  );
  var spyReplicationStop = sinon.spy(
    spyReplication.prototype, 'stop'
  );

  var spySalti = sinon.spy(Salti);

  var spyThaliManager =
    proxyquire('thali/NextGeneration/thaliManager', {
      './replication/thaliSendNotificationBasedOnReplication':
        spyNotification,
      './replication/thaliPullReplicationFromNotification':
        spyReplication,
      './thaliMobile': spyThaliMobile,
      'salti': spySalti
    });

  return {
    expressPouchDB: spyExpressPouchDB,
    PouchDB: spyPouchDB,

    mobileStart: spyMobileStart,
    mobileStop: spyMobileStop,
    mobileStartLA: spyMobileStartLA,
    mobileStopLA: spyMobileStopLA,
    mobileStartUAA: spyMobileStartUAA,
    mobileStopUAA: spyMobileStopUAA,

    notification: spyNotification,
    notificationStart: spyNotificationStart,
    notificationStop: spyNotificationStop,

    replication: spyReplication,
    replicationStart: spyReplicationStart,
    replicationStop: spyReplicationStop,

    salti: spySalti,

    ThaliManager: spyThaliManager
  };
}

function checkExpressPouchDB(t, mocks) {
  // Testing that 'expressPouchDB' has called properly.
  t.ok(mocks.expressPouchDB.called, 'expressPouchDB has called');
  t.ok(mocks.expressPouchDB.calledOnce, 'expressPouchDB has called once');

  var args = mocks.expressPouchDB.getCalls()[0].args;
  t.ok(args.length >= 1, 'expressPouchDB has called with >= 1 arguments');

  var foundPouchDB = false;
  args.forEach(function (arg) {
    if (arg === mocks.PouchDB) {
      foundPouchDB = true;
    }
  });
  t.ok(foundPouchDB, 'expressPouchDB has called with \'PouchDB\' argument');
}

function checkPouchDB(t, mocks, dbName) {
  // Testing that 'PouchDB' has called properly.
  t.ok(mocks.PouchDB.called, 'PouchDB has called');
  t.ok(mocks.PouchDB.calledOnce, 'PouchDB has called once');

  var args = mocks.PouchDB.getCalls()[0].args;
  t.ok(args.length >= 1, 'PouchDB has called with >= 1 arguments');

  var foundDBName = false;
  args.forEach(function (arg) {
    if (arg === dbName) {
      foundDBName = true;
    }
  });
  t.ok(foundDBName, 'PouchDB has called with \'dbName\' argument');
}

function checkNotification(t, mocks, ecdhForLocalDevice) {
  // Testing that 'ThaliSendNotificationBasedOnReplication' has called properly.
  t.ok(mocks.notification.called,
    'ThaliSendNotificationBasedOnReplication has called');
  t.ok(mocks.notification.calledOnce,
    'ThaliSendNotificationBasedOnReplication has called once');

  var args = mocks.notification.getCalls()[0].args;
  t.ok(
    args.length >= 1,
    'ThaliSendNotificationBasedOnReplication has called with >= 1 arguments'
  );

  var foundEcdhForLocalDevice = false;
  args.forEach(function (arg) {
    if (arg === ecdhForLocalDevice) {
      foundEcdhForLocalDevice = true;
    }
  });
  t.ok(
    foundEcdhForLocalDevice,
    'ThaliSendNotificationBasedOnReplication has called ' +
    'with \'ecdhForLocalDevice\' argument'
  );
}

function checkReplication(t, mocks, dbName, peerPool, ecdhForLocalDevice) {
  // Testing that 'ThaliPullReplicationFromNotification' has called properly.
  t.ok(mocks.replication.called,
    'ThaliPullReplicationFromNotification has called');
  t.ok(mocks.replication.calledOnce,
    'ThaliPullReplicationFromNotification has called once');

  var args = mocks.replication.getCalls()[0].args;
  t.ok(
    args.length >= 4,
    'ThaliPullReplicationFromNotification has called with >= 4 arguments'
  );

  var foundPouchDB = false;
  var foundDBName = false;
  var foundThaliPeerPoolInterface = false;
  var foundEcdhForLocalDevice = false;
  args.forEach(function (arg) {
    switch (arg) {
      case mocks.PouchDB: {
        foundPouchDB = true;
        break;
      }
      case dbName: {
        foundDBName = true;
        break;
      }
      case peerPool: {
        foundThaliPeerPoolInterface = true;
        break;
      }
      case ecdhForLocalDevice: {
        foundEcdhForLocalDevice = true;
        break;
      }
    }
  });
  t.ok(
    foundPouchDB,
    'ThaliPullReplicationFromNotification has called with \'PouchDB\' argument'
  );
  t.ok(
    foundDBName,
    'ThaliPullReplicationFromNotification has called with \'dbName\' argument'
  );
  t.ok(
    foundThaliPeerPoolInterface,
    'ThaliPullReplicationFromNotification has called ' +
    'with \'thaliPeerPoolInterface\' argument'
  );
  t.ok(
    foundEcdhForLocalDevice,
    'ThaliPullReplicationFromNotification has called ' +
    'with \'ecdhForLocalDevice\' argument'
  );
}

function checkReplicationStart(t, mocks, remoteKeys) {
  // Testing that 'ThaliPullReplicationFromNotification.prototype.start'
  // has called properly.
  t.ok(
    mocks.replicationStart.called,
    'ThaliPullReplicationFromNotification.prototype.start has called'
  );
  t.ok(
    mocks.replicationStart.calledOnce,
    'ThaliPullReplicationFromNotification.prototype.start has called once'
  );

  var args = mocks.replicationStart.getCalls()[0].args;
  t.ok(
    args.length >= 1,
    'ThaliPullReplicationFromNotification.prototype.start ' +
    'has called with >= 1 arguments'
  );

  var foundRemoteKeys = false;
  args.forEach(function (arg) {
    if (arg === remoteKeys) {
      foundRemoteKeys = true;
    }
  });
  t.ok(
    foundRemoteKeys,
    'ThaliPullReplicationFromNotification.prototype.start ' +
    'has called with \'remoteKeys\' argument'
  );
}
function checkReplicationStop(t, mocks) {
  // Testing that 'ThaliPullReplicationFromNotification.prototype.stop'
  // has called properly.
  t.ok(
    mocks.replicationStop.called,
    'ThaliPullReplicationFromNotification.prototype.stop has called'
  );
  t.ok(
    mocks.replicationStop.calledOnce,
    'ThaliPullReplicationFromNotification.prototype.stop has called once'
  );
}

function checkNotificationStart(t, mocks, remoteKeys) {
  // Testing that 'ThaliSendNotificationBasedOnReplication.prototype.start'
  // has called properly.
  t.ok(
    mocks.notificationStart.called,
    'ThaliSendNotificationBasedOnReplication.prototype.start has called'
  );
  t.ok(
    mocks.notificationStart.calledOnce,
    'ThaliSendNotificationBasedOnReplication.prototype.start has called once'
  );

  var args = mocks.notificationStart.getCalls()[0].args;
  t.ok(
    args.length >= 1,
    'ThaliSendNotificationBasedOnReplication.prototype.start ' +
    'has called with >= 1 arguments'
  );
  
  var foundRemoteKeys = false;
  args.forEach(function (arg) {
    if (arg === remoteKeys) {
      foundRemoteKeys = true;
    }
  });
  t.ok(
    foundRemoteKeys,
    'ThaliSendNotificationBasedOnReplication.prototype.start ' +
    'has called with \'remoteKeys\' argument'
  );
}
function checkNotificationStop(t, mocks) {
  // Testing that 'ThaliSendNotificationBasedOnReplication.prototype.stop'
  // has called properly.
  t.ok(
    mocks.notificationStop.called,
    'ThaliSendNotificationBasedOnReplication.prototype.stop has called'
  );
  t.ok(
    mocks.notificationStop.calledOnce,
    'ThaliSendNotificationBasedOnReplication.prototype.stop has called once'
  );
}

function checkMobileStart(t, mocks) {
  // Testing that 'Mobile.startListeningForAdvertisements' has called properly.
  t.ok(
    mocks.mobileStartLA.called,
    'ThaliMobile.startListeningForAdvertisements has called'
  );
  t.ok(
    mocks.mobileStartLA.calledOnce,
    'ThaliMobile.startListeningForAdvertisements has called once'
  );

  // Testing that 'Mobile.startUpdateAdvertisingAndListening'
  // has called properly.
  t.ok(
    mocks.mobileStartUAA.called,
    'ThaliMobile.startUpdateAdvertisingAndListening has called'
  );
  t.ok(
    mocks.mobileStartUAA.calledOnce,
    'ThaliMobile.startUpdateAdvertisingAndListening has called once'
  );
}
function checkMobileStop(t, mocks) {
  // Testing that 'Mobile.stopListeningForAdvertisements' has called properly.
  t.ok(
    mocks.mobileStopLA.called,
    'ThaliMobile.stopListeningForAdvertisements has called'
  );
  t.ok(
    mocks.mobileStopLA.calledOnce,
    'ThaliMobile.stopListeningForAdvertisements has called once'
  );

  // Testing that 'Mobile.stopAdvertisingAndListening' has called properly.
  t.ok(
    mocks.mobileStopUAA.called,
    'ThaliMobile.stopAdvertisingAndListening has called'
  );
  t.ok(
    mocks.mobileStopUAA.calledOnce,
    'ThaliMobile.stopAdvertisingAndListening has called once'
  );
}

function checkSalti(t, mocks, dbName) {
  // Testing that 'Salti' has called properly.
  t.ok(mocks.salti.called, 'Salti has called');
  t.ok(mocks.salti.calledOnce, 'Salti has called once');

  var args = mocks.salti.getCalls()[0].args;
  t.ok(args.length >= 1, 'Salti has called with >= 1 arguments');
  
  var foundDBName = false;
  args.forEach(function (arg) {
    if (arg === dbName) {
      foundDBName = true;
    }
  });
  t.ok(foundDBName, 'Salti has called with \'dbName\' argument');
}

test('test thali manager spies', function (t) {
  var exit = testUtils.exitWithTimeout(t, TEST_TIMEOUT);

  // This function will return all participant's public keys
  // except local 'publicKeyForLocalDevice' one.
  var partnerKeys;
  if (t.coordinated) {
    partnerKeys = testUtils.turnParticipantsIntoBufferArray(
      t, publicKeyForLocalDevice
    );
  } else {
    partnerKeys = [];
  }

  var mocks = getMocks();

  // Creating thali manager with mocks.
  var dbName = testUtils.getRandomPouchDBName();
  var peerPool = new ThaliPeerPoolDefault();
  var thaliManager = new mocks.ThaliManager(
    mocks.expressPouchDB,
    mocks.PouchDB,
    dbName,
    ecdhForLocalDevice,
    peerPool
  );

  checkExpressPouchDB(t, mocks);
  checkPouchDB(t, mocks, dbName);
  checkNotification(t, mocks, ecdhForLocalDevice);
  checkReplication(t, mocks, dbName, peerPool, ecdhForLocalDevice);
  checkSalti(t, mocks, dbName);

  thaliManager.start(partnerKeys)
  .then(function () {
    checkMobileStart(t, mocks);
    checkNotificationStart(t, mocks, partnerKeys);
    checkReplicationStart(t, mocks, partnerKeys);
  })
  .then(function () {
    return thaliManager.stop();
  })
  .then(function () {
    checkMobileStop(t, mocks);
    checkNotificationStop(t, mocks);
    checkReplicationStop(t, mocks);

    exit();
  });
});

test('test thali manager multiple starts and stops', function (t) {
  var exit = testUtils.exitWithTimeout(t, TEST_TIMEOUT);

  // This function will return all participant's public keys
  // except local 'publicKeyForLocalDevice' one.
  var partnerKeys;
  if (t.coordinated) {
    partnerKeys = testUtils.turnParticipantsIntoBufferArray(
      t, publicKeyForLocalDevice
    );
  } else {
    partnerKeys = [];
  }

  var mocks = getMocks();

  // Creating thali manager with mocks.
  var dbName = testUtils.getRandomPouchDBName();
  var peerPool = new ThaliPeerPoolDefault();
  var thaliManager = new mocks.ThaliManager(
    mocks.expressPouchDB,
    mocks.PouchDB,
    dbName,
    ecdhForLocalDevice,
    peerPool
  );

  checkExpressPouchDB(t, mocks);
  checkPouchDB(t, mocks, dbName);
  checkNotification(t, mocks, ecdhForLocalDevice);
  checkReplication(t, mocks, dbName, peerPool, ecdhForLocalDevice);
  checkSalti(t, mocks, dbName);

  // Multiple parallel starts.
  Promise.all([
    thaliManager.start(partnerKeys),
    thaliManager.start(partnerKeys),
    thaliManager.start(partnerKeys)
  ])
  // Multiple serial starts.
  .then(function () {
    return thaliManager.start(partnerKeys);
  })
  .then(function () {
    return thaliManager.start(partnerKeys);
  })
  .then(function () {
    checkMobileStart(t, mocks);
    checkNotificationStart(t, mocks, partnerKeys);
    checkReplicationStart(t, mocks, partnerKeys);
  })

  // Multiple parallel stops.
  .then(function () {
    return Promise.all([
      thaliManager.stop(),
      thaliManager.stop(),
      thaliManager.stop()
    ]);
  })
  // Multiple serial stops.
  .then(function () {
    return thaliManager.stop();
  })
  .then(function () {
    return thaliManager.stop();
  })
  .then(function () {
    checkMobileStop(t, mocks);
    checkNotificationStop(t, mocks);
    checkReplicationStop(t, mocks);
  })

  // Multiple parallel starts and stops.
  // We shouldn't obtain any exception.
  .then(function () {
    return Promise.all([
      thaliManager.start(partnerKeys),
      thaliManager.stop(),
      thaliManager.start(partnerKeys),
      thaliManager.stop(),
      thaliManager.start(partnerKeys),
      thaliManager.stop()
    ]);
  })
  .then(function () {
    return Promise.all([
      thaliManager.start(partnerKeys),
      thaliManager.start(partnerKeys),
      thaliManager.start(partnerKeys),
      thaliManager.stop(),
      thaliManager.stop(),
      thaliManager.stop()
    ]);
  })
  .then(function () {
    exit();
  });
});
