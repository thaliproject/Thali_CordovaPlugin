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
    clientSockets.push(serverPlex);
    incomingClientSocket.pipe(serverPlex).pipe(incomingClientSocket);
  });

  server.on('error', function (err) {
    console.log('mux server bridge error %s', err);
  });

  server.on('close', function () {
    // Close all the client sockets, this'll force the server object
    // to *really* close
    console.log('server bridge: server closing (%d)', clientSockets.length);
    // Shutdown all the connected sockets
    clientSockets.forEach(function (sock) {
      sock.end();
      sock.destroy();
    });
    clientSockets.length = 0;
  });

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

  server.on('close', function () {
    // Close all the client sockets, this'll force the server object
    // to *really* close
    console.log('client bridge: server closing (%d)', clientSockets.length);
    // Shutdown all the connected sockets
    clientSockets.forEach(function (sock) {
      sock.end();
      sock.destroy();
    });
    
    clientSockets.length = 0;
  });

  clientPlex.pipe(clientSocket).pipe(clientPlex);

  return server;
}

module.exports = {
  muxServerBridge: muxServerBridge,
  muxClientBridge: muxClientBridge
};
