'use strict';

var net = require('net');
var multiplex = require('multiplex');
var tape = require('../lib/thali-tape');
var ThaliTCPServersManager = require('thali/NextGeneration/tcpServersManager');

if (typeof Mobile === 'undefined') {
  global.Mobile = require('../lib/MockMobile');
}

var test = tape({
  setup: function(t) {
    t.end();
  },
  teardown: function(t) {
    t.end();
  }
});

test("can create servers manager", function(t) {
  var manager = new ThaliTCPServersManager(4242);
  t.ok(manager != null, "manager must not be null");
  t.ok(typeof manager == 'object', "manager must be an object");
  t.end();
});

test("can start/stop servers manager", function(t) {
  var serversManager = new ThaliTCPServersManager(4242);
  serversManager.start()
  .then(function(localPort) {
    t.ok(localPort > 0 && localPort <= 65535, 'port must be in range');
    serversManager.stop();
    t.end();
  })
  .catch(function(err) {
    t.fail("should not get error - " + err);
    serversManager.stop();
  });
});

test("calling startNativeListener directly throws", function(t) {
  var serversManager = new ThaliTCPServersManager(4242);
  serversManager.start()
  .then(function(localPort) {
    serversManager.createNativeListener();
  })
  .catch(function(err) {
    t.equal(err.message, "Don't call directly!", "Should throw");
    serversManager.stop();
    t.end();
  });
});

test("emits incomingConnectionState", function(t) {

  // Ensure that dis/connecting to the the localPort of a servers manager
  // emits incomingConnectionState events

  var serversManager = new ThaliTCPServersManager(4242);
  serversManager.start()
  .then(function(localPort) {

    // Expect CONNECTED the DISCONNECTED
    serversManager.once("incomingConnectionState", function(state) {
      t.ok(state == "CONNECTED", "initial connection state should be CONNECTED");
      serversManager.once("incomingConnectionState", function(state) {
        t.ok(state == "DISCONNECTED", "final connection state should be DISCONNECTED");
        serversManager.stop();
        t.end();
      });

      // We've had CONNECTED, trigger DISCONNECTED
      client.end();
    });

    var client = net.createConnection(localPort, function() {
    });

  })
  .catch(function(err) {
    t.fail("should not get error - " + err);
    serversManager.stop();
  });
});

test("emits routerPortConnectionFailed", function(t) {

  // Make the server manager try and connect to a non-existent application

  var serversManager = new ThaliTCPServersManager(4242);
  serversManager.start()
  .then(function(localPort) {

    // Expect the routerPortConnectionFailed event
    serversManager.once("routerPortConnectionFailed", function() {
      t.ok(true, "routerPortConnectionFailed is emitted");
      serversManager.stop();
      t.end();
    });

    var client = net.createConnection(localPort, function() {
      var mux = multiplex();
      client.pipe(mux).pipe(client);
      mux.createStream();
    });
  })
  .catch(function(err) {
    t.fail("should not get error - " + err);
    serversManager.stop();
  });
});

