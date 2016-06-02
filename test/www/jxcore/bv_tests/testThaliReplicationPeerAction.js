'use strict';

var tape = require('../lib/thaliTape');
var net = require('net');
var thaliMobile = require('thali/NextGeneration/thaliMobile');
var expressPouchdb = require('express-pouchdb');
var crypto = require('crypto');
var thaliConfig = require('thali/NextGeneration/thaliConfig');
var Promise = require('lie');
var testUtils = require('../lib/testUtils');
var makeIntoCloseAllServer = require('thali/NextGeneration/makeIntoCloseAllServer');
var https = require('https');
var randomString = require('randomstring');
var thaliNotificationBeacons = require('thali/NextGeneration/notification/thaliNotificationBeacons');
var httpTester = require('../lib/httpTester');
var express = require('express');
var ThaliReplicationPeerAction = require('thali/NextGeneration/replication/ThaliReplicationPeerAction');
var thaliMobile = require('thali/NextGeneration/thaliMobile');

var devicePublicPrivateKey = crypto.createECDH(thaliConfig.BEACON_CURVE);
var devicePublicKey = devicePublicPrivateKey.generateKeys();
var TestPouchDB = testUtils.getLevelDownPouchDb();
var testCloseAllServer = null;
var pskId = 'yo ho ho';
var pskKey = new Buffer('Nothing going on here');
var thaliReplicationPeerAction = null;

// This is currently ignored for reasons explained
// in thaliReplicationPeerAction.start
var httpAgentPool = null;

var test = tape({
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    thaliReplicationPeerAction && thaliReplicationPeerAction.kill();
    (testCloseAllServer ? testCloseAllServer.closeAllPromise() :
      Promise.resolve())
      .catch(function (err) {
        t.fail('Got error in teardown ' + err);
      })
      .then(function () {
        testCloseAllServer = null;
        t.end();
      });
  }
});



/*
  Replication Timer:
    Start a replication that does nothing and check that we time out in a
      reasonable amount of time.
    Start a replication that replicates something, confirm that replicationTimer
      is called for each record and that we eventually time out.

  Complete
    - Once replication has started, just kill the connection
    - Test connection failure after replication has successfully started sicne
      retry means we shouldn't see that error which is bad :(

    sequence manager
      Start a replication that replicates nothing and make sure we do not
        update
      Start a replication that replicates something, confirm that update
        is called for each record

 */

function failedRequest(t, serverPort, catchHandler) {
  var notificationForUs = {
    keyId: new Buffer('abcdefg'),
    portNumber: serverPort,
    hostAddress: '127.0.0.1',
    pskIdentifyField: pskId,
    psk: pskKey,
    suggestedTCPTimeout: 10000,
    connectionType: thaliMobile.connectionTypes.TCP_NATIVE
  };
  thaliReplicationPeerAction =
    new ThaliReplicationPeerAction(notificationForUs,
      testUtils.getLevelDownPouchDb(),
      'Serverisnotthere',
      devicePublicKey);
  return thaliReplicationPeerAction.start(httpAgentPool)
    .then(function () {
      t.fail('We succeeded?');
    })
    .catch(catchHandler)
    .then(function () {
      t.end();
    });
}

test('Server is not there', function (t) {
  testCloseAllServer = makeIntoCloseAllServer(net.createServer(), true);
  testCloseAllServer.listen(0, function () {
    var serverPort = testCloseAllServer.address().port;
    // This provides a non zero probability that serverPort is available
    testCloseAllServer.closeAllPromise()
      .then(function () {
        return failedRequest(t, serverPort, function (err) {
          t.equal(err.message, 'Could not establish TCP connection',
            'right error');
        });
      })
      .catch(function (err) {
        t.fail('Got error - ' + err);
        t.end();
      });
  });
});

