'use strict';

var util = require('util');
var format = util.format;

var tape = require('../lib/thaliTape');
if (!tape.coordinated) {
  return;
}

var testUtils = require('../lib/testUtils.js');

var objectAssign = require('object-assign');
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

var TEST_TIMEOUT = 5 * 60 * 1000; // 5 minutes

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
  }
});

// We have 'localDoc' and 'oldRemoteDocs' already in DB.
// We are waiting until 'newRemoteDocs' will appears in DB.
// We are waiting for confirmation that 'localDoc' and 'oldRemoteDocs' is in DB too.
function waitForRemoteDocs(pouchDB, localDoc, oldRemoteDocs, newRemoteDocs) {
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

  function allDocsFound() {
    return !localDocString &&
      newRemoteDocStrings.length === 0 &&
      oldRemoteDocStrings.length === 0;
  }

  function verifyDoc(doc) {
    var docString = toString(doc);

    var oldIndex = oldRemoteDocStrings.indexOf(docString);
    var newIndex = newRemoteDocStrings.indexOf(docString);
    if (localDocString && docString === localDocString) {
      localDocString = undefined;
    } else if (oldIndex !== - 1) {
      oldRemoteDocStrings.splice(oldIndex, 1);
    } else if (newIndex !== -1) {
      newRemoteDocStrings.splice(newIndex, 1);
    } else {
      throw new Error(format(
        'invalid doc: \'%s\', expected local doc string: \'%s\', expected old remote docs: \'%s\', expected new remote docs: \'%s\'',
        docString, localDocString, oldRemoteDocStrings.join(', '), newRemoteDocStrings.join(', ')
      ));
      return false;
    }
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
      try {
        verifyDoc(change.doc);
        if (allDocsFound()) {
          changesFeed.cancel();
        }
      } catch (_error) {
        error = _error;
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
  });
}

test('test write', function (t) {
  testUtils.testTimeout(t, TEST_TIMEOUT);

  // This function will return all participant's public keys
  // except local 'publicKeyForLocalDevice' one.
  var partnerKeys = testUtils.turnParticipantsIntoBufferArray(
    t, publicKeyForLocalDevice
  );

  // We are creating a local db for each participant.
  var pouchDB = new PouchDB(DB_NAME);

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
    return waitForRemoteDocs(pouchDB, localDoc, [], []);
  })
  .then(function () {
    // Starting Thali Manager.
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
    return waitForRemoteDocs(pouchDB, localDoc, [], docs);
  })
  .then(function () {
    t.end();
  });
});

test('test repeat write 1', function (t) {
  testUtils.testTimeout(t, TEST_TIMEOUT);

  var partnerKeys = testUtils.turnParticipantsIntoBufferArray(
    t, publicKeyForLocalDevice
  );

  // We are using an old db for each participant.
  var pouchDB = new PouchDB(DB_NAME);

  // We are getting our previous doc from a local db.
  // It should consist of it's public key (base64 representation)
  // and 1 test boolean.
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
    localDoc.test2 = true;
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
        test1: true
      };
    });
    var newDocs = partnerKeys.map(function (partnerKey) {
      return {
        _id: partnerKey.toString('base64'),
        test1: true,
        test2: true
      };
    });
    return waitForRemoteDocs(pouchDB, localDoc, oldDocs, newDocs);
  })
  .then(function () {
    t.end();
  });
});

test('test repeat write 2', function (t) {
  testUtils.testTimeout(t, TEST_TIMEOUT);

  var partnerKeys = testUtils.turnParticipantsIntoBufferArray(
    t, publicKeyForLocalDevice
  );

  // We are using an old db for each participant.
  var pouchDB = new PouchDB(DB_NAME);

  // We are getting our previous doc from a local db.
  // It should consist of it's public key (base64 representation)
  // and 2 test booleans.
  var localDoc;

  // Our partners should update its docs the same way.
  var oldDocs = partnerKeys.map(function (partnerKey) {
    return {
      _id: partnerKey.toString('base64'),
      test1: true,
      test2: true
    };
  });
  var newDocs;

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
    newDocs = oldDocs.map(function (doc) {
      return objectAssign({}, doc, {
        test3: true
      });
    });
    return waitForRemoteDocs(pouchDB, localDoc, oldDocs, newDocs)
    .then(function () {
      oldDocs = newDocs;
    });
  })

  .then(function () {
    return t.sync();
  })

  .then(function () {
    console.log('--infinite loop--');

    function sendData(index) {
      console.log('sending data for index: %d', index);
      var name = 'test' + index;
      localDoc[name] = true;

      return pouchDB.put(localDoc)
      .then(function (response) {
        localDoc._rev = response.rev;
      })

      .then(function () {
        newDocs = oldDocs.map(function (doc) {
          doc = objectAssign({}, doc);
          doc[name] = true;
          return doc;
        });
        return waitForRemoteDocs(pouchDB, localDoc, oldDocs, newDocs)
        .then(function () {
          oldDocs = newDocs;
        });
      })
      .catch(function (error) {
        console.error('received error on replication, name: \'%s\', error: \'%s\'', name, error.toString());
        return Promise.reject(error);
      })

      .then(function () {
        console.log('sent data for index: %d', index);

        return new Promise(function (resolve, reject) {
          setImmediate(function () {
            sendData(index + 1)
            .then(resolve)
            .catch(reject);
          });
        });
      });
    }
    return sendData(4);
  })

  .then(function () {
    t.pass('finished');
    t.end();
  })
  .catch(function (error) {
    t.fail('Got error ' + error.toString());
    t.end();
  });
});
