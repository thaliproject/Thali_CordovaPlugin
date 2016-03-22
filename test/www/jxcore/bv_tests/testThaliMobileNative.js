'use strict';

var net = require('net');
var crypto = require('crypto');
var randomstring = require('randomstring');
var tape = require('../lib/thali-tape');
var makeIntoCloseAllServer = require('thali/NextGeneration/makeIntoCloseAllServer');
var logger = require('thali/thalilogger')('testThaliMobileNative');

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
    serverToBeClosed.closeAll(function () {
      Mobile('stopListeningForAdvertisements').callNative(function (err) {
        t.notOk(
          err,
          'Should be able to call stopListeningForAdvertisments in teardown'
        );
        Mobile('stopAdvertisingAndListening').callNative(function (err) {
          t.notOk(
            err,
            'Should be able to call stopAdvertisingAndListening in teardown'
          );
          t.end();
        });
      });
    });
  }
});

test('Can call start/stopListeningForAdvertisements', function (t) {
  Mobile('startListeningForAdvertisements').callNative(function (err) {
    t.notOk(err, 'Can call startListeningForAdvertisements without error');
    Mobile('stopListeningForAdvertisements').callNative(function (err) {
      t.notOk(err, 'Can call stopListeningForAdvertisements without error');
      t.end();
    });
  });
});

test('Calling startListeningForAdvertisements twice is NOT an error',
function (t) {
  Mobile('startListeningForAdvertisements').callNative(function (err) {
    t.notOk(err, 'Can call startListeningForAdvertisements without error');
    Mobile('startListeningForAdvertisements').callNative(function (err) {
      t.notOk(
        err,
        'Can call startListeningForAdvertisements twice without error'
      );
      t.end();
    });
  });
});

test('Can call start/stopUpdateAdvertisingAndListening', function (t) {
  Mobile('startUpdateAdvertisingAndListening').callNative(4242, function (err) {
    t.notOk(err, 'Can call startUpdateAdvertisingAndListening without error');
    Mobile('stopAdvertisingAndListening').callNative(function (err) {
      t.notOk(
        err, 'Can call stopAdvertisingAndListening without error'
      );
      t.end();
    });
  });
});

test('Calling startUpdateAdvertisingAndListening twice is NOT an error',
function (t) {
  Mobile('startUpdateAdvertisingAndListening').callNative(4242, function (err) {
    t.notOk(err, 'Can call startUpdateAdvertisingAndListening without error');
    Mobile('startUpdateAdvertisingAndListening').callNative(4243,
    function (err) {
      t.notOk(
        err,
        'Can call startUpdateAdvertisingAndListening twice without error'
      );
      t.end();
    });
  });
});

if (!tape.coordinated) {
  return;
}

test('peerAvailabilityChange is called', function (t) {

  var complete = false;

  Mobile('peerAvailabilityChanged').registerToNative(function (peers) {

    if (!complete)
    {
      t.ok(peers instanceof Array, 'peers must be an array');
      t.ok(peers.length !== 0, 'peers must not be zero-length');

      t.ok(peers[0].hasOwnProperty('peerIdentifier'),
        'peer must have peerIdentifier');
      t.ok(typeof peers[0].peerIdentifier === 'string',
        'peerIdentifier must be a string');
      
      t.ok(peers[0].hasOwnProperty('peerAvailable'),
        'peer must have peerAvailable');
      t.ok(peers[0].hasOwnProperty('pleaseConnect'),
        'peer must have pleaseConnect');

      complete = true;
      t.end();
    }
  });

  Mobile('startUpdateAdvertisingAndListening').callNative(4242, function (err) {
    t.notOk(err, 'Can call startUpdateAdvertisingAndListeningwithout error');
    Mobile('startListeningForAdvertisements').callNative(function (err) {
      t.notOk(err, 'Can call startListeningForAdvertisements without error');
    });
  });
});

function connectToPeer(peer, retries, successCb, failureCb) {

  var TIME_BETWEEN_RETRIES = 3000;

  retries--;
  Mobile('connect').callNative(peer.peerIdentifier, function (err, connection) {

    if (err == null) {
      // Connected successfully..
      successCb(err, connection);
    } else {
      logger.info('Connect returned an error: ' + err);
      if (err.indexOf("unreachable") != -1) {
        logger.info("Aborting retries since unreachable");
        return;
      }
      if (err.indexOf("Already connected") != -1) {
        logger.info("Aborting retries since already connected");
        return;
      }
      // Retry a failed connection..
      if (retries > 0) {
        logger.info('Scheduling a connect retry - retries left: ' + retries);
        setTimeout(function () {
          connectToPeer(peer, retries, successCb, failureCb);
        }, TIME_BETWEEN_RETRIES);
      } else {
        if (failureCb) {
          logger.warn('Too many connect retries!');
          // Exceeded retries..
          failureCb(err, connection);
        }
      }
    }
  });
}

