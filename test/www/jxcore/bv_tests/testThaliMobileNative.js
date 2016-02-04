"use strict";

var net = require('net');

if (jxcore.utils.OSInfo().isAndroid) {
  // REMOVE ME WHEN READY TO TEST ANDROID !!!
  return;
}

if (!jxcore.utils.OSInfo().isMobile) {
  return;
}

var tape = require('../lib/thali-tape');

var test = tape({
  setup: function(t) {
    t.end();
  },
  teardown: function(t) {
    // Need to call stops here to ensure we're in stopped state since Mobile is a static
    // singleton
    Mobile('stopListeningForAdvertisements').callNative(function (err) {
      t.notOk(err, "Should be able to call stopListeningForAdvertisments in teardown");
      Mobile('stopAdvertisingAndListening').callNative(function(err) {
        t.notOk(
          err, 
          "Should be able to call stopAdvertisingAndListening in teardown"
        );
        t.end();
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

test('Calling startListeningForAdvertisements twice is an error', function (t) {
  Mobile('startListeningForAdvertisements').callNative(function (err) {
    t.notOk(err, 'Can call startListeningForAdvertisements without error');
    Mobile('startListeningForAdvertisements').callNative(function (err) {
      t.ok(err, 'Calling start twice is an error');
      t.ok(err == "Call Stop!", 'Error must be "Call Stop!"');
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

test('Calling startUpdateAdvertisingAndListening twice is NOT and error', 
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

test('peerAvailabilityChange is called', function (t) {

  var complete = false;

  Mobile("peerAvailabilityChanged").registerToNative(function(peers) {

    if (!complete)
    {
      t.ok(peers instanceof Array, "peers must be an array");
      t.ok(peers.length != 0, "peers must not be zero-length");

      t.ok(peers[0].hasOwnProperty("peerIdentifier"), "peer must have peerIdentifier");
      t.ok(typeof peers[0].peerIdentifier === 'string', "peerIdentifier must be a string");
      
      t.ok(peers[0].hasOwnProperty("peerAvailable"), "peer must have peerAvailable");
      t.ok(peers[0].hasOwnProperty("pleaseConnect"), "peer must have pleaseConnect");

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

test('Can connect to a remote peer', function (t) {

  var complete = false;
  var applicationPort = 4242;

  var echoServer = net.createServer(function(socket) {
    socket.pipe(socket);
  });

  echoServer.listen(applicationPort, '127.0.0.1');

  Mobile("peerAvailabilityChanged").registerToNative(function(peers) {
    peers.forEach(function(peer) {
      if (peer.peerAvailable) {
        Mobile("connect").callNative(peer.peerIdentifier, function(err, connection) {
          // We're happy here if we make a connection to anyone
          if (err == null) {
            connection = JSON.parse(connection);
            if (!complete) {
              console.log(connection);
              t.ok(connection.listeningPort, "Connection must have listeningPort");
              t.ok(typeof connection.listeningPort === 'number', "listeningPort must be a number");
              t.ok(connection.hasOwnProperty("clientPort"), "Connection must have clientPort");
              t.ok(!connection.clientPort, "clientPort must be null");
              t.ok(connection.hasOwnProperty("serverPort"), "Connection must have serverPort");
              t.ok(!connection.serverPort, "serverPort must be null");
              t.end();
            }
          }
        });
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
