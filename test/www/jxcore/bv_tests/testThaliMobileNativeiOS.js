'use strict';

// Issue #419
var ThaliMobile = require('thali/NextGeneration/thaliMobile');
var platform = require('thali/NextGeneration/utils/platform');
var nodeUuid = require('node-uuid');
var net = require('net');
var thaliMobileNativeTestUtils = require('../lib/thaliMobileNativeTestUtils');
var makeIntoCloseAllServer = require('thali/NextGeneration/makeIntoCloseAllServer');
var thaliMobileNativeWrapper =
  require('thali/NextGeneration/thaliMobileNativeWrapper');
var logger = require('../lib/testLogger')('testThaliMobileNativeiOS');
var Promise = require('lie');
if (global.NETWORK_TYPE === ThaliMobile.networkTypes.WIFI ||
    !platform.isIOS) {
  return;
}

var randomString = require('randomstring');
var tape = require('../lib/thaliTape');
var uuid = require('node-uuid');
var peerIdsToBeClosed = [];

// jshint -W064

// A variable that can be used to store a server
// that will get closed in teardown.
var serverToBeClosed = null;

var test = tape({
  setup: function (t) {
    serverToBeClosed = {
      closeAll: function (callback) {
        callback();
      }
    };
    t.end();
  },
  teardown: function (t) {
    thaliMobileNativeTestUtils.multiConnectEmitter.removeAllListeners();
    serverToBeClosed.closeAll(function () {
      thaliMobileNativeTestUtils.stopListeningAndAdvertising()
        .then(function () {
          if (!platform.isAndroid) {
            return thaliMobileNativeTestUtils.killAllMultiConnectConnections(peerIdsToBeClosed);
          }
        })
        .catch(function (err) {
          t.fail(err);
        })
        .then(function () {
          peerIdsToBeClosed = [];
          thaliMobileNativeWrapper._registerToNative();
          t.end();
        });
    });
  }
});

test('cannot call multiConnect when start listening for advertisements is ' +
  'not active', function (t) {
  var connectReturned = false;
  var originalSyncValue = randomString.generate();
  thaliMobileNativeTestUtils.multiConnectEmitter
    .on('multiConnectResolved', function (syncValue, error, listeningPort) {
      t.ok(connectReturned, 'Should only get called after multiConnect ' +
        'returned');
      t.equal(originalSyncValue, syncValue, 'SyncValue matches');
      t.equal(error, 'startListeningForAdvertisements is not active',
        'Got right error');
      t.equal(listeningPort, null, 'listeningPort is null');
      t.end();
    });
  var peerId = nodeUuid.v4();
  Mobile('multiConnect').callNative(peerId, originalSyncValue, function (err) {
    t.equal(err, null, 'Got null as expected');
    connectReturned = true;
  });
});

test('cannot call multiConnect with illegal peerID', function (t) {
  var connectReturned = false;
  var originalSyncValue = randomString.generate();
  thaliMobileNativeTestUtils.multiConnectEmitter
    .on('multiConnectResolved', function (syncValue, error, listeningPort) {
      t.ok(connectReturned, 'Should only get called after multiConnect ' +
        'returned');
      t.equal(originalSyncValue, syncValue, 'SyncValue matches');
      t.equal(error, 'Illegal peerID',
        'Got right error');
      t.notOk(listeningPort, 'listeningPort is null');
      t.end();
    });
  Mobile('startListeningForAdvertisements').callNative(function (err) {
    t.notOk(err, 'No error on starting');
    Mobile('multiConnect').callNative('foo', originalSyncValue, function (err) {
      t.notOk(err, 'Got null as expected');
      connectReturned = true;
    });
  });
});

