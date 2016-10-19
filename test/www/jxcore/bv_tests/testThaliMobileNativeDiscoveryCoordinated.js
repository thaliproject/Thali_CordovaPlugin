'use strict';

var ThaliMobile = require('thali/NextGeneration/thaliMobile');
if (global.NETWORK_TYPE === ThaliMobile.networkTypes.WIFI) {
  return;
}

var tape = require('../lib/thaliTape');
if (!tape.coordinated) {
  return;
}

var platform = require('thali/NextGeneration/utils/platform');

var net = require('net');
var assert = require('assert');
var Promise = require('lie');

var makeIntoCloseAllServer = require('thali/NextGeneration/makeIntoCloseAllServer');

var logger = require('../lib/testLogger')('testThaliMobileNativeDiscoveryCoordinated');

// Global server that should be stopped with it's mobile sources in teardown.
var serverToBeClosed;
// Do we need to call 'stopListeningForAdvertisements'?
var mobileIsListening = false;
// Do we need to call 'stopAdvertisingAndListening'?
var mobileIsAdvertising = false;

function closeServer() {
  return Promise.resolve()
  .then(function () {
    if (serverToBeClosed) {
      return new Promise(function (resolve) {
        serverToBeClosed.closeAll(function () {
          serverToBeClosed = undefined;
          resolve();
        });
      });
    }

    return null;
  })
  .then(function () {
    if (mobileIsListening) {
      return new Promise(function (resolve) {
        Mobile('stopListeningForAdvertisements')
        .callNative(function (error) {
          assert(
            !error,
            'Should be able to call stopListeningForAdvertisements in teardown'
          );
          mobileIsListening = false;
          resolve();
        });
      });
    }

    return null;
  })
  .then(function () {
    if (mobileIsAdvertising) {
      return new Promise(function (resolve) {
        Mobile('stopAdvertisingAndListening')
        .callNative(function (error) {
          assert(
            !error,
            'Should be able to call stopAdvertisingAndListening in teardown'
          );
          mobileIsAdvertising = false;
          resolve();
        });
      });
    }

    return null;
  });
}

var test = tape({
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    closeServer()
    .catch(function (error) {
      t.fail(error);
    })
    .then(function () {
      t.end();
    });
  }
});

var TEST_TIMEOUT = 1 * 60 * 1000;
var STEP_TIMEOUT = 10 * 1000;

// We doesn't want our test to run infinite time.
// We will replace t.end with custom exit function.
var testTimeout = function (t) {
  var timer = setTimeout(function () {
    t.fail('test timeout');
    t.end();
  }, TEST_TIMEOUT);
  var oldEnd = t.end;
  t.end = function () {
    clearTimeout(timer);
    return oldEnd.apply(this, arguments);
  };
};

var server;

var allPeers = {};
var peersFromPreviousTest;

test('initial peer discovery', function (t) {
  testTimeout(t);

  server = net.createServer();
  server.on('error', function (err) {
    logger.debug('got error on server ' + err);
  });
  server = makeIntoCloseAllServer(server);

  var currentPeers = {};
  peersFromPreviousTest = {};
  function newPeersHandler(peers) {
    peers.forEach(function (peer) {
      if (peer.peerAvailable) {
        // We can receive each peer many times. We can just ignore this case.
        currentPeers[peer.peerIdentifier + ':' + peer.generation] = true;
      }
    });
  }

  // Listening on random port.
  server.listen(0, function () {

    Mobile('startUpdateAdvertisingAndListening')
    .callNative(server.address().port, function (error) {
      t.notOk(error, 'Called startUpdateAdvertisingAndListening without error');

      Mobile('startListeningForAdvertisements')
      .callNative(function (error) {
        t.notOk(error, 'Called startListeningForAdvertisements without error');

        Mobile('peerAvailabilityChanged').registerToNative(newPeersHandler);
      });
    });
  });

  // After 10 seconds we will check whether we have all peers.
  setTimeout(function () {
    var peersReceived = Object.getOwnPropertyNames(currentPeers);
    t.ok(
      peersReceived.length === t.participants.length - 1,
      'We have received peers we expected'
    );

    Mobile('peerAvailabilityChanged').registerToNative(function () {});

    // Copying received peers to the global peers hash table.
    peersReceived.forEach(function (idAndGeneration) {
      allPeers[idAndGeneration] = true;
    });
    t.end();
  }, STEP_TIMEOUT);
});

