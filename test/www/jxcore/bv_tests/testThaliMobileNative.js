'use strict';

var net = require('net');
var randomstring = require('randomstring');
var tape = require('../lib/thali-tape');
var express = require('express');
var ThaliMobileNativeWrapper = require('thali/NextGeneration/thaliMobileNativeWrapper');

var test = tape({
  setup: function (t) {
    ThaliMobileNativeWrapper.start(express.Router())
    .then(function () {
      t.end();
    });
  },
  teardown: function (t) {
    ThaliMobileNativeWrapper.stop()
    .then(function () {
      t.end();
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

test('Calling startListeningForAdvertisements twice is NOT an error', function (t) {
  Mobile('startListeningForAdvertisements').callNative(function (err) {
    t.notOk(err, 'Can call startListeningForAdvertisements without error');
    Mobile('startListeningForAdvertisements').callNative(function (err) {
      t.notOk(err, 'Can call startListeningForAdvertisements twice without error');
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
  ThaliMobileNativeWrapper.emitter.once('nonTCPPeerAvailabilityChangedEvent',
  function (peer) {
    t.ok(peer.hasOwnProperty('peerIdentifier'), 'peer must have peerIdentifier');
    t.ok(typeof peer.peerIdentifier === 'string', 'peerIdentifier must be a string');

    t.ok(peer.hasOwnProperty('peerAvailable'), 'peer must have peerAvailable');
    t.ok(peer.hasOwnProperty('pleaseConnect'), 'peer must have pleaseConnect');

    t.end();
  });

  Mobile('startUpdateAdvertisingAndListening').callNative(4242, function (err) {
    t.notOk(err, 'Can call startUpdateAdvertisingAndListeningwithout error');
    Mobile('startListeningForAdvertisements').callNative(function (err) {
      t.notOk(err, 'Can call startListeningForAdvertisements without error');
    });
  });
});

test('Can connect to a remote peer', function (t) {
  var echoServer = net.createServer(function (socket) {
    socket.pipe(socket);
  });

  echoServer.listen(0, function () {
    var applicationPort = echoServer.address().port;

    ThaliMobileNativeWrapper.emitter.once('nonTCPPeerAvailabilityChangedEvent',
    function (peer) {
      Mobile('connect').callNative(peer.peerIdentifier,
      function (err, connection) {
        // We're happy here if we make a connection to anyone
        if (err == null) {
          connection = JSON.parse(connection);
          console.log(connection);

          t.ok(connection.hasOwnProperty('listeningPort'), 'Must have listeningPort');
          t.ok(typeof connection.listeningPort === 'number', 'listeningPort must be a number');
          t.ok(connection.hasOwnProperty('clientPort'), 'Connection must have clientPort');
          t.ok(typeof connection.clientPort === 'number', 'clientPort must be a number');
          t.ok(connection.hasOwnProperty('serverPort'), 'Connection must have serverPort');
          t.ok(typeof connection.serverPort === 'number', 'serverPort must be a number');

          if (connection.listeningPort !== 0)
          {
            // Forward connection
            t.ok(connection.clientPort === 0);
            t.ok(connection.serverPort === 0);
          }
          else
          {
            // Reverse connection
            t.ok(connection.clientPort !== 0);
            t.ok(connection.serverPort !== 0);
          }

          t.end();
        } else {
          t.fail('Error from connect: ' + err);
          t.end();
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

  var sockets = {};
  var echoServer = net.createServer(function (socket) {
    socket.on('data', function (data) {
      socket.write(data);
    });
    socket.on('end', socket.end);
    socket.on('error', function (error) {
      console.log('Error on echo server socket: ' + error);
      t.fail();
    });
    sockets[socket.remotePort] = socket;
  });

  var dataSize = 4096;
  var toSend = randomstring.generate(dataSize);

  function shiftData(sock, reverseConnection) {
    var toRecv = '';

    sock.on('error', function (error) {
      console.log('Error on client socket: ' + error);
      t.fail();
    });

    if (reverseConnection) {

      // Since this is a reverse connection, the socket we've been handed has already
      // been accepted by our server and there's a client on the other end already
      // sending data. Without multiplex support we can't both talk at the same time so
      // wait for the other side to finish before sending our data.

      var totalRecvd = 0;
      sock.on('data', function (data) {

        totalRecvd += data.length;

        if (totalRecvd === dataSize) {
          // We've seen all the remote's data, send our own
          sock.write(toSend);
        }

        if (totalRecvd > dataSize) {
          // This should now be our own data echoing back 
          toRecv += data.toString(); 
        } 

        if (toRecv.length === dataSize) {
          // Should have an exact copy of what we sent
          t.ok(toRecv === toSend, 'received should match sent');
          t.end();
        }
      });
    } else {
      // This one's more straightforward.. we're going to send first, read back our echo and then
      // echo out any extra data
      var done = false;
      sock.on('data', function (data) {
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
            t.ok(toSend === toRecv, 'received should match sent');
            t.end();
          }
          if (data.length) {
            sock.write(data);
          }
        }
      });

      sock.write(toSend);
    }
  }

  ThaliMobileNativeWrapper.emitter.once('nonTCPPeerAvailabilityChangedEvent',
    function (peer) {
      Mobile('connect').callNative(peer.peerIdentifier,
      function (err, connection) {
        // We're happy here if we make a connection to anyone
        if (err == null) {
          connection = JSON.parse(connection);
          var client = null;
          if (connection.listeningPort) {
            console.log('Forward connection');
            // We made a forward connection
            client = net.connect(connection.listeningPort, function () {
              shiftData(client, false);
            });
          } else {
            console.log('Reverse connection');
            // We made a reverse connection
            client = sockets[connection.clientPort];
            shiftData(client, true);
          }
        }
      });
    }
  );

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
