'use strict';

var LEADER_TIMEOUT = 10 * 1000;
var SYNC_TIMEOUT   = 10 * 1000;
var TEST_TIMEOUT   = 5 * 60 * 1000;
var DATA_LENGTH    = 1e6;

if (typeof Mobile === 'undefined') {
  global.Mobile = require('./lib/wifiBasedNativeMock.js')();
}

var net          = require('net');
var assert       = require('assert');
var Promise      = require('bluebird');
var uuid         = require('node-uuid');
var randomstring = require("randomstring");

var makeIntoCloseAllServer = require('thali/NextGeneration/makeIntoCloseAllServer');

require('./lib/utils/process');
var logger    = require('./lib/testLogger')('1Meg_app');
var testUtils = require('./lib/testUtils');


// We will resolve leader by compare peer ids.
// Leader have the 'lowest' possible id.

// We couldn't get our local peerIdentifier.
// So we will send peerIdentifier to the peer itself.
var myPeerId;
var peerIds = {};

function resolveLeader () {
  var server;

  function start () {
    return new Promise(function (resolve) {
      server = makeIntoCloseAllServer(
        net.createServer(receivePeerId)
      );
      server.listen(0, function () {
        resolve();
      });
    })
    .then(function () {
      return new Promise(function (resolve) {
        Mobile('startUpdateAdvertisingAndListening')
        .callNative(server.address().port, function (error) {
          assert(!error, 'Called startUpdateAdvertisingAndListening without error');
          resolve();
        });
      });
    })
    .then(function () {
      return new Promise(function (resolve) {
        Mobile('startListeningForAdvertisements')
        .callNative(function (error) {
          assert(!error, 'Called startListeningForAdvertisements without error');
          Mobile('peerAvailabilityChanged').registerToNative(peersHandler);
          resolve();
        });
      });
    });
  }

  function stop () {
    return new Promise(function (resolve) {
      Mobile('peerAvailabilityChanged').registerToNative(function () {});

      Mobile('stopListeningForAdvertisements')
      .callNative(function (error) {
        assert(!error, 'Should be able to call stopListeningForAdvertisements');
        resolve();
      });
    })
    .then(function () {
      return new Promise(function (resolve) {
        Mobile('stopAdvertisingAndListening')
        .callNative(function (error) {
          assert(!error, 'Should be able to call stopAdvertisingAndListening');
          resolve();
        });
      });
    })
    .then(function () {
      return new Promise(function (resolve) {
        server.closeAll(resolve);
      });
    });
  }

  function peersHandler (peers) {
    peers.forEach(function (peer) {
      if (peer.peerAvailable) {
        sendPeerId(peer.peerIdentifier);
        peerIds[peer.peerIdentifier] = true;
      }
    });
  }

  function sendPeerId (id) {
    Mobile('connect')
    .callNative(id, function (error, data) {
      if (error) {
        logger.error('Got error \'%s\'', error.toString());
        return;
      }
      data = JSON.parse(data);
      var socket = new net.Socket()
      .connect(data.listeningPort, function() {
        socket.write(id, function () {
          socket.end();
        });
      });
    });
  }

  function receivePeerId (socket) {
    socket.once('data', function (data) {
      var id = data.toString();
      if (myPeerId) {
        assert(myPeerId === id, 'my id should be same for all peers');
      } else {
        myPeerId = id;
      }
    });
  }

  return start ()
  .then(function () {
    return new Promise(function (resolve) {
      setTimeout(resolve, LEADER_TIMEOUT);
    });
  })
  .then(stop)
  .then(function () {
    assert(myPeerId, 'my peer id should exist');

    var isLeader = Object.keys(peerIds)
    .every(function (peerId) {
      return myPeerId < peerId;
    });
    return isLeader;
  });
}

resolveLeader()
.then(function (isLeader) {
  return new Promise(function (resolve) {
    if (isLeader) {
      logger.debug('I am a leader');
    } else {
      logger.debug('I am not a leader');
    }
    setTimeout(function () {
      resolve(isLeader);
    }, SYNC_TIMEOUT);
  });
})
.then(function (isLeader) {
  if (isLeader) {
    sendRandomData();
  } else {
    receiveRandomData();
  }
});

