'use strict';

var tape = require('../lib/thaliTape');
if (!tape.coordinated) {
  return;
}

var util   = require('util');
var format = util.format;

var net          = require('net');
var Promise      = require('bluebird');
var EventEmitter = require('events').EventEmitter;
var math         = require('mathjs');

var makeIntoCloseAllServer = require('thali/NextGeneration/makeIntoCloseAllServer');

var logger = require('../lib/testLogger')('testMobileConnectLatency');


var server;
var peerAvailability = new EventEmitter();

var test = tape({
  setup: function (t) {
    server = makeIntoCloseAllServer(net.createServer());
    server.listen(0, function () {
      var port = server.address().port;

      Mobile('peerAvailabilityChanged').registerToNative(function (peers) {
        peers.forEach(function (peer) {
          peerAvailability.emit('data', peer);
        });
      });

      Mobile('startUpdateAdvertisingAndListening').callNative(
        port,
        function (error) {
          t.notOk(error, 'Can call startUpdateAdvertisingAndListening without error');

          Mobile('startListeningForAdvertisements').callNative(function (error) {
            t.notOk(error, 'Can call startListeningForAdvertisements without error');
            t.end();
          });
        }
      );
    });
  },
  teardown: function (t) {
    // This is the way to unbind 'peerAvailabilityChanged'.
    Mobile('peerAvailabilityChanged').registerToNative(function () {});

    server.closeAll(function () {
      Mobile('stopListeningForAdvertisements').callNative(function (error) {
        t.notOk(error, 'Should be able to call stopListeningForAdvertisements in teardown');

        Mobile('stopAdvertisingAndListening').callNative(function (error) {
          t.notOk(error, 'Should be able to call stopAdvertisingAndListening in teardown');
          t.end();
        });
      });
    });
  }
});

test('multiple connect to peers', function (t) {
  var CONNECT_ATTEMPS = 100;

  peerAvailability.on('data', newPeer);

  function newPeer (peer) {
    if (peer.peerAvailable) {
      // We've found a first available peer.
      // We don't want to find another peer.
      peerAvailability.removeListener('data', newPeer);
      connectToAvailablePeer(peer.peerIdentifier);
    }
  }

  function connectToAvailablePeer(id) {
    var attempts = [];
    var socket;

    // First connection should succeed.
    connect(id)
    .then(function (result) {
      logger.debug('we are connected to peer, id: \'%s\', port: %d', id, result.port);
      attempts.push(result.latency);

      // WARNING Now we should care about this 'port'.
      // It will be dead after 2 seconds of inactivity.
      // See thali/NextGeneration/thaliMobileNative for more information.
      // We want to keep it alive. Why?
      // We want to receive 'already connecting/connected' error in any other connect attempt to this peer.

      socket = keepPortAlive(result.port, 2000);
    })
    .catch(function (error) {
      t.fail(format(
        'we received error on first connection, id: \'%s\', error: \'%s\'',
        id, error.toString()
      ));
      return Promise.reject(error);
    })

    .then(function () {
      return Promise.mapSeries(new Array(CONNECT_ATTEMPS), function () {
        // Peer is connecting or it is already connected.
        // We want to receive 'already connecting/connected' error.

        return connect(id)
        .then(function () {
          t.fail(format(
            'we should not be able to connect to this peer again, id: \'%s\'',
            id
          ));
        })
        .catch(function (error) {
          if (error.message === 'Already connect(ing/ed)') {
            logger.debug(
              'we received already connecting/connected error, id: \'%s\'',
              id
            );
            attempts.push(error._latency);

            // We want to print current attempts
            printAttempts(id, attempts, 'current');
          } else {
            t.fail(format(
              'we received unexpected error, id: \'%s\', error: \'%s\'',
              id, error.toString()
            ));
          }
        });
      });
    })

    .then(function () {
      printAttempts(id, attempts, 'total');
      t.end();
    });
  }

  function connect (id) {
    return new Promise(function (resolve, reject) {
      var start = process.hrtime();
      Mobile('connect')
      .callNative(id, function (error, connection) {
        var diff    = process.hrtime(start);
        var latency = diff[0] * 1000 + diff[1] / (1000 * 1000);

        if (error) {
          var error = new Error(error);
          error._latency = latency;
          reject(error);
        } else {
          connection = JSON.parse(connection);

          t.ok(connection.listeningPort, 'we should receive \'listeningPort\'');
          var port = parseInt(connection.listeningPort, 10);
          t.ok(
            !isNaN(port) && port > 0 && port < (1 << 16),
            '\'listeningPort\' should be a valid'
          );

          resolve({
            port:    port,
            latency: latency
          });
        }
      });
    });
  }
});

function keepPortAlive (port, inactivityTimeout) {
  // We will connect to this port and send some data forever.
  // Timeout will be inactivityTimeout / 2.
  // This is our guarantee that connection won't be closed by server.

  var socket = new net.Socket().connect(port);
  socket.setKeepAlive(true, inactivityTimeout / 2);
  return socket;
}

function printAttempts(id, attempts, prefix) {
  var sum = attempts.reduce(function (sum, latency) {
    return sum + latency;
  }, 0);
  var average = round(sum / attempts.length);
  var median  = round(math.median(attempts));
  var std     = round(math.std(attempts));

  logger.info(
    '%s attempts count: %d, latency for id: \'%s\', average: %d ms, median: %d ms, standard deviation: %d ms',
    prefix, attempts.length, id, average, median, std
  );
}

function round(number) {
  return Math.round(number * 1000) / 1000;
}
