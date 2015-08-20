var net = require('net');
var multiplex = require('multiplex');

function muxServerBridge(tcpEndpointServerPort) {
  // Keep track of all the client sockets we've seen
  var clientSockets = {};

  var server = net.createServer(function(incomingClientSocket) {

    incomingClientSocket.on('close', function () {
      // Remove the closed socket from out records, destroying (by
      // unref-fing) the multiplexer (we hope)
      console.log('server bridge: socket closed');
      delete clientSockets[incomingClientSocket];
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
    clientSockets[incomingClientSocket] = serverPlex;
    incomingClientSocket.pipe(serverPlex).pipe(incomingClientSocket);
  });

  server.on('error', function (err) {
    console.log('mux server bridge error %s', err);
  });

  server.on('close', function () {
    // Close all the client sockets, this'll force the server object
    // to *really* close
    console.log('server bridge: server closing (%d)', Object.keys(clientSockets).length);
    // Shutdown all the connected sockets
    Object.keys(clientSockets).forEach(function (key) {
      var sock = clientSockets[key];
      sock.end();
      sock.destroy();
    })
    clientSockets = {};
  });

  return server;
}

function muxClientBridge(localP2PTcpServerPort) {
  var clientPlex = multiplex();
  var clientSocket = net.createConnection({port: localP2PTcpServerPort});

  // Keep track of all the client sockets we've seen
  var clientStreams = {};

  var server = net.createServer(function(incomingClientSocket) {
    var clientStream = clientPlex.createStream();

    incomingClientSocket.on('close', function () {
      // Remove the closed socket from out records, destroying (by
      // unref-fing) the multiplexer (we hope)
      console.log('client bridge: socket closed');
      delete clientStreams[incomingClientSocket];
    });

    incomingClientSocket.on('timeout', function () {
      console.log('incoming client socket timeout');
    });

    incomingClientSocket.on('error', function (err) {
      console.log('incoming client socket error %s', err);
    });

    console.log('client bridge: new client socket');

    clientStreams[incomingClientSocket] = clientStream;
    incomingClientSocket.pipe(clientStream).pipe(incomingClientSocket);
  });

  server.on('error', function (err) {
    console.log('mux client bridge error %s', err);
  });

  server.on('close', function () {
    // Close all the client sockets, this'll force the server object
    // to *really* close
    console.log('client bridge: server closing (%d)', Object.keys(clientSockets).length);
    // Shutdown all the connected sockets
    Object.keys(clientStreams).forEach(function (key) {
      var streams = clientStreams[key];
      streams.end();
      streams.destroy();
    })
    clientStreams = {};
  });

  clientPlex.pipe(clientSocket).pipe(clientPlex);

  return server;
}

module.exports = {
  muxServerBridge: muxServerBridge,
  muxClientBridge: muxClientBridge
};