test("native server connections all up", function(t) {

  // Start the servers manager and then connect muxed sockets directly
  // to it (would normally be done by the p2p layer)

  var clientSockets = 0;
  var applicationServer = net.createServer(function(client) {
    clientSockets += 1;
    client.pipe(client);
  });
  applicationServer.listen(4242);

  var serversManager = new ThaliTCPServersManager(4242);
  serversManager.start()
  .then(function(localPort) {

    var client = net.createConnection(localPort, function() {

      var mux = multiplex();
      client.pipe(mux).pipe(client);
      var stream1 = mux.createStream();
      var stream2 = mux.createStream();

      var toSend = 4096;
      var toSend1 = new Array(toSend + 1).join('1');;
      var toSend2 = new Array(toSend + 1).join('2');;

      var recvStream1 = "";
      var recvStream2 = "";

      var doneStream1 = false;
      var doneStream2 = false;

      stream1.on("data", function(data) {
        recvStream1 += data.toString();
        if (recvStream1.length >= toSend) {

          doneStream1 = true;
          t.ok(recvStream1.length == toSend, "Send/recvd #1 should be equal length");
          t.ok(recvStream1 == toSend1, "Send/recvd #1 should be same");

          if (doneStream2) {
            t.ok(clientSockets == 2, "Should be exactly 2 client sockets");
            applicationServer.close();
            serversManager.stop();
            console.log("end");
            t.end();
          }
        }
      });

      stream2.on("data", function(data) {
        recvStream2 += data.toString();
        if (recvStream2.length >= toSend) {

          doneStream2 = true;
          t.ok(recvStream2.length == toSend, "Send/recvd #2 should be equal length");
          t.ok(recvStream2 == toSend2, "Send/recvd #2 should be same");

          if (doneStream1) {
            t.ok(clientSockets == 2, "Should be exactly 2 client sockets");
            applicationServer.close();
            serversManager.stop();
            t.end();
          }
        }
      });

      stream1.write(toSend1);
      stream2.write(toSend2);
    });
  })
  .catch(function(err) {
    t.fail("should not get error - " + err);
    serversManager.stop();
  });

});

test("can call createPeerListener (pleaseConnect == false)", function(t) {
  var serversManager = new ThaliTCPServersManager(4242);
  serversManager.start()
  .then(function(localPort) {
    serversManager.createPeerListener("peerId", false)
    .then(function(peerPort) {
      t.ok(peerPort > 0 && peerPort <= 65535, "port must be in range");
      serversManager.stop();
      t.end();
    });
  })
  .catch(function(err) {
    t.fail("should not get error - " + err);
    serversManager.stop();
  });
});

test("calling createPeerListener (pleaseConnect == true) with unknown peer is error", function(t) {
  var serversManager = new ThaliTCPServersManager(4242);
  serversManager.start()
  .then(function(localPort) {
    serversManager.createPeerListener("peerId", true)
    .catch(function(err) {
      // Should get an error here, we haven't yet started browsing or discovered
      // any peers
      t.ok(err, "should get error");
      serversManager.stop(); 
      t.end();
    });
  })
  .catch(function(err) {
    t.fail("should not get error - " + err);
    serversManager.stop();
  });
});

////////////////////////////////////////////////////////////////////////////
// Now we get to the complex stuff
////////////////////////////////////////////////////////////////////////////

/////////////////////////
// Some utility functions

function waitForPeerAvailabilityChanged(t, serversManager, then) {
  Mobile("peerAvailabilityChanged").registerToNative(function(peers) {
    peers.forEach(function(peer) {
      if (peer.peerAvailable) {
        serversManager.createPeerListener(peer.peerIdentifier, peer.pleaseConnect)
        .then(function(peerPort) {
          if (then) {
            then(peerPort);
          }
        })
        .catch(function(err) {
          t.fail("should not get error");
          console.log(err.stack);
          serversManager.stop(); 
        });
      }
    });
  });
}

function startAdvertisingAndListening(t, applicationPort, pleaseConnect) {

  Mobile('startUpdateAdvertisingAndListening').callNative(applicationPort, 
  function (err) {
    t.notOk(err, 'Can call startUpdateAdvertisingAndListening without error');
    Mobile('startListeningForAdvertisements').callNative(function (err) {
      t.notOk(err, 'Can call startListeningForAdvertisements without error');
      Mobile("peerAvailabilityChanged").callRegistered([{ 
        peerIdentifier : "peer1", 
        pleaseConnect : pleaseConnect,
        peerAvailable: true
      }]);
    });
  });
}

function startServersManager(t, serversManager) {
  serversManager.start()
  .catch(function(err) {
    t.fail("should not get error");
    console.log(err.stack());
    serversManager.stop();
  });
}

