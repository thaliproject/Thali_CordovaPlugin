'use strict';

var net = require('net');
var randomstring = require('randomstring');
var tape = require('../lib/thali-tape');
var makeIntoCloseAllServer = require('thali/NextGeneration/makeIntoCloseAllServer');
var logger = require('thali/thalilogger')('testThaliMobileNative');

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

test('cannot call connect when start listening for advertisements is not ' +
  'active', function (t) {
  Mobile('connect').callNative('foo', function (err) {
    t.equal(err, 'startListeningForAdvertisements is not active',
      'got right error');
    t.end();
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

function getMessageAndThen(t, socket, messageToReceive, cb) {
  var readData = new Buffer(0);
  socket.on('data', function (data) {
    logger.info('got data');
    readData = Buffer.concat([readData, data]);
    if (readData.length === messageToReceive.length &&
      Buffer.compare(messageToReceive, readData) === 0) {
      return cb();
    }

    if (readData.length >= messageToReceive.length) {
      t.fail('data is not equal or is too long');
      t.end();
    }
  });
}

function connectToPeer(peer, retries, successCb, failureCb) {

  var TIME_BETWEEN_RETRIES = 3000;

  retries--;
  Mobile('connect').callNative(peer.peerIdentifier, function (err, connection) {

    if (err == null) {
      // Connected successfully..
      successCb(err, connection);
    } else {
      logger.info('Connect returned an error: ' + err);
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

function startAndGetConnection(t, server, onConnectSuccess, onConnectFailure) {
  var connecting = false;
  server.listen(0, function () {

    var applicationPort = server.address().port;

    Mobile('peerAvailabilityChanged').registerToNative(function (peers) {
      logger.info('Received peerAvailabilityChanged with peers: ' +
        JSON.stringify(peers)
      );
      peers.forEach(function (peer) {
        if (peer.peerAvailable && !connecting) {
          connecting = true;
          var RETRIES = 10;
          connectToPeer(peer, RETRIES, onConnectSuccess, onConnectFailure);
        }
      });
    });

    Mobile('startUpdateAdvertisingAndListening').callNative(applicationPort,
      function (err) {
        t.notOk(err, 
          'Can call startUpdateAdvertisingAndListening without error');
        Mobile('startListeningForAdvertisements').callNative(function (err) {
          t.notOk(err, 
            'Can call startListeningForAdvertisements without error');
        });
      });
  });
}

test('Can connect to a remote peer', function (t) {
  var connecting = false;

  var echoServer = net.createServer(function (socket) {
    socket.pipe(socket);
  });
  echoServer = makeIntoCloseAllServer(echoServer);
  serverToBeClosed = echoServer;

  function onConnectSuccess(err, connection) {

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
    t.fail('Connect failed!');
    t.end();
  }

  echoServer.listen(0, function () {

    var applicationPort = echoServer.address().port;

    Mobile('peerAvailabilityChanged').registerToNative(function (peers) {
      logger.info('Received peerAvailabilityChanged with peers: ' +
        JSON.stringify(peers)
      );
      peers.forEach(function (peer) {
        if (peer.peerAvailable && !connecting) {
          connecting = true;
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

  var connecting = false;

  var sockets = {};
  var echoServer = net.createServer(function (socket) {
    socket.on('data', function (data) {
      socket.write(data);
    });
    socket.on('end', socket.end);
    socket.on('error', function (error) {
      logger.warn('Error on echo server socket: ' + error);
      t.fail();
    });
    sockets[socket.remotePort] = socket;
  });
  echoServer = makeIntoCloseAllServer(echoServer);
  serverToBeClosed = echoServer;

  var dataSize = 4096;
  var toSend = randomstring.generate(dataSize);

  function shiftData(sock, reverseConnection) {

    sock.on('error', function (error) {
      logger.warn('Error on client socket: ' + error);
      t.fail();
    });

    var toRecv = '';

    if (reverseConnection) {

      // Since this is a reverse connection, the socket we've been handed has
      // already been accepted by our server and there's a client on the other
      // end already sending data.
      // Without multiplex support we can't both talk at the same time so
      // wait for the other side to finish before sending our data.

      var totalRecvd = 0;
      sock.on('data', function (data) {

        logger.info('reverseData');
        totalRecvd += data.length;

        if (totalRecvd === dataSize) {
          logger.info('reverseSend');
          // We've seen all the remote's data, send our own
          sock.write(toSend);
        }

        if (totalRecvd > dataSize) {
          // This should now be our own data echoing back
          toRecv += data.toString(); 
        } 

        if (toRecv.length === dataSize) {
          // Should have an exact copy of what we sent
          t.ok(toRecv === toSend, 'received should match sent reverse');
          t.end();
        }
      });
    }
    else {
    
      // This one's more straightforward.. we're going to send first,
      // read back our echo and then echo out any extra data

      var done = false;
      sock.on('data', function (data) {

        logger.info('forwardData');

        var remaining = dataSize - toRecv.length;

        if (remaining >= data.length) {
          toRecv += data.toString();
          data = data.slice(0, 0);
        }
        else {
          toRecv += data.toString('utf8', 0, remaining);
          data = data.slice(remaining);
        }

        if (toRecv.length === dataSize) {
          if (!done) {
            done = true;
            t.ok(toSend === toRecv, 'received should match sent forward');
            t.end();
          }
          if (data.length) {
            sock.write(data);
          }
        }
      });

      logger.info('forwardSend');
      sock.write(toSend);
    }
  }

  function onConnectSuccess(err, connection) {

    var client = null;

    // We're happy here if we make a connection to anyone
    connection = JSON.parse(connection);
    logger.info(connection);

    if (connection.listeningPort) {
      logger.info('Forward connection');
      // We made a forward connection
      client = net.connect(connection.listeningPort, function () {
        shiftData(client, false);
      });
    } else {
      logger.info('Reverse connection');
      // We made a reverse connection
      client = sockets[connection.clientPort];
      shiftData(client, true);
    }
  }

  function onConnectFailure() {
    t.fail('Connect failed!');
    t.end();
  }

  Mobile('peerAvailabilityChanged').registerToNative(function (peers) {
    peers.forEach(function (peer) {
      if (peer.peerAvailable && !connecting) {
        connecting = true;
        var RETRIES = 10;
        connectToPeer(peer, RETRIES, onConnectSuccess, onConnectFailure);
      }
    });
  });

  echoServer.listen(0, function () {

    var applicationPort = echoServer.address().port;

    Mobile('startUpdateAdvertisingAndListening').callNative(applicationPort,
    function (err) {
      t.notOk(err, 'Can call startUpdateAdvertisingAndListening without error');
      Mobile('startListeningForAdvertisements').callNative(function (err) {
        t.notOk(err, 'Can call startListeningForAdvertisements without error');
      });
    });
  });
});

test('#startUpdateAdvertisingAndListening - killing remote peers connection ' +
  'kills the local connection', function (t) {

    // pretendLocalMux ---> listeningPort ---> remoteServerNativeListener --->
    //   other side's pretendLocalMux
    // We want to show that killing the connection between listeningPort
    // and remoteServerNativeListener will cause the connection between
    // pretendLocalMux and listeningPort to be terminated.
    var testMessage = new Buffer('I am a test message!');
    var closeMessage = new Buffer('I am closing down now!');
  
    var pretendLocalMux = net.createServer(function (socket) {
      getMessageAndThen(t, socket, testMessage, function () {
        socket.write(closeMessage, function () {
          socket.end();
        });
      });
    });
  
    pretendLocalMux.on('error', function (err) {
      logger.debug('got error on pretendLocalMux ' + err);
    });
    
    pretendLocalMux = makeIntoCloseAllServer(pretendLocalMux);
    serverToBeClosed = pretendLocalMux;
  
    function onConnectSuccess(err, connection) {
      connection = JSON.parse(connection);
      var gotCloseMessage = false;
      if (connection.listeningPort === 0) {
        // This is a reverse connection, we aren't testing that
        t.end();
      }

      logger.info('connection ' + JSON.stringify(connection));
      
      var connectToListeningPort = net.connect(connection.listeningPort,
        function () {
          logger.info('connection to listening port is made');
          connectToListeningPort.write(testMessage);
        });
      
      getMessageAndThen(t, connectToListeningPort, closeMessage, function () {
        gotCloseMessage = true;
      });
      
      connectToListeningPort.on('error', function (err) {
        t.ok(err, 'We got an error, it can happen ' + err);
      });
      
      connectToListeningPort.on('close', function () {
        t.ok(gotCloseMessage, 'We got the close message and we are closed');
        t.end();
      });
    }
  
    function onConnectFailure() {
      t.fail('Connect failed');
      t.end();
    }
  
    startAndGetConnection(t, pretendLocalMux, onConnectSuccess, 
                          onConnectFailure);
});

test('We do not send peerAvailabilityChanged events until one of the start ' +
  'methods is called', function (t) {
  t.ok(true, 'PLEASE IMPLEMENT ME');
  t.end();
});