test('Server accepts & closes connection', function (t) {
  testCloseAllServer = makeIntoCloseAllServer(net.createServer(
    function (socket) {
      socket.end();
    }), true);
  testCloseAllServer.listen(0, function () {
    var serverPort = testCloseAllServer.address().port;
    failedRequest(t, serverPort, function (err) {
      t.equal(err.message,
        'Could establish TCP connection but couldn\'t keep it running',
        'right error');
    });
  });
});

function returnErrorCode(t, statusCode) {
  var options = {
    ciphers : thaliConfig.SUPPORTED_PSK_CIPHERS,
    pskCallback : function (id) {
      return id === pskId ? pskKey : null;
    }
  };
  testCloseAllServer = makeIntoCloseAllServer(
    https.createServer(options, function (req, res) {
      res.writeHead(statusCode, 'Nobody home');
      res.end();
    }));
  testCloseAllServer.listen(0, function () {
    var serverPort = testCloseAllServer.address().port;
    failedRequest(t, serverPort, function (err) {
      t.equal(err.status, statusCode, 'Got error as expected');
    });
  });
}

test('Server always returns 500', function (t) {
  return returnErrorCode(t, 500);
});

test('Server always returns 401', function (t) {
  return returnErrorCode(t, 401);
});

test('Server always returns 403', function (t) {
  return returnErrorCode(t, 403);
});

/*
Create docs as test starts
Have a change detector to see docs come in and when we have them all end
 */

function createDocs(pouchDB, numberDocs) {
  var promises = [];
  var docs = [];
  for(var i = 0; i < numberDocs; ++i) {
    var doc = {
      _id: '' + i,
      title: 'something ' + i
    };
    promises.push(pouchDB.put(doc));
    docs.push(doc);
  }
  return Promise.all(promises)
    .then(function () {
      return docs;
    })
}

function matchDocsInChanges(pouchDB, docs) {
  if (docs.length <= 0) {
    throw new Error('bad docs length');
  }
  var docsIndex = 0;
  return new Promise(function (resolve, reject) {
    var cancel = pouchDB.changes({
      since: 'now',
      live: true,
      include_docs: true
    }).on('change', function (change) {
      if (change.doc._id !== docs[docsIndex]._id ||
          change.doc.title !== docs[docsIndex].title) {
        cancel.cancel();
        reject('bad doc');
      }
      ++docsIndex;
      if (docsIndex === docs.length) {
        cancel.cancel();
        resolve();
      }
    }).on('complete', function () {
      // No action
    }).on ('error', function (err) {
      reject('got error ' + err);
    });
  });
}

test.only('Make sure docs replicate', function (t) {
  testCloseAllServer = testUtils.setUpServer(function (serverPort, randomDBName,
                                                       remotePouchDB) {
    var thaliReplicationPeerAction = null;
    var DifferentDirectoryPouch =
      testUtils.getPouchDBFactoryInRandomDirectory();
    createDocs(remotePouchDB, 10)
      .then(function (docs) {
        var notificationForUs = {
          keyId: new Buffer('abcdefg'),
          portNumber: serverPort,
          hostAddress: '127.0.0.1',
          pskIdentifyField: pskId,
          psk: pskKey,
          suggestedTCPTimeout: 10000,
          connectionType: thaliMobile.connectionTypes.TCP_NATIVE
        };
        var promises = [];
        thaliReplicationPeerAction =
          new ThaliReplicationPeerAction(notificationForUs,
            DifferentDirectoryPouch, randomDBName,
            devicePublicKey);
        promises.push(thaliReplicationPeerAction.start(httpAgentPool));
        promises.push(matchDocsInChanges(
          new DifferentDirectoryPouch(randomDBName), docs));
        return Promise.all(promises);
      })
      .then(function () {
        t.pass('all tests passed');
      })
      .catch(function (err) {
        t.fail('failed with ' + err);
      })
      .then(function () {
        thaliReplicationPeerAction && thaliReplicationPeerAction.kill();
        t.end();
      });
  });
});
