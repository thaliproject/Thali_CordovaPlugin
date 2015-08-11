'use strict';

var multiplex = require('multiplex');

function noop () { }

/**
 * Creates a multiplex server bridge with a TCP end point server port for the client socket.
 * @param {Number} tcpEndpointServerPort the TCP end point server port to create the server.
 * @returns {net.Server} a multiplex server bridge
 */
function muxServerBridge(tcpEndpointServerPort) {
  var serverPlex = multiplex({}, function(stream, id) {
    var clientSocket = net.createConnection({port: tcpEndpointServerPort});
    stream.pipe(clientSocket).pipe(stream);
  });

  return net.createServer(function(incomingClientSocket) {
    incomingClientSocket.pipe(serverPlex).pipe(incomingClientSocket);
  });
}

/**
 * Creates a multiplex client bridge with a local p2p TCP server port.
 * @param {Number} localP2PTcpServerPort a local peer to peer TCP server port to create a socket.
 * @param {Function} [cleanUpCallBack] an optional callback in case the client socket closes before it is ready.  Defaults to a noop if not specified
 * @returns {net.Server} a multiplex client bridge server.
 */
function muxClientBridge(localP2PTcpServerPort, cleanUpCallBack) {
  cleanUpCallBack || (cleanUpCallBack = noop)
  var clientPlex = multiplex();
  var clientSocket = net.createConnection({port: localP2PTcpServerPort});

  var server = net.createServer(function(incomingClientSocket) {
    var clientStream = clientPlex.createStream();
    incomingClientSocket.pipe(clientStream).pipe(incomingClientSocket);
  });

  cleanUpSocket(clientSocket, function() {
    clientPlex.destroy();
    var err = null;
    try {
      server.close();
    } catch(e) {
      e = err;
    }
    cleanUpCallBack(err);
  });

  clientPlex.pipe(clientSocket).pipe(clientPlex);

  return server;
}

function cleanUpSocket(socket, cleanUpCallBack) {
  var isClosed = false;

  socket.on('end', function() {
    cleanUpCallBack();
    isClosed = true;
  });

  socket.on('error', function(err) {
    cleanUpCallBack(err);
    isClosed = true;
  });

  socket.on('close', function() {
    if (!isClosed) {
      cleanUpCallBack();
      isClosed = true;
    }
  });
}

module.exports = {
  muxServerBridge: muxServerBridge,
  muxClientBridge: muxClientBridge
};
