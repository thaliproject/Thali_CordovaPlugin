'use strict';

var tape = require('../lib/thaliTape');
if (!tape.coordinated) {
  return;
}

var testUtils = require('../lib/testUtils.js');

var crypto = require('crypto');
var Promise = require('bluebird');
var PouchDB = require('pouchdb');
var ExpressPouchDB = require('express-pouchdb');

var thaliConfig = require('thali/NextGeneration/thaliConfig');
var ThaliManager = require('thali/NextGeneration/thaliManager');
var ThaliPeerPoolDefault =
  require('thali/NextGeneration/thaliPeerPool/thaliPeerPoolDefault');

// Public key for local device should be passed
// to the tape 'setup' as 'tape.data'.
var ecdhForLocalDevice = crypto.createECDH(thaliConfig.BEACON_CURVE);
var publicKeyForLocalDevice = ecdhForLocalDevice.generateKeys();
var publicBase64KeyForLocalDevice = ecdhForLocalDevice.getPublicKey('base64');

// PouchDB name should be the same between peers.
var DB_NAME = 'ThaliManagerCoordinated';

PouchDB = testUtils.getLevelDownPouchDb();

var thaliManager;

var test = tape({
  setup: function (t) {
    t.data = publicKeyForLocalDevice.toJSON();
    t.end();
  },
  teardown: function (t) {
    Promise.resolve()
    .then(function () {
      if (thaliManager) {
        return thaliManager.stop();
      }
    })
    .then(function () {
      t.end();
    });
  },
  // BLE or Bluetooth can sleep about 30 seconds between operations,
  // we need to increase timeouts (issue #1569).
  setupTimeout:     3 * 60 * 1000,
  testTimeout:      5 * 60 * 1000,
  teardownTimeout:  3 * 60 * 1000
});

function log() {
  var prefix = new Date().toISOString().replace(/[TZ]/g, ' ') + 'TMC-DEBUG:';
  var args = Array.prototype.slice.call(arguments);
  args.unshift(prefix);
  return console.log.apply(console, args);
}

/**
 * Deterministically transforms a PouchDB doc to a string so we can compare
 * docs for equality.
 * @param {Object} doc A doc object returned by pouchDB
 * @returns {string} A string that can be used to compare this doc to others
 */
function turnDocToString(doc) {
  var keys = Object.keys(doc);
  var keyIndex = keys.indexOf('_rev');
  if (keyIndex !== -1) {
    keys.splice(keyIndex, 1);
  }
  return JSON.stringify(doc, keys.sort());
}

/**
 * Checks that the submitted PouchDB contains exactly the docs submitted in
 * docsToFind. If any docs are found in the DB that don't match a doc in
 * docsToFind then an error will be returned. If the current contents of the
 * DB do not contain all the listed docs in docsToFind then the function will
 * wait, listening to the changes feed, until they show up.
 *
 * @param {PouchDB} pouchDB The database
 * @param {Object[]} docsToFind An array of PouchDB document objects we are
 * supposed to find in the DB.
 * @returns {Promise<?Error>} Resolves true if all docs are found and rejects
 * with an error if a problem is found such as a doc that appears in the DB
 * but isn't in docsToFind.
 */
function waitForRemoteDocs(pouchDB, docsToFind) {

  var stringifiedDocsToFind = docsToFind.map(turnDocToString);

  function allDocsFound() {
    return stringifiedDocsToFind.length === 0;
  }

  return new Promise(function (resolve, reject) {
    var error;
    var completed = false;
    function complete () {
      if (completed) {
        return;
      }
      completed = true;

      if (error) {
        reject(error);
      } else {
        resolve();
      }
    }
    var changesFeed = pouchDB.changes({
      since: 0,
      live: true,
      include_docs: true
    })
    .on('change', function (change) {
      var docIndex = stringifiedDocsToFind.indexOf(turnDocToString(change.doc));
      if (docIndex !== -1) {
        // Each doc should match exactly once so once we get a match we remove
        // the doc from the match list
        stringifiedDocsToFind.splice(docIndex, 1);
        if (allDocsFound()) {
          changesFeed.cancel();
        }
      } else {
        error = new Error('invalid doc');
        changesFeed.cancel();
      }
    })
    .on('complete', function (info) {
      if (info.errors && info.errors.length > 0) {
        error = info.errors[0];
      }
      complete();
    })
    .on('error', function (err) {
      error = err;
      complete();
    });

    var originalEmit = changesFeed.emit;
    changesFeed.emit = function () {
      var args = Array.prototype.slice.call(arguments);
      log('Changes feed emits:', args);
      return originalEmit.apply(this, args);
    };
  });
}

