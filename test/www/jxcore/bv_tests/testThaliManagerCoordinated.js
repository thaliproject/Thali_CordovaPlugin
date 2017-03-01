'use strict';

var tape = require('../lib/thaliTape');
if (!tape.coordinated) {
  return;
}

var testUtils = require('../lib/testUtils.js');
var logger = require('../lib/testLogger.js')('testThaliManagerCoordinated');

var crypto = require('crypto');
var Promise = require('bluebird');
var PouchDB = require('pouchdb');
var ExpressPouchDB = require('express-pouchdb');

var thaliConfig = require('thali/NextGeneration/thaliConfig');
var ThaliManager = require('thali/NextGeneration/thaliManager');
var ThaliPeerPoolDefault =
  require('thali/NextGeneration/thaliPeerPool/thaliPeerPoolDefault');
var ThaliReplicationPeerAction =
  require('thali/NextGeneration/replication/thaliReplicationPeerAction');

// Public key for local device should be passed
// to the tape 'setup' as 'tape.data'.
var ecdhForLocalDevice = crypto.createECDH(thaliConfig.BEACON_CURVE);
var publicKeyForLocalDevice = ecdhForLocalDevice.generateKeys();
var publicBase64KeyForLocalDevice = ecdhForLocalDevice.getPublicKey('base64');

// PouchDB name should be the same between peers.
var DB_NAME = 'ThaliManagerCoordinated';

PouchDB = testUtils.getLevelDownPouchDb();

var thaliManager;
var originalReplicationIdle =
  ThaliReplicationPeerAction.MAX_IDLE_PERIOD_SECONDS;

var test = tape({
  setup: function (t) {
    // TODO: some requests take up to 15 seconds on iOS devices (see #1618).
    ThaliReplicationPeerAction.MAX_IDLE_PERIOD_SECONDS = 30;
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
      ThaliReplicationPeerAction.MAX_IDLE_PERIOD_SECONDS =
        originalReplicationIdle;
      t.end();
    });
  },
  // BLE or Bluetooth can sleep about 30 seconds between operations,
  // we need to increase timeouts (issue #1569).
  setupTimeout:     3 * 60 * 1000,
  testTimeout:      5 * 60 * 1000,
  teardownTimeout:  3 * 60 * 1000
});

var DEBUG = false;
function debug() {
  if (!DEBUG) {
    return;
  }
  var output = Array.prototype.map.call(arguments, function (arg) {
    if (typeof arg === 'string') {
      return arg;
    }
    try {
      return JSON.stringify(arg, null, 2);
    } catch (e) {
      return String(arg);
    }
  });
  return logger.debug(output.join(' '));
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

    if (DEBUG) {
      var originalEmit = changesFeed.emit;
      changesFeed.emit = function () {
        var args = Array.prototype.slice.call(arguments);
        debug('Changes feed emits:', args);
        return originalEmit.apply(this, args);
      };
    }
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


// Adds test1:true, test2:true, ... , testN:true fields to the provided object
function assignTestFields(n, target) {
  for (var i = 1; i <= n; i++) {
    target['test' + i] = true;
  }
  return target;
}

function runRepeats(n) {
  function testRepeatWrite(n) {
    var name = 'test repeat write ' + n;

    test(name, function (t) {
      var partnerKeys = testUtils.turnParticipantsIntoBufferArray(
        t, publicKeyForLocalDevice
      );

      // Every iteration we pull our doc from database and add one more `testX`
      // field to it and put it back. Every participant does the same. At the
      // end of the test we expect our database to update all old docs with new
      // ones for every participant (including ourselves)
      //
      // Every doc consist of participant's public key (base64 representation)
      // and n test booleans (test1:true, test2:true, ... , testn: true).
      //
      // We start listening for changes at the beginning of the test to not miss
      // any updates in the middle (I'm not sure but probably this is what was
      // happening on android devices in BOTH mode - #1781 issue)

      // We are using an old db for each participant.
      var pouchDB = new PouchDB(DB_NAME);

      // Old docs from our participants
      var oldDocs = partnerKeys.map(function (partnerKey) {
        return assignTestFields(n, {
          _id: partnerKey.toString('base64'),
        });
      });
      // New docs should have n + 1 fields
      var newDocs = partnerKeys.map(function (partnerKey) {
        return assignTestFields(n + 1, {
          _id: partnerKey.toString('base64')
        });
      });
      var ourOldDoc = assignTestFields(n, {
        _id: publicBase64KeyForLocalDevice,
      });
      var ourNewDoc = assignTestFields(n + 1, {
        _id: publicBase64KeyForLocalDevice,
      });
      var docs = oldDocs.concat(newDocs);
      docs.push(ourOldDoc, ourNewDoc);

      debug('Create waiter for docs:', docs);

      var waiter = waitForRemoteDocs(pouchDB, docs);

      var localDoc;

      thaliManager.start(partnerKeys)
      .then(function () {
        t.pass('ThaliManager started');
        return pouchDB.get(publicBase64KeyForLocalDevice);
      })
      .then(function (response) {
        t.pass('Local doc retrieved');
        localDoc = response;

        debug('LOCAL DOC:', localDoc);

        // Lets update our doc with new boolean.
        assignTestFields(n + 1, localDoc);
        debug('PUTTING UPDATED LOCAL DOC:', localDoc);
        return pouchDB.put(localDoc);
      })
      .then(function () {
        t.pass('Updated doc saved');
        debug('Waiting for docs');
        // now we are waiting to be served
        return waiter;
      })
      .then(function () {
        t.pass('Got all docs');
      })
      .catch(function (error) {
        t.fail('Got error: ' + error.message);
        debug(error.stack);
      })
      .then(function () {
        t.end();
      });
    });
  }

  // testRepeatWrite tests work only when they are running consequentially,
  // from 1 to n, because every next test depends on the fact that the previous
  // one left specific documents in the database
  for (var i = 1; i <= n; i++) {
    testRepeatWrite(i);
  }
}

runRepeats(3);