test('Can connect to a remote peer', function (t) {

  var connected = false;

  var echoServer = net.createServer(function (socket) {
    socket.pipe(socket);
  });
  echoServer = makeIntoCloseAllServer(echoServer);
  serverToBeClosed = echoServer;

  function onConnectSuccess(err, connection) {

    connected = true;

    // Called if we successfully connecto to a peer
    connection = JSON.parse(connection);
    logger.info(connection);

    t.ok(connection.hasOwnProperty('listeningPort'),
      'Must have listeningPort');
    t.ok(typeof connection.listeningPort === 'number',
      'listeningPort must be a number');
    t.ok(connection.hasOwnProperty('clientPort'),
      'Connection must have clientPort');
    t.ok(typeof connection.clientPort === 'number',
      'clientPort must be a number');
    t.ok(connection.hasOwnProperty('serverPort'),
      'Connection must have serverPort');
    t.ok(typeof connection.serverPort === 'number',
      'serverPort must be a number');

    if (connection.listeningPort !== 0)
    {
      // Forward connection
      t.ok(connection.clientPort === 0,
        'forward connection must have clientPort == 0');
      t.ok(connection.serverPort === 0,
        'forward connection must have serverPort == 0');
    }
    else
    {
      // Reverse connection
      t.ok(connection.clientPort !== 0,
        'reverse connection must have clientPort != 0');
      t.ok(connection.serverPort !== 0,
        'reverse connection must have serverPort != 0');
    }

    t.end();
  }

  function onConnectFailure () {
    if (!connected) {
      t.fail('Connect failed!');
      t.end();
    }
  }

  echoServer.listen(0, function () {

    var applicationPort = echoServer.address().port;

    Mobile('peerAvailabilityChanged').registerToNative(function (peers) {
      logger.info('Received peerAvailabilityChanged with peers: ' +
        JSON.stringify(peers)
      );
      peers.forEach(function (peer) {
        if (peer.peerAvailable && !connected) {
          var RETRIES = 10;
          connectToPeer(peer, RETRIES, onConnectSuccess, onConnectFailure);
        }
      });
    });

    Mobile('startUpdateAdvertisingAndListening').callNative(applicationPort,
    function (err) {
      t.notOk(err, 'Can call startUpdateAdvertisingAndListening without error');
      Mobile('startListeningForAdvertisements').callNative(function (err) {
        t.notOk(err, 'Can call startListeningForAdvertisements without error');
      });
    });
  });
});

test('Can shift large amounts of data', function (t) {

  var connected = false;

  // Just send a random string plus it's digest to the other side
  // and have it compare it's own computed digest with ours

  var sockets = {};
  var server = net.createServer(function (socket) {
    socket.on('end', socket.end);
    socket.on('error', function (error) {
      logger.warn('Error on echo server socket: ' + error);
      t.fail();
    });
    sockets[socket.remotePort] = socket;
  });
  server = makeIntoCloseAllServer(server);
  serverToBeClosed = server;

  var ID_LEN = 16;
  var DATA_LEN = 1024;

  function readMax(data, size, resultCallback) {
    var result = '';
    while (data.length && size--) {
      result += data.slice(0, 1).toString();
      data = data.slice(1);
    }
    resultCallback(result);
    return data;
  }

  function shiftData(sock) {
    var toSend = randomstring.generate(DATA_LEN);
    var digest = crypto.createHash('sha1').update(toSend).digest('base64');
   
    var toRecv = '';
    var remoteDigest = ''; 
    var digestLength = '';
    var digestLengthReceived = false;

    sock.on("data", function(data) {

      logger.info(data.toString());

      while (toRecv.length < DATA_LEN) {
        data = readMax(data, DATA_LEN - toRecv.length, function(result) {
          toRecv += result;
        });
        if (data.length == 0) {
          return;
        }
      }

      while (digestLengthReceived == false) {
        data = readMax(data, 1, function(result) {
          if (result == ' ') {
            digestLengthReceived = true;
            digestLength = digestLength.toString();
          }
          else {
            digestLength += result;
          }
        });
        if (data.length == 0) {
          return;
        }
      }

      while (remoteDigest.length < digestLength) {
        if (data.length == 0) {
          return;
        }
        data = readMax(data, digestLength - remoteDigest.length, function(result) {
          remoteDigest += result;
        });
      }

      t.equal(remoteDigest, crypto.createHash('sha1').update(toRecv).digest('base64'), 
      "remote and local computed digests should match");
      t.end();
    });

    sock.write(toSend);
    sock.write(digest.length.toString() + " " + digest);
  }

  function onConnectSuccess(err, connection) {

    connection = JSON.parse(connection);
    
    var client = null;
    connected = true;

    if (connection.listeningPort) {
      client = net.connect(connection.listeningPort, function () {
        shiftData(client);
      });
    } else {
      client = sockets[connection.clientPort];
      shiftData(client);
    }
  }

  function onConnectFailure() {
    if (!connected) {
      t.fail('Connect failed!');
      t.end();
    }
  }

  Mobile('peerAvailabilityChanged').registerToNative(function (peers) {
    logger.info('Received peerAvailabilityChanged with peers: ' +
      JSON.stringify(peers)
    );
    peers.forEach(function (peer) {
      if (peer.peerAvailable && !connected) {
        var RETRIES = 10;
        connectToPeer(peer, RETRIES, onConnectSuccess, onConnectFailure);
      }
    });
  });

  server.listen(0, function () {

    var applicationPort = server.address().port;

    Mobile('startUpdateAdvertisingAndListening').callNative(applicationPort,
    function (err) {
      t.notOk(err, 'Can call startUpdateAdvertisingAndListening without error');
      Mobile('startListeningForAdvertisements').callNative(function (err) {
        t.notOk(err, 'Can call startListeningForAdvertisements without error');
      });
    });
  });
});
