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

function validateDocs(pouchDB, docs, keys) {
  var allDocsFound = false;
  // We can just stringify our doc with defined keys, it wont be circular.
  var docStrings = [];
  docs.forEach(function (doc) {
    docStrings.push(JSON.stringify(doc, keys));
  });
  function findDoc(doc) {
    var docStringIndex = docStrings.indexOf(JSON.stringify(doc, keys));
    if (docStringIndex !== -1) {
      // Doc should be unique.
      docStrings.splice(docStringIndex, 1);
      if (docStrings.length === 0) {
        allDocsFound = true;
      }
      return true;
    } else {
      return false;
    }
  }

  return new Promise(function (resolve, reject) {
    // We are registering for DB changes.
    // Our task is to validate docs and exit.
    var changesFeed = pouchDB.changes({
      since: 0,
      live: true,
      include_docs: true
    })
    .on('change', function (change) {
      if (findDoc(change.doc)) {
        if (allDocsFound) {
          // We should turn 'changesFeed' off and call 'resolve' now.
          changesFeed.cancel();
        }
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
}

test('test repeat write', function (t) {
  // This function will return all participant's public keys except local 'publicKeyForLocalDevice' one.
  var partnerKeys = testUtils.turnParticipantsIntoBufferArray(t, publicKeyForLocalDevice);

  PouchDB = PouchDBGenerator(PouchDB, thaliConfig.BASE_DB_PREFIX, {
    defaultAdapter: LeveldownMobile
  });
  // We are creating a local db for each participant.
  var pouchDB = new PouchDB(DB_NAME);

  var thaliManager;
  // We are adding a simple test doc to a local db.
  // It consist of it's public key (base64 representation) and test boolean.
  var localDoc = {
    _id: publicBase64KeyForLocalDevice,
    test1: true
  };
  var docs = [localDoc];
  pouchDB.put(localDoc)
  .then(function (response) {
    // Doc and its revision is an object that could be updated and deleted later.
    localDoc._rev = response.rev;
  })
  .then(function () {
    // Our local DB should have this doc.
    return validateDocs(pouchDB, docs, ['_id', 'test1', '_rev']);
  })
  .then(function () {
    // Starting Thali Manager.
    thaliManager = new ThaliManager(
      ExpressPouchDB,
      PouchDB,
      DB_NAME,
      ecdhForLocalDevice,
      new ThaliPeerPoolDefault()
    );
    return thaliManager.start(partnerKeys);
  })
  .then(function () {
    // We can imagine what docs our partners will create.
    partnerKeys.forEach(function (partnerKey) {
      docs.push({
        _id: partnerKey.toString('base64'),
        test1: true
      });
    });
    // Lets check that all imaginary docs has been replicated to our local db.
    // We can't predict what '_rev' remote doc will have, so we shouldn't check '_rev' here.
    return validateDocs(pouchDB, docs, ['_id', 'test1']);
  })
  .then(function () {
    // Lets update our doc with new boolean.
    localDoc.test2 = true;
    return pouchDB.put(localDoc)
      .then(function(response) {
        docs[0]._rev = response.rev;
      });
  })
  .then(function () {
    // Our partners should update its docs the same way.
    docs.forEach(function(doc) {
      doc.test2 = true;
    });
    return validateDocs(pouchDB, docs, ['_id', 'test1']);
  })
  .then(function () {
    thaliManager.stop();
  })
  .then(function () {
    t.end();
  });
});