test('multiConnect properly fails on legal but non-existent peerID',
  function () {
    // Skip for now, see #1924
    return true;
  },
  function (t) {
    var connectReturned = false;
    var originalSyncValue = randomString.generate();
    thaliMobileNativeTestUtils.multiConnectEmitter
      .on('multiConnectResolved', function (syncValue, error, listeningPort) {
        t.ok(connectReturned, 'Should only get called after multiConnect ' +
        'returned');
        t.equal(originalSyncValue, syncValue, 'SyncValue matches');
        t.equal(error, 'Connection could not be established',
          'Got right error');
        t.notOk(listeningPort, 'listeningPort is null');
        t.end();
      });
    Mobile('startListeningForAdvertisements').callNative(function (err) {
      t.notOk(err, 'No error on starting');
      var peerId = nodeUuid.v4();
      Mobile('multiConnect').callNative(peerId, originalSyncValue,
        function (err) {
          t.notOk(err, 'Got null as expected');
          connectReturned = true;
        });
    });
  });

test('cannot call multiConnect with invalid syncValue',
  function (t) {
    var invalidSyncValue = /I am not a string/;
    Mobile('startListeningForAdvertisements').callNative(function (err) {
      t.notOk(err, 'No error on starting');
      var peerId = nodeUuid.v4();
      Mobile('multiConnect').callNative(peerId, invalidSyncValue,
        function (error) {
          t.equal(error, 'Bad parameters', 'Got right error');
          t.end();
        });
    });
  });

test('cannot call disconnect with invalid peer id', function (t) {
  Mobile('disconnect').callNative('foo', function (error) {
      t.equal(error, 'Bad parameters', 'Got right error');
      t.end();
    });
});

test('disconnect doesn\'t fail on plausible but bogus peer ID', function (t) {
  var peerId = nodeUuid.v4();
  Mobile('disconnect').callNative(peerId, function(err) {
    t.notOk(err, 'No error');
    // Giving failure callback a chance to mess things up
    setImmediate(function () {
      t.end();
    });
  });
  thaliMobileNativeTestUtils.multiConnectEmitter
    .on('multiConnectConnectionFailure', function (peerIdentifier, error) {
    t.fail('We shouldn\'t get a failure callback - peerID: ' +
      peerIdentifier + ', error: ' + error);
    });
});

if (!tape.coordinated) {
  return;
}

function reConnect(t, peerIdentifier, originalListeningPort) {
  return new Promise(function (resolve) {
    var originalSyncValue = randomString.generate();

    thaliMobileNativeTestUtils.multiConnectEmitter.on('multiConnectResolved',
      function (syncValue, error, listeningPort) {
        if (syncValue === originalSyncValue) {
          t.notOk(error, 'No error');
          t.equal(listeningPort, originalListeningPort, 'Ports equal');
          resolve(null);
        }
      });

    Mobile('multiConnect').callNative(peerIdentifier, originalSyncValue,
      function (err) {
        t.notOk(err, 'Got null as expected');
      });
  });
}

test('Get same port when trying to connect multiple times on iOS',
  function (t) {
    var server = net.createServer(function (socket) {
      socket.pipe(socket);
    });
    server = makeIntoCloseAllServer(server);
    serverToBeClosed = server;

    thaliMobileNativeTestUtils.executeZombieProofTest(t, server, null,
      function (currentConnection, currentTestPeer) {
        return new Promise(function (resolve, reject) {
          peerIdsToBeClosed.push(currentTestPeer.peerIdentifier);
          var listeningPort = currentConnection.listeningPort;
          var connection = net.connect(listeningPort,
            function () {
              // We aren't allowed to have multiple simultaneous outstanding
              // calls to the same peerID on iOS for multiConnect (or
              // disconnect) so we have to serialize.
              reConnect(t, currentTestPeer.peerIdentifier, listeningPort)
                .then(function () {
                  return reConnect(t, currentTestPeer.peerIdentifier,
                    listeningPort);
                })
                .then(function () {
                  resolve();
                });
            });
          connection.on('error', function (err) {
            t.fail('lost connection because of ' + err);
            reject();
          });
        });
      }
    );
  });