[0,1].forEach(function(testIndex) {

  test('update peer discovery ' + (testIndex + 1), function (t) {
    testTimeout(t);

    var currentPeers = {};
    peersFromPreviousTest = {};

    function newPeersHandler(peers) {
      peers.forEach(function (peer) {
        // We can ignore peers that we already have in global peer hash table.
        var idAndGeneration = peer.peerIdentifier + ':' + peer.generation;
        if (allPeers[idAndGeneration]) {
          return;
        }
        if (peer.peerAvailable) {
          currentPeers[idAndGeneration] = true;
        }
      });
    }

    Mobile('startUpdateAdvertisingAndListening')
    .callNative(server.address().port, function (error) {
      t.notOk(error, 'Called startUpdateAdvertisingAndListening without error');

      Mobile('peerAvailabilityChanged').registerToNative(newPeersHandler);
    });

    // After 10 seconds we will check whether we have all peers.
    setTimeout(function () {
      var peersReceived = Object.getOwnPropertyNames(currentPeers);
      t.ok(
        peersReceived.length === t.participants.length - 1,
        'We have received peers we expected'
      );

      Mobile('peerAvailabilityChanged').registerToNative(function () {});

      peersReceived.forEach(function (idAndGeneration) {
        // This is a new peer that only started advertising during this test
        if (!allPeers[idAndGeneration]) {
          allPeers[idAndGeneration] = true;
          peersFromPreviousTest[idAndGeneration] = true;
        }
      });
      t.end();
    }, STEP_TIMEOUT);
  });

});

test('check latest peer discovery', function() {
    // On both Android and Wifi the native layer will constantly pump repeated
    // peerAvailabilityChanged events for peers whose state have not changed.
    // This is o.k. because thaliMobile cleans it up. But iOS doesn't do this
    // and so this test isn't useful there.
    return platform.isIOS;
  },
  function (t) {
    testTimeout(t);

    serverToBeClosed = server;
    mobileIsListening = true;
    mobileIsAdvertising = true;

    var currentPeers = {};

    function newPeersHandler(peers) {
      peers.forEach(function (peer) {
        if (peer.peerAvailable) {
          currentPeers[peer.peerIdentifier + ':' + peer.generation] = true;
        }
      });
    }

    // After 10 seconds we will check our peers again.
    setTimeout(function () {
      Mobile('peerAvailabilityChanged').registerToNative(newPeersHandler);

      // After 10 seconds we will check whether we have all peers
      // from the latest peer discovery.
      setTimeout(function () {
        var peersReceived = Object.getOwnPropertyNames(currentPeers);
        t.ok(
          peersReceived.length === t.participants.length - 1,
          'We have received peers we expected'
        );

        Mobile('peerAvailabilityChanged').registerToNative(function () {});

        var samePeers = peersReceived.every(function (idAndGeneration) {
          return peersFromPreviousTest[idAndGeneration];
        });
        t.ok(
          samePeers,
          'We have received peers from the latest peer discovery'
        );

        // Copying received peers to the global peers hash table.
        peersReceived.forEach(function (idAndGeneration) {
          allPeers[idAndGeneration] = true;
        });
        t.end();
      }, STEP_TIMEOUT);

    }, STEP_TIMEOUT);
  });

test('Set up for no peer discovery test',
  function () {
    // no peer discovery depends on the native radios being off and being
    // restarted here. That normally happens in 'check latest peer discovery'
    // but we can't run that test on iOS. So we use this as a bogu test just
    // to make sure everything gets turned off.
    return platform.isAndroid;
  },
  function (t) {
    serverToBeClosed = null;
    mobileIsListening = true;
    mobileIsAdvertising = true;
    t.end();
  });

test('no peer discovery',
  function () {
    // disabled until #1323 will be resolved
    return platform.isIOS;
  },
  function (t) {
  testTimeout(t);

  mobileIsListening = true;

  function newPeersHandler(peers) {
    t.ok(peers.length === 0, 'We should not receive peers');
  }

  Mobile('startListeningForAdvertisements')
  .callNative(function (error) {
    t.notOk(error, 'Called startListeningForAdvertisements without error');

    Mobile('peerAvailabilityChanged').registerToNative(newPeersHandler);
  });

  setTimeout(function () {
    Mobile('peerAvailabilityChanged').registerToNative(function () {});
    t.end();
  }, STEP_TIMEOUT);
});
