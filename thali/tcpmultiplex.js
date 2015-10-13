var net = require('net');
var multiplex = require('multiplex');

function muxServerBridge(tcpEndpointServerPort) {
  // Keep track of all the client sockets we've seen
  var clientSockets = [];

  var server = net.createServer(function(incomingClientSocket) {

    incomingClientSocket.on('close', function () {
      // Remove the closed socket from out records, destroying (by
      // unref-fing) the multiplexer (we hope)
      console.log('server bridge: socket closed');
      clientSockets.splice(clientSockets.indexOf(incomingClientSocket), 1);
    });

    incomingClientSocket.on('timeout', function () {
      console.log('incoming client socket timeout');
    });

    incomingClientSocket.on('error', function (err) {
      console.log('incoming client socket error %s', err);
    });

    console.log('server bridge: new client socket');

    // We'll need a new multiplex object for each incoming socket
    var serverPlex = multiplex({}, function(stream, id) {
      var clientSocket = net.createConnection({port: tcpEndpointServerPort});
      stream.pipe(clientSocket).pipe(stream);
    });

    // Record the mapping between incoming socket and multiplex
    clientSockets.push(incomingClientSocket);
    incomingClientSocket.pipe(serverPlex).pipe(incomingClientSocket);
  });

  server.on('error', function (err) {
    console.log('mux server bridge error %s', err);
  });

  server.on('close', function () {
    console.log('mux server bridge listener closed');
  });

  server.exit = function() {
    console.log('server bridge: server exiting (%d)', clientSockets.length);
    // Shutdown all the connected sockets
    clientSockets.forEach(function (sock) {
      sock.end();
    });
    clientSockets = [];
    this.close();
  };

  return server;
}

function muxClientBridge(localP2PTcpServerPort, cb) {
  var clientPlex = multiplex();
  var clientSocket = net.createConnection({port: localP2PTcpServerPort}, function () {
    cb();
  });

  clientSocket.on('error', function (err) {
    cb(err);
  });

  // Keep track of all the client sockets we've seen
  var clientSockets = [];

  var server = net.createServer(function(incomingClientSocket) {
    var clientStream = clientPlex.createStream();

    incomingClientSocket.on('close', function () {
      // Remove the closed socket from out records, destroying (by
      // unref-fing) the multiplexer (we hope)
      console.log('client bridge: socket closed');
      clientSockets.splice(clientSockets.indexOf(incomingClientSocket), 1);
    });

    incomingClientSocket.on('timeout', function () {
      console.log('incoming client socket timeout');
    });

    incomingClientSocket.on('error', function (err) {
      console.log('incoming client socket error %s', err);
    });

    console.log('client bridge: new client socket');

    clientSockets.push(incomingClientSocket);
    incomingClientSocket.pipe(clientStream).pipe(incomingClientSocket);
  });

  server.on('error', function (err) {
    console.log('mux client bridge error %s', err);
  });

  clientPlex.pipe(clientSocket).pipe(clientPlex);

  server.exit = function() {
    console.log('client bridge: server exiting (%d)', clientSockets.length);
    // Shutdown all the connected sockets
    clientSockets.forEach(function (sock) {
      sock.end();
    });
    clientSockets = [];
    this.close();
  }
 
  return server;
}

module.exports = {
  muxServerBridge: muxServerBridge,
  muxClientBridge: muxClientBridge
};
