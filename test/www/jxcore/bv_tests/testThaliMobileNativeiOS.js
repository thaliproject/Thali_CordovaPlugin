'use strict';

// Issue #419
var ThaliMobile = require('thali/NextGeneration/thaliMobile');
var Platform = require('thali/NextGeneration/utils/platform');
var nodeUuid = require('node-uuid');
var net = require('net');
var thaliMobileNativeTestUtils = require('../lib/thaliMobileNativeTestUtils');
var makeIntoCloseAllServer = require('thali/NextGeneration/makeIntoCloseAllServer');
var thaliMobileNativeWrapper =
  require('thali/NextGeneration/thaliMobileNativeWrapper');
var logger = require('../lib/testLogger')('testThaliMobileNativeiOS');
var Promise = require('lie');
if (global.NETWORK_TYPE === ThaliMobile.networkTypes.WIFI ||
    !Platform.isIOS) {
  return;
}

var randomString = require('randomstring');
var tape = require('../lib/thaliTape');

var uuid = require('node-uuid');

var peerIdToBeClosed = uuid.v4();

/**
 * @readonly
 * @type {{NOT_CONNECTED: string, CONNECTING: string, CONNECTED: string}}
 */
var connectStatus = {
  NOT_CONNECTED : 'notConnected',
  CONNECTING : 'connecting',
  CONNECTED : 'connected'
};

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
      Mobile('stopListeningForAdvertisements').callNative(function (err) {
        t.notOk(
          err,
          'Should be able to call stopListeningForAdvertisements in teardown'
        );
        Mobile('stopAdvertisingAndListening').callNative(function (err) {
          t.notOk(
            err,
            'Should be able to call stopAdvertisingAndListening in teardown'
          );
          Mobile('disconnect').callNative(peerIdToBeClosed, function (err) {
            t.notOk(
              err,
              'Should be able to call disconnect in teardown'
            );
            thaliMobileNativeWrapper._registerToNative();
            t.end();
          });
        });
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

function executeZombieProofTest (t, server, testFunction) {
  logger.debug("TEST: execute ZombieProof test");
  var status = connectStatus.NOT_CONNECTED;
  var availablePeers = [];

  var onConnectSuccess = function (err, connection, peer) {
    logger.debug("TEST: onConnectSuccess");
    testFunction(err, connection, peer);
    connectTest(connectionCallback.listeningPort, currentTestPeer);
  };

  var tryToConnect = function () {
    availablePeers.forEach(function (peer) {
      if (peer.peerAvailable && status === connectStatus.NOT_CONNECTED) {
        status = connectStatus.CONNECTING;
        logger.debug("TEST: connecting to peer:", peer.peerIdentifier);
        thaliMobileNativeTestUtils.connectToPeer(peer)
          .then(function (connection) {
            status = connectStatus.CONNECTED;
            onConnectSuccess(null, connection, peer);
          })
          .catch(function (error) {
            status = connectStatus.NOT_CONNECTED;
            logger.debug("TEST: failed to connect to peer:", peer.peerIdentifier);
            // Remove the peer from the availablePeers list in case it is still there
            for (var i = availablePeers.length - 1; i >= 0; i--) {
              if (availablePeers[i].peerIdentifier === peer.peerIdentifier) {
                availablePeers.splice(i, 1);
                logger.debug("TEST: peer removed:", peer.peerIdentifier);
              }
            }
            tryToConnect();
          });
      }
    });
  };

  function peerAvailabilityChanged(peers) {
    logger.debug("TEST: peerAvailabilityChangedHandler invoked");
    peers.forEach(function (peer) {
      if (peer.peerAvailable == true) {
        // Add the peer to the availablePeers list
        availablePeers.push(peer);
        logger.debug("TEST: peer added:", peer);
      } else {
        // Remove the peer from the availablePeers list
        for (var i = availablePeers.length - 1; i >= 0; i--) {
          if (availablePeers[i].peerIdentifier === peer.peerIdentifier) {
            availablePeers.splice(i, 1);
            logger.debug("TEST: peer removed:", peer);
          }
        }
      }
    });

    if (status === connectStatus.NOT_CONNECTED && availablePeers.length > 0) {
      tryToConnect();
    }
  }

  thaliMobileNativeTestUtils.startAndListen(t, server, peerAvailabilityChanged);
}

test('Get same port when trying to connect multiple times on iOS',
  function (t) {
    var server = net.createServer(function (socket) {
      socket.pipe(socket);
    });
    server = makeIntoCloseAllServer(server);
    serverToBeClosed = server;

    executeZombieProofTest(t, server, function (err, currentConnection, currentTestPeer) {
        peerIdToBeClosed = currentTestPeer.peerIdentifier;
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
              }).then(function () {
                t.end();
              });

          });
        connection.on('error', function (err) {
          t.fail('lost connection because of ' + err);
          t.end();
        });
      }
    );
  });
