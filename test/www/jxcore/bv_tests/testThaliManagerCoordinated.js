'use strict';

var tape = require('../lib/thaliTape');
if (!tape.coordinated) {
  return;
}

var testUtils = require('../lib/testUtils.js');

var fs = require('fs-extra-promise');
var path = require('path');
var crypto = require('crypto');
var Promise = require('lie');
var PouchDB = require('pouchdb');
var ExpressPouchDB = require('express-pouchdb');
var LeveldownMobile = require('leveldown-mobile');

var sinon = require('sinon');
var proxyquire = require('proxyquire').noCallThru();

var salti = require('salti');
var PouchDBGenerator = require('thali/NextGeneration/utils/pouchDBGenerator');
var thaliConfig = require('thali/NextGeneration/thaliConfig');
var ThaliManager = require('thali/NextGeneration/thaliManager');
var ThaliPeerPoolDefault =
  require('thali/NextGeneration/thaliPeerPool/thaliPeerPoolDefault');
var ThaliSendNotificationBasedOnReplication =
  require('thali/NextGeneration/replication/thaliSendNotificationBasedOnReplication');
var ThaliReplicationPeerAction =
  require('thali/NextGeneration/replication/ThaliReplicationPeerAction');

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
var publicKeyForLocalDevice = ecdhForLocalDevice.generateKeys();
var publicBase64KeyForLocalDevice = ecdhForLocalDevice.getPublicKey('base64');

// PouchDB name should be the same between peers.
var DB_NAME = 'ThaliManagerCoordinated';

var testCloseAllServer = null;

var test = tape({
  setup: function (t) {
    t.data = publicBase64KeyForLocalDevice;
    fs.ensureDirSync(defaultDirectory);
    t.end();
  },
  teardown: function (t) {
    fs.removeSync(defaultDirectory);
    t.end();
  }
});

/*
test('test bump update_seq', function (t) {
  var addressBook = [];

  if (t.participants) {
    t.participants.forEach(function (participant) {
      if (participant.data !== publicBase64KeyForLocalDevice) {
        addressBook.push(
          new Buffer(participant.data, 'base64')
        );
      }
    });
  }

  PouchDB = PouchDBGenerator(PouchDB, thaliConfig.BASE_DB_PREFIX, {
    defaultAdapter: LeveldownMobile
  });

  // We can return '1' instead of 'update_seq' in order to force
  // '/NotificationBeacons', '/{:db}/_changes', '/{:db}/_bulk_docs',
  // '/{:db}/_local/something'
  sinon.stub(
    ThaliSendNotificationBasedOnReplication.prototype,
    "_findSequenceNumber"
  )
  .returns(
    Promise.resolve().then(function (result) {
      return 1;
    })
  );

  var spySalti;
  var allRequestsStarted = new Promise(function (resolve) {
    spySalti = sinon.spy(function () {
      var saltiFilter = salti.apply(this, arguments);

      // We will wait untill all these requests will be done.
      var dbPrefix = thaliConfig.BASE_DB_PATH + '/' + DB_NAME + '/';
      var done = 0;
      return function (req) {
        if (req.path === '/NotificationBeacons') {
          done |= 1;
        } else if (req.path === dbPrefix + '_changes') {
          done |= 1 << 1;
        } else if (req.path === dbPrefix + '_bulk_docs') {
          done |= 1 << 2;
        } else if (req.path.indexOf(dbPrefix + '_local') === 0) {
          done |= 1 << 3;
        }
        if (done === 0xf) {
          done = -1;
          // Give sequence updater time to run before killing everything
          setTimeout(function () {
            resolve();
          }, ThaliReplicationPeerAction.pushLastSyncUpdateMilliseconds);
        }
        return saltiFilter.apply(this, arguments);
      };
    });
  });

  var ThaliManagerProxyquired =
  proxyquire('thali/NextGeneration/thaliManager', {
    './replication/thaliSendNotificationBasedOnReplication':
      ThaliSendNotificationBasedOnReplication,
    'salti': spySalti
  });

  var thaliManager = new ThaliManagerProxyquired(
    ExpressPouchDB,
    PouchDB,
    DB_NAME,
    ecdhForLocalDevice,
    new ThaliPeerPoolDefault()
  );
  thaliManager.start(addressBook)

  .then(function () {
    t.ok(spySalti.called, 'salti has called');
    spySalti.getCalls().forEach(function (data) {
      t.equals(
        data.args[0], DB_NAME,
        'salti has called with DB_NAME as a first argument'
      );
    });
  })
  .then(function () {
    return allRequestsStarted;
  })
  .then(function () {
    return thaliManager.stop();
  })
  .then(function () {
    t.end();
  });
});
*/

test('test repeat write', function (t) {
  PouchDB = PouchDBGenerator(PouchDB, thaliConfig.BASE_DB_PREFIX, {
    defaultAdapter: LeveldownMobile
  });
  // We are creating a local db for each participant.
  var pouchDB = new PouchDB(DB_NAME);

  var thaliManager;
  // We are adding a simple test doc to a local db for each participant.
  // It consist of it's public key and test string.
  pouchDB.put({
    _id: publicBase64KeyForLocalDevice,
    test1: true
  })
  .then(function () {
    return new Promise(function (resolve, reject) {
      // We are registering for DB changes.
      // Our task is to validate a single doc and exit.
      var changesFeed = pouchDB.changes({
        since: 0,
        live: true,
        include_docs: true
      })
      .on('change', function (change) {
        if (
          change.doc._id   === publicBase64KeyForLocalDevice &&
          change.doc.test1 === true
        ) {
          // The doc is valid.
          // We should turn 'changesFeed' off and call 'resolve' now.
          changesFeed.cancel();
        } else {
          reject('bad doc');
        }
      })
      .on('complete', function () {
        resolve();
      })
      .on('error', function (err) {
        reject('got error ' + err);
      });
    })
  })
  .then(function () {
    thaliManager = new ThaliManager(
      ExpressPouchDB,
      PouchDB,
      DB_NAME,
      ecdhForLocalDevice,
      new ThaliPeerPoolDefault()
    );
    // This function will return all participant's public keys except local 'publicKeyForLocalDevice' one.
    var partnerKeys = testUtils.turnParticipantsIntoBufferArray(t, publicKeyForLocalDevice);
    return thaliManager.start(partnerKeys);
  });
});
