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

test("creating a peerListener all up - no app server", function(t) {

  var applicationPort = 4242;

  Mobile("peerAvailabilityChanged").registerToNative(function(peers) {
    console.log(peers);
    peers.forEach(function(peer) {
      if (peer.peerAvailable) {
        serversManager.createPeerListener(peer.peerIdentifier, peer.pleaseConnect)
        .then(function(peerPort) {
          var client = net.createConnection(peerPort, function() {
            t.ok(true, "connection completed");
            client.end();
            serversManager.stop();
            t.end();
          });
          client.on("error", function(err) {
            t.fail("should not get error - " + err);
            serversManager.stop();
            t.end();
          });
        })
        .catch(function(err) {
          t.fail("should not get error - " + err);
          serversManager.stop(); 
        });
      }
    });
  });

  var serversManager = new ThaliTCPServersManager(applicationPort);
  serversManager.start()
  .catch(function(err) {
    t.fail("should not get error - " + err);
    serversManager.stop();
  });

  Mobile('startUpdateAdvertisingAndListening').callNative(applicationPort, 
  function (err) {
    t.notOk(err, 'Can call startUpdateAdvertisingAndListening without error');
    Mobile('startListeningForAdvertisements').callNative(function (err) {
      t.notOk(err, 'Can call startListeningForAdvertisements without error');
      Mobile("peerAvailabilityChanged").call([{ 
        peerIdentifier : "peer1", 
        pleaseConnect : true, 
        peerAvailable: true
      }]);
    });
  });
});
