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

  // We want to map peerIdentifier -> {
  //   connecting: [promiseData1, ...],
  //   attempts:   [latency1, ...], // 0 <= attempts.length <= CONNECT_ATTEMPS
  //   socket:     new net.Socket()
  // }
  var peersData = {};

  function newPeer (peer) {
    var id          = peer.peerIdentifier;
    var isAvailable = peer.peerAvailable;
    if (isAvailable) {
      logger.debug('peer is available, id: \'%s\'', id);
      connectToAvailablePeer(id);
    } else {
      logger.debug('peer is not available, id: \'%s\'', id);
      var data = peersData[id];
      if (data) {
        // WARNING This is a place where we have to ignore the result of ongoing Mobile('connect').
        // We need to reject it's promise and remove connection attempts.
        // Mobile('connect') will continue working, but we won't receive any data.

        cleanup(data, id);
        delete peersData[id];
      }
    }
  }

  function cleanup(data, id) {
    var error = format('cleaning peer data, id: \'%s\'', id);
    data.connecting.forEach(function (promiseData) {
      promiseData.reject(new Error(error));
    });
    data.connecting = [];
    if (data.socket) {
      data.socket.destroy();
      data.socket = null;
    }
  }

  function connectToAvailablePeer(id) {
    var data = peersData[id];
    if (!data) {
      // Default data for available peer.
      data = peersData[id] = {
        connecting: [],
        attempts:   [],
        socket:     null
      };
    }

    if (data.connecting.length === 0 && data.attempts.length === 0) {
      // This will our first connection attempt.
      // First connection should succeed.

      connectWrapper(id, data)
      .then(function (result) {
        logger.info('we are connected to peer, id: \'%s\', port: %d', id, result.port);
        data.attempts.push(result.latency);

        // WARNING Now we should care about this 'port'.
        // It will be dead after 2 seconds of inactivity.
        // See thali/NextGeneration/thaliMobileNative for more information.
        // We want to keep it alive. Why?
        // We want to receive 'already connecting/connected' error in any other connect attempt to this peer.

        keepPortAlive(data, result.port, 2000);
      })
      .catch(function (error) {
        t.fail(format(
          'we received error on first connection, error: \'%s\', id: \'%s\'',
          error.toString(), id
        ));
      });
    } else if (data.attempts.length <= CONNECT_ATTEMPS) {
      // Peer is connecting or it is already connected.
      // We want to receive 'already connecting/connected' error.

      connectWrapper(id, data)
      .then(function () {
        t.fail(format(
          'we should not be able to connect to this peer again, id: \'%s\'',
          id
        ));
      })
      .catch(function (error) {
        if (error.message === 'Already connect(ing/ed)') {
          logger.info(
            'we received already connecting/connected error, id: \'%s\'',
            id
          );
          data.attempts.push(error._latency);
        } else {
          t.fail(format(
            'we received unexpected error: \'%s\'',
            error.toString()
          ));
        }
      });
    } else {
      // This peer is completed.
      cleanup(data, id);
      setPeerCompleted(id, data.attempts);
    }
  }

  function connectWrapper (id, data) {
    var promiseData = connect(id);
    data.connecting.push(promiseData);

    // WARNING Our peer shouldn't become unavailable while we are doing Mobile('connect').
    // How can we verify this behaviour? We can compare 'peersData[id]' with our current 'data' with '==='.
    // If peer will become unavailable it's data will be 'null' or 'undefined'.
    // If peer will become unavailable and than available it's data will be not 'null', but it won't be equal to our current 'data'.
    return promiseData.promise
    .then(function (result) {
      t.ok(
        peersData[id] === data,
        format('our peer should be still available with the same data, id: \'%s\'', id)
      );

      t.ok(result.connection.listeningPort, 'we should receive \'listeningPort\'');
      var port = parseInt(result.connection.listeningPort, 10);
      t.ok(
        !isNaN(port) && port > 0 && port < (1 << 16),
        '\'listeningPort\' should be a valid'
      );
      delete result.connection;
      result.port = port;

      t.ok(!isNaN(result.latency), 'we should receive \'latency\'');

      return result;
    })
    .catch(function (error, latency) {
      if (peersData[id] === data) {
        t.ok(!isNaN(error._latency), 'we should receive \'latency\'');
        return Promise.reject(error);
      } else {
        logger.warn(
          'our peer become unavailable while we were connecting, we are ignoring error: \'%s\', id: \'%s\'',
          error.toString(), id
        );
      }
    })
    .finally(function () {
      var index = data.connecting.indexOf(promiseData);
      t.ok(
        index !== -1,
        'we should be able to remove \'promiseData\' from \'connecting\' list'
      );
      data.connecting.splice(index, 1);
    });
  }

  function connect (id) {
    var data = {};
    data.promise = new Promise(function (resolve, reject) {
      data.reject = reject;

      var start = getTime();
      Mobile('connect').callNative(
        id,
        function (error, connection) {
          var latency = getTime() - start;

          if (error) {
            var error = new Error(error);
            error._latency = latency;
            reject(error);
          } else {
            resolve({
              connection: JSON.parse(connection),
              latency:    latency
            });
          }
        }
      );
    });
    return data;
  }

  function getTime() {
      var hrtime = process.hrtime();
      return (hrtime[0] * 1000000 + hrtime[1] / 1000) / 1000;
  }

  function keepPortAlive (data, port, inactivityTimeout) {
    // We will connect to this port and send some data forever.
    // Timeout will be inactivityTimeout / 2.
    // This is our guarantee that connection won't be closed by server.

    var isConnected = false;
    var socket = new net.Socket()
    .connect(port, function () {
      isConnected = true;
    });
    data.socket = socket;

    var interval = setInterval(function () {
      if (isConnected) {
        socket.write('ping');
      }
    }, inactivityTimeout / 2);

    socket
    .once('close', function () {
      clearInterval(interval);
      data.socket = null;
    });
  }

  peerAvailability.on('data', newPeer);

  var peersCompleted = {};
  function setPeerCompleted(id, attempts) {
    peersCompleted[id] = attempts;

    var ids = Object.keys(peersCompleted);
    if (ids.length === t.participants.length - 1) {
      ids.forEach(function (id) {
        var attempts = peersCompleted[id];

        function round(number) {
          return Math.round(number * 1000) / 1000;
        }

        var sum = attempts.reduce(function (sum, latency) {
          return sum + latency;
        }, 0);
        var average = round(sum / attempts.length);
        var median  = round(math.median(attempts));
        var std     = round(math.std(attempts));

        logger.info(
          'latency for id: \'%s\', average: %d, median: %d, standard deviation: %d',
          id, average, median, std
        );
      });

      peerAvailability.removeListener('data', newPeer);
      t.end();
    }
  }
});
