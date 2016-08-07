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

var salti = require('salti');
var PouchDBGenerator = require('thali/NextGeneration/utils/pouchDBGenerator');
var thaliConfig = require('thali/NextGeneration/thaliConfig');
var ThaliManager = require('thali/NextGeneration/thaliManager');
var ThaliPeerPoolDefault =
  require('thali/NextGeneration/thaliPeerPool/thaliPeerPoolDefault');

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
    t.data = publicKeyForLocalDevice.toJSON();
    fs.ensureDirSync(defaultDirectory);
    t.end();
  },
  teardown: function (t) {
    fs.removeSync(defaultDirectory);
    t.end();
  }
});

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
