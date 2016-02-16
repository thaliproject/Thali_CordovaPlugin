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
  var serversManager = new ThaliTCPServersManager(4242);
  serversManager.start()
  .then(function(localPort) {
    serversManager.once("incomingConnectionState", function(state) {
      t.ok(state == "CONNECTED", "initial connection state should be CONNECTED");
      serversManager.once("incomingConnectionState", function(state) {
        t.ok(state == "DISCONNECTED", "final connection state should be DISCONNECTED");
        serversManager.stop();
        t.end();
      });
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

    // Connect to the local server, this is what happens when a new
    // p2p link is established. 
    var client = net.createConnection(localPort, function() {
      // We're now pretending to be the other side of a p2p link.
      // Add a mux to our socket and create a stream. The other
      // side should then try to connect to the application, 
      // fail, and emit the routerPortConnectionFailed event
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