test('test write', function (t) {
  // This function will return all participant's public keys
  // except local 'publicKeyForLocalDevice' one.
  var partnerKeys = testUtils.turnParticipantsIntoBufferArray(
    t, publicKeyForLocalDevice
  );

  var pouchDB = new PouchDB(DB_NAME);

  var localDoc = {
    _id: publicBase64KeyForLocalDevice,
    test1: true
  };

  pouchDB.put(localDoc)
  .then(function (response) {
    localDoc._rev = response.rev;
  })
  .then(function () {
    return waitForRemoteDocs(pouchDB, [localDoc]);
  })
  .then(function () {
    t.pass('About to start thali manager');
    thaliManager = new ThaliManager(
      ExpressPouchDB,
      PouchDB,
      DB_NAME,
      ecdhForLocalDevice,
      new ThaliPeerPoolDefault(),
      global.NETWORK_TYPE
    );
    return thaliManager.start(partnerKeys);
  })
  .then(function () {
    t.pass('About to waitForRemoteDocs');
    var docs = partnerKeys.map(function (partnerKey) {
      return {
        _id: partnerKey.toString('base64'),
        test1: true
      };
    });
    docs.push(localDoc);
    return waitForRemoteDocs(pouchDB, docs);
  })
  .then(function () {
    t.pass('OK');
    t.end();
  });
});

function assignTestFields(i, target) {
  for (var j = 1; j <= i; j++) {
    target['test' + j] = true;
  }
  return target;
}

function testRepeatWrite(i) {
  var name = 'test repeat write ' + i;

  test(name, function (t) {
    var partnerKeys = testUtils.turnParticipantsIntoBufferArray(
      t, publicKeyForLocalDevice
    );

    // We are using an old db for each participant.
    var pouchDB = new PouchDB(DB_NAME);

    // Our partners should update its docs the same way.
    var oldDocs = partnerKeys.map(function (partnerKey) {
      return assignTestFields(i, {
        _id: partnerKey.toString('base64'),
      });
    });
    var newDocs = partnerKeys.map(function (partnerKey) {
      return assignTestFields(i + 1, {
        _id: partnerKey.toString('base64')
      });
    });
    var docs = oldDocs.concat(newDocs);
    docs.push(assignTestFields(i + 1, {
      _id: publicBase64KeyForLocalDevice,
    }));
    docs.push(assignTestFields(i, {
      _id: publicBase64KeyForLocalDevice,
    }));

    log('Create waiter for docs:', docs);
    var waiter = waitForRemoteDocs(pouchDB, docs);

    // We are getting our previous doc from a local db.
    // It should consist of it's public key (base64 representation)
    // and 2 test booleans.
    var localDoc;
    thaliManager.start(partnerKeys)
    .then(function () {
      t.pass('ThaliManager started');
      return pouchDB.get(publicBase64KeyForLocalDevice);
    })
    .then(function (response) {
      t.pass('Got response');
      localDoc = response;
      log('LOCAL DOC:', localDoc);

      // Lets update our doc with new boolean.
      assignTestFields(i + 1, localDoc);
      log('PUTTING UPDATED LOCAL DOC:', localDoc);
      return pouchDB.put(localDoc)
        .then(function (response) {
          log('PUT SUCCESS. RESPONSE:', response);
          localDoc._rev = response.rev;
        });
    })
    .then(function () {
      t.pass('Put updated doc');
      log('Waiting for docs');
      return waiter;
    })
    .then(function () {
      t.pass('Got all docs');
    })
    .catch(function (error) {
      t.fail('Got error: ' + error.message);
      log(error);
    })
    .then(function () {
      t.end();
    });
  });
}

testRepeatWrite(1);
testRepeatWrite(2);
testRepeatWrite(3);
testRepeatWrite(4);
testRepeatWrite(5);
testRepeatWrite(6);
testRepeatWrite(7);
testRepeatWrite(8);
testRepeatWrite(9);
testRepeatWrite(10);