function sendRandomData() {
  function start () {
    return new Promise(function (resolve) {
      Mobile('startListeningForAdvertisements')
      .callNative(function (error) {
        assert(!error, 'Called startListeningForAdvertisements without error');
        Mobile('peerAvailabilityChanged').registerToNative(peersHandler);
        resolve();
      });
    });
  }

  function stop() {
    return new Promise(function (resolve) {
      Mobile('stopListeningForAdvertisements')
      .callNative(function (error) {
        assert(!error, 'Should be able to call stopListeningForAdvertisements');
        resolve();
      });
    });
  }

  var confirmedPeers = {};

  function resolveConfirmedPeers () {
    if (Object.keys(peerIds).length === Object.keys(confirmedPeers).length) {
      stop()
      .then(function () {
        logger.debug('we are stopped');
      });
    }
  }

  function peersHandler (peers) {
    peers.forEach(function (peer) {
      if (peer.peerAvailable) {
        sendData(peer.peerIdentifier);
      }
    });
  }

  var randomData = randomstring.generate(DATA_LENGTH);

  function sendData (id) {
    if (confirmedPeers[id]) {
      logger.debug('we already finished with peer: \'%s\'', id);
      return;
    }

    Mobile('connect')
    .callNative(id, function (error, data) {
      if (error) {
        logger.error('Got error \'%s\'', error.toString());
        return;
      }
      data = JSON.parse(data);

      var socket = new net.Socket()
      .connect(data.listeningPort, function() {
        socket.write(randomData);

        socket.on('data', function (data) {
          if (data.toString() === '0') {
            logger.debug('we finished with peer: \'%s\'', id);
            confirmedPeers[id] = true;
            resolveConfirmedPeers();
          } else {
            logger.error('we received invalid confirmation');
          }
          socket.end();
        })

        .on('error', function (error) {
          logger.error('Got error: \'%s\', stack: \'%s\'', error.toString(), error.stack);

          // We want to reconnect.
          socket.destroy();
          setImmediate(function () {
            sendData(id);
          });
        });
      });
    });
  }

  start();
}

function receiveRandomData() {
  var server;

  function start () {
    return new Promise(function (resolve) {
      server = makeIntoCloseAllServer(
        net.createServer(receiveData)
      );
      server.listen(0, function () {
        resolve();
      });
    })
    .then(function () {
      return new Promise(function (resolve) {
        Mobile('startUpdateAdvertisingAndListening')
        .callNative(server.address().port, function (error) {
          assert(!error, 'Called startUpdateAdvertisingAndListening without error');
          resolve();
        });
      });
    });
  }

  function stop() {
    return new Promise(function (resolve) {
      Mobile('stopAdvertisingAndListening')
      .callNative(function (error) {
        assert(!error, 'Should be able to call stopAdvertisingAndListening');
        resolve();
      });
    })
    .then(function () {
      return new Promise(function (resolve) {
        server.closeAll(resolve);
      });
    });
  }

  var totalLength = 0;

  function receiveData(socket) {
    logger.debug('we got a connection from leader');

    socket.on('data', function (data) {
      data = data.toString();
      totalLength += data.length;
      logger.debug(
        'we received data from leader, length: %d, total length: %d',
        data.length, totalLength
      );

      if (totalLength >= DATA_LENGTH) {
        // This is our confirmation byte.
        logger.debug('we sent a confirmation byte to leader');
        socket.write('0', function () {

          socket.once('close', function () {
            stop()
            .then(function () {
              logger.debug('we are stopped');
            });
          })
          socket.end();
        });
      }
    })

    .on('error', function (error) {
      logger.error('Got error: \'%s\', stack: \'%s\'', error.toString(), error.stack);
    });
  }

  start();
}

logger.debug('1 meg app is loaded');
setTimeout(function () {
  logger.debug('1 meg app is finished');
  process.exit();
}, TEST_TIMEOUT);
