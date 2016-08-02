'use strict';

var tape = require('../lib/thaliTape');
if (!tape.coordinated) {
  return;
}

var testUtils = require('../lib/testUtils.js');

var fs = require('fs-extra-promise');
var path = require('path');
var del = require('del');
var crypto = require('crypto');
var Promise = require('lie');
var PouchDB = require('pouchdb');
var ExpressPouchDB = require('express-pouchdb');
var LeveldownMobile = require('leveldown-mobile');

var sinon = require('sinon');
var proxyquire = require('proxyquire').noCallThru();

var PouchDBGenerator = require('thali/NextGeneration/utils/pouchDBGenerator');
var thaliConfig = require('thali/NextGeneration/thaliConfig');
var ThaliPeerPoolDefault =
  require('thali/NextGeneration/thaliPeerPool/thaliPeerPoolDefault');
var ThaliSendNotificationBasedOnReplication =
  require('thali/NextGeneration/replication/thaliSendNotificationBasedOnReplication');

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
var publicBase64KeyForLocalDevice = ecdhForLocalDevice.getPublicKey('base64');

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

test('test notifications', function (t) {
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
  // '/NotificationBeacons', '/{:db}/_changes' and others.
  sinon.stub(
    ThaliSendNotificationBasedOnReplication.prototype,
    "_findSequenceNumber"
  )
  .returns(
    Promise.resolve().then(function (result) {
      return 1;
    })
  );

  var ThaliManagerProxyquired =
  proxyquire('thali/NextGeneration/thaliManager', {
    './replication/thaliSendNotificationBasedOnReplication':
      ThaliSendNotificationBasedOnReplication
  });

  // testUtils.getRandomPouchDBName()

  new ThaliManagerProxyquired(
    ExpressPouchDB,
    PouchDB,
    "asd",
    ecdhForLocalDevice,
    new ThaliPeerPoolDefault()
  )
  .start(addressBook);
});
