'use strict';

var net = require('net');
var multiplex = require('multiplex');
var tape = require('../lib/thali-tape');
var ThaliTCPServersManager = require('thali/NextGeneration/tcpServersManager');

var test = tape({
  setup: function(t) {
    t.end();
  },
  teardown: function(t) {
    t.end();
  }
});
/*
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
*/
test("client side connections all up", function(t) {

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
