'use strict';

var tape = require('../lib/thaliTape');
if (!tape.coordinated) {
  return;
}

var testUtils = require('../lib/testUtils.js');

var extend = require('js-extend').extend;
var fs = require('fs-extra-promise');
var path = require('path');
var crypto = require('crypto');
var Promise = require('lie');
var PouchDB = require('pouchdb');
var ExpressPouchDB = require('express-pouchdb');
var LeveldownMobile = require('leveldown-mobile');

var sinon = require('sinon');

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

// Public key for local device should be passed
// to the tape 'setup' as 'tape.data'.
var ecdhForLocalDevice = crypto.createECDH(thaliConfig.BEACON_CURVE);
var publicKeyForLocalDevice = ecdhForLocalDevice.generateKeys();
var publicBase64KeyForLocalDevice = ecdhForLocalDevice.getPublicKey('base64');

// PouchDB name should be the same between peers.
var DB_NAME = 'ThaliManagerCoordinated';

PouchDB = PouchDBGenerator(PouchDB, defaultDirectory, {
  defaultAdapter: LeveldownMobile
});

var thaliManager;

var TEST_TIMEOUT = 5 * 60 * 1000; // 5 minutes

var thisWasTheLastTest = false;
var test = tape({
  setup: function (t) {
    t.data = publicKeyForLocalDevice.toJSON();
    fs.ensureDirSync(defaultDirectory);
    t.end();
  },
  teardown: function (t) {
    Promise.resolve()
    .then(function () {
      // We can't stop thali manager after each test
      // because of issue #838.
      if (thaliManager) {
        return thaliManager.stop();
      }
    })
    .then(function () {
      if (thisWasTheLastTest) {
        fs.removeSync(defaultDirectory);
      }
      t.end();
    });
  }
});

// We have 'localDoc' and 'oldRemoteDocs' already in DB.
// We are waiting until 'newRemoteDocs' will appears in DB.
// We are waiting for confirmation that 'localDoc' is in DB too.
// Our changes handler should receive 'localDoc' and
// 'newRemoteDocs' only once.
// It can receive 'oldRemoteDocs' once or never.
function waitForRemoteDocs(
  pouchDB, localDoc, oldRemoteDocs, newRemoteDocs, ignoreRev
) {
  var allDocsFound = false;

  // We can remove '_rev' key from compared values.
  // We can just stringify docs, they wont be circular.
  function toString(doc) {
    var keys = Object.keys(doc);
    var keyIndex = keys.indexOf('_rev');
    if (keyIndex !== -1) {
      keys.splice(keyIndex, 1);
    }
    return JSON.stringify(doc, keys.sort());
  }

  var localDocString = toString(localDoc);
  var oldRemoteDocStrings = oldRemoteDocs.map(toString);
  var newRemoteDocStrings = newRemoteDocs.map(toString);

  function findDoc(doc) {
    var docString = toString(doc);

    var oldIndex = oldRemoteDocStrings.indexOf(docString);
    var newIndex = newRemoteDocStrings.indexOf(docString);
    if (localDocString && docString === localDocString) {
      localDocString = undefined;
      if (newRemoteDocStrings.length === 0) {
        allDocsFound = true;
      }
      return true;
    }
    else if (oldIndex !== - 1) {
      oldRemoteDocStrings.splice(oldIndex, 1);
      return true;
    } else if (newIndex !== -1) {
      newRemoteDocStrings.splice(newIndex, 1);
      if (newRemoteDocStrings.length === 0) {
        allDocsFound = true;
      }
      return true;
    } else {
      return false;
    }
  }

  return new Promise(function (resolve, reject) {
    var changesFeed = pouchDB.changes({
      since: 0,
      live: true,
      include_docs: true
    })
    .on('change', function (change) {
      if (findDoc(change.doc)) {
        if (allDocsFound) {
          changesFeed.cancel();
        }
      } else {
        changesFeed.cancel();
        reject('invalid doc');
      }
    })
    .on('complete', function () {
      resolve();
    })
    .on('error', function (err) {
      reject('got error ' + err);
    });
  });
}

test('test write', function (t) {
  var exit = testUtils.exitWithTimeout(t, TEST_TIMEOUT);

  // This function will return all participant's public keys
  // except local 'publicKeyForLocalDevice' one.
  var partnerKeys = testUtils.turnParticipantsIntoBufferArray(
    t, publicKeyForLocalDevice
  );

  // We are creating a local db for each participant.
  var pouchDB = new PouchDB(DB_NAME);

  // We are adding a simple test doc to a local db.
  // It consist of it's public key (base64 representation) and test boolean.
  var localDoc = {
    _id: publicBase64KeyForLocalDevice,
    test1: true
  };
  var docs;
  pouchDB.put(localDoc)
  .then(function (response) {
    // Doc and its revision is an object
    // that could be updated and deleted later.
    localDoc._rev = response.rev;
  })
  .then(function () {
    // Our local DB should have this doc.
    return waitForRemoteDocs(pouchDB, localDoc, [], [], false);
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
    docs = partnerKeys.map(function (partnerKey) {
      return {
        _id: partnerKey.toString('base64'),
        test1: true
      };
    });
    // Lets check that all imaginary docs has been replicated to our local db.
    // We can't predict what '_rev' remote doc will have,
    // so we shouldn't check '_rev' here.
    return waitForRemoteDocs(pouchDB, localDoc, [], docs, true);
  })
  .then(function () {
    // Lets update our doc with new boolean.
    localDoc.test2 = true;
    return pouchDB.put(localDoc)
      .then(function (response) {
        localDoc._rev = response.rev;
      });
  })
  .then(function () {
    // Our partners should update its docs the same way.
    var newDocs = docs.map(function (doc) {
      doc = extend({}, doc);
      doc.test2 = true;
      return doc;
    });
    return waitForRemoteDocs(pouchDB, localDoc, docs, newDocs, true)
      .then(function () {
        docs = newDocs;
      });
  })
  .then(function () {
    exit();
  });
});

test('test repeat write', function (t) {
  // We will make a cleanup after this test.
  thisWasTheLastTest = true;

  var exit = testUtils.exitWithTimeout(t, TEST_TIMEOUT);

  // This function will return all participant's public keys
  // except local 'publicKeyForLocalDevice' one.
  var partnerKeys = testUtils.turnParticipantsIntoBufferArray(
    t, publicKeyForLocalDevice
  );

  // We are using an old db for each participant.
  var pouchDB = new PouchDB(DB_NAME);

  // We are getting our previous doc from a local db.
  // It should consist of it's public key (base64 representation)
  // and 2 test booleans.
  var localDoc;
  thaliManager.start(partnerKeys)
  .then(function () {
    return pouchDB.get(publicBase64KeyForLocalDevice);
  })
  .then(function (response) {
    localDoc = response;
  })
  .then(function () {
    // Lets update our doc with new boolean.
    localDoc.test3 = true;
    return pouchDB.put(localDoc)
      .then(function (response) {
        localDoc._rev = response.rev;
      });
  })
  .then(function () {
    // Our partners should update its docs the same way.
    var oldDocs = partnerKeys.map(function (partnerKey) {
      return {
        _id: partnerKey.toString('base64'),
        test1: true, 
        test2: true
      };
    });
    var newDocs = partnerKeys.map(function (partnerKey) {
      return {
        _id: partnerKey.toString('base64'),
        test1: true,
        test2: true,
        test3: true
      };
    });
    return waitForRemoteDocs(pouchDB, localDoc, oldDocs, newDocs, true);
  })
  .then(function () {
    exit();
  });
});