function setUp(t, serversManager, applicationPort, forwardConnection, pleaseConnect, then) {

  waitForPeerAvailabilityChanged(t, serversManager, then);

  startServersManager(t, serversManager);
  
  if (forwardConnection != 0) {
    Mobile("connect").nextNative(function(peerIdentifier, cb) {
      cb(null, {listeningPort:forwardConnection, clientPort:0, serverPort:0});
    });
  }
  
  startAdvertisingAndListening(t, applicationPort, pleaseConnect);
}

// End of Utility functions
///////////////////////////

test("creating a peerListener (pleaseConnect == true) - no native server", function(t) {

  var nativePort = 4040;
  var applicationPort = 4242;

  // We expect 'failedConnection' since there's no app listening
  var serversManager = new ThaliTCPServersManager(applicationPort);
  serversManager.on("failedConnection", function(err) {
    t.equal(err.error, "Cannot Connect To Peer", "reason should be as expected");
    serversManager.stop();
    t.end();
  });

  setUp(t, serversManager, applicationPort, nativePort, true, function(peerPort) {
    t.notEqual(peerPort, nativePort, "peerPort should not be nativePort");
  });
});

test("creating a peerListener (pleaseConnect == false) - no app server", function(t) {

  var nativePort = 4040;
  var applicationPort = 4242;
  var firstConnection = false;

  // We expect 'failedConnection' since there's no app listening
  var serversManager = new ThaliTCPServersManager(applicationPort);
  serversManager.on("failedConnection", function(err) {
    t.ok(firstConnection, "should not get event until connection is made");
    t.equal(err.error, "Cannot Connect To Peer", "reason should be as expected");
    serversManager.stop();
    t.end();
  });

  setUp(t, serversManager, applicationPort, nativePort, false, function(peerPort) {
    t.notEqual(peerPort, nativePort, "peerPort should not be nativePort");
    var client = net.createConnection(peerPort);
    firstConnection = true;
  });
});

test("creating a peerListener (pleaseConnect == true) - with native server", function(t) {

  var nativePort = 4040;
  var applicationPort = 4242;

  var serversManager = new ThaliTCPServersManager(applicationPort);
  serversManager.on("failedConnection", function(err) {
    t.fail("Shouldn't fail to connect to native listener");
  });

  var nativeServer = net.createServer(function(socket) {
    t.ok(true, "Should get spontaneous connection");
    serversManager.stop();
    nativeServer.close();
    socket.end();
    t.end();
  });
  nativeServer.listen(nativePort, function(err) {
    if (err) {
      t.fail("nativeServer should not fail");
      t.end();
    }
  });

  setUp(t, serversManager, applicationPort, nativePort, true, function(peerPort) {
    t.notEqual(peerPort, nativePort, "peerPort != nativePort");
  });
});

test("creating a peerListener (pleaseConnect == false) - with native server", function(t) {

  var nativePort = 4040;
  var applicationPort = 4242;
  var firstConnection = false;

  var serversManager = new ThaliTCPServersManager(applicationPort);
  // We expect 'failedConnection' since there's no native listener
  serversManager.on("failedConnection", function(err) {
    t.ok(firstConnection, "should not get event until connection is made");
    t.equal(err.error, "Cannot Connect To Peer", "reason should be as expected");
    serversManager.stop();
    t.end();
  });

  var nativeServer = net.createServer(function(socket) {
    t.ok(firstConnection, "Should not get unexpected connection");
    t.ok(true, "Should get connection");
    serversManager.stop();
    nativeServer.close();
    socket.end();
    t.end();
  });
  nativeServer.listen(nativePort, function(err) {
    if (err) {
      t.fail("nativeServer should not fail");
      t.end();
    }
  });

  setUp(t, serversManager, applicationPort, nativePort, false, function(peerPort) {
    t.notEqual(peerPort, nativePort, "peerPort != nativePort");
    // Need to connect a socket to force the outgoing 
    var client = net.createConnection(peerPort);
    firstConnection = true;
  });
});
