'use strict';

var logger = require('../../ThaliLogger')('createPeerListener');
var multiplex = require('multiplex');
var net = require('net');
var makeIntoCloseAllServer = require('./../makeIntoCloseAllServer');
var Promise = require('lie');
var assert = require('assert');
var thaliConfig = require('./../thaliConfig');

/**
 * Maximum number of peers we support simultaneously advertising as being
 * available to be connected to
 * @type {number}
 */
var maxPeersToAdvertise =
  thaliConfig.MAXIMUM_NATIVE_PEERS_CREATE_PEER_LISTENER_ADVERTISES;

function closeServer(self, server, failedConnectionErr, canRetry)
{
  if (server._closing) {
    return;
  }
  server._closing = true;
  server.closeAll();
  server._mux && server._mux.destroy();
  server._mux = null;
  delete self._peerServers[server._peerIdentifier];
  if (failedConnectionErr) {
    self.emit('failedConnection', {
      'error': failedConnectionErr,
      'peerIdentifier': server._peerIdentifier
    });
  }
  if (canRetry) {
    logger.debug('Recreating listener');
    // We use next tick just to avoid building up a stack but we want
    // to make sure this code runs before anyone else so we can grab
    // the server spot for the identifier we are using and no this probably
    // isn't actually required and we could have used setImmediate
    process.nextTick(function () {
      createPeerListener(self, server._peerIdentifier, false)
        .then(function (port) {
          self.emit('listenerRecreatedAfterFailure', {
            'peerIdentifier': server._peerIdentifier,
            'portNumber': port
          });
        })
        .catch(function (err) {
          logger.warn('Got error trying to restart listener after failure -' +
            err);
        });
    });
  }
}

module.exports.closeServer = closeServer;

function findMuxForReverseConnection(nativeServer, clientPort) {
  // Find the mux for the reverse connection based on
  // incoming socket's remote port
  var mux = null;
  logger.debug('looking up mux for client port: ', clientPort);
  nativeServer._incoming.forEach(function (i) {
    if (i.remotePort === clientPort) {
      mux = i._mux;
    }
  });
  return mux;
}

function multiplexToNativeListener(self, listenerOrIncomingConnection, server,
                                   cb)
{
  // Create an outgoing socket to the native listener via a mux
  // New streams created on this mux by the remote side are initiated
  // by the user app connecting a socket to a remote thali server
  var outgoing = net.createConnection(
    listenerOrIncomingConnection.listeningPort,
    function () {
      var mux = multiplex(function onStream(stream) {
        var client = net.createConnection(self._routerPort, function () {
          client.pipe(stream).pipe(client);
        });

        stream.on('error', function (err) {
          logger.debug('multiplexToNativeListener.stream ' + err);
          client.destroy();
        });

        stream.on('finish', function () {
          stream.destroy();
          client.end();
        });

        stream.on('close', function () {
          client.destroy();
        });

        client.on('error', function (err) {
          logger.debug('multiplexToNativeListener.client ' + err);
          stream.destroy();
          self.emit('routerPortConnectionFailed', {
            error: err,
            routerPort: self._routerPort
          });
        });

        client.on('finish', function () {
          stream.end();
        });

        client.on('close', function () {
          stream.destroy();
        });
      });

      mux.on('error', function (err) {
        logger.debug('multiplexToNativeListener.mux ' + err);
        outgoing.destroy();
      });

      mux.on('finish', function () {
        outgoing.end();
      });

      mux.on('close', function () {
        outgoing.end();
      });

      outgoing.on('data', function () {
        var peerServerEntry = self._peerServers[server._peerIdentifier];
        if (peerServerEntry) {
          peerServerEntry.lastActive = Date.now();
        }
      });

      outgoing.on('error', function (err) {
        logger.debug('Got error on outgoing to native - ' + err);
        mux.destroy();
      });

      outgoing.on('finish', function () {
        mux.end();
      });

      outgoing.on('close', function () {
        mux.destroy();
      });

      outgoing.pipe(mux).pipe(outgoing);

      server._mux = mux;

      if (cb) {
        // Callback on successful connection
        cb();
      }
    });

  return outgoing;
}

function handleForwardConnection(self, listenerOrIncomingConnection, server,
                                 resolve, reject) {
  logger.debug('forward connection');
  var promiseResolved = false;

  // Connect to the native listener and mux the connection
  // When the other side creates a stream, send it to the application
  var outgoing = multiplexToNativeListener(self, listenerOrIncomingConnection,
    server,
    function onConnection() {
      promiseResolved = true;
      resolve();
    });

  outgoing.on('error', function (err) {
    logger.warn(err);
    var error = new Error('Cannot Connect To Peer');
    error.outgoingError = err;
    closeServer(self, server, error, true);
    if (!promiseResolved) {
      promiseResolved = true;
      reject();
    }
  });

  outgoing.on('close', function () {
    closeServer(self, server, null, true);
  });

  outgoing.on('timeout', function () {
    outgoing.destroy();
  });
}

function handleReverseConnection(self, incoming, server,
                                 listenerOrIncomingConnection) {
  // We expect to be connected to from the p2p side which
  // implies by the time we get here there is already a
  // client socket connected to the server set up by
  // _createNativeListener, find the associated mux
  // and hook it to our incoming connection

  logger.debug('reverse connection');

  if (listenerOrIncomingConnection.clientPort in
    self._pendingReverseConnections) {
    clearTimeout(
      self._pendingReverseConnections[
        listenerOrIncomingConnection.clientPort].timerCancel);
    delete self._pendingReverseConnections[
      listenerOrIncomingConnection.clientPort];
  }

  if (listenerOrIncomingConnection.serverPort !==
    self._nativeServer.address().port) {
    logger.warn('failedConnection');
    // This isn't the socket you're looking for !!
    assert(incoming, 'Reverse connections should only happen after we get a' +
      'TCP incoming request, pleaseConnect === true should never trigger' +
      'one so we should always have an incoming');
    incoming.destroy();
    closeServer(self, server, new Error('Mismatched serverPort'), true);
    server._firstConnection = true;
    return false;
  }

  // Find the mux for the incoming socket that should have
  // been created when the reverse connection completed
  var mux = findMuxForReverseConnection(self._nativeServer,
                                      listenerOrIncomingConnection.clientPort);
  if (!mux) {
    logger.debug('no mux found');
    incoming.destroy();
    closeServer(self, server, new Error('Incoming connection died'), true);
    server._firstConnection = true;
    return false;
  }

  server._mux = mux;
  return true;
}

function connectToRemotePeer(self, incoming, peerIdentifier, server,
                             pleaseConnect)
{
  return new Promise(function (resolve, reject) {
    assert(server._firstConnection, 'We should only get called once');
    server._firstConnection = false;
    logger.debug('first connection');

    Mobile('connect').callNative(peerIdentifier, // jshint ignore:line
      function (err, unParsedConnection) {
        if (err) {
          var error = new Error(err);
          logger.warn(error);
          logger.debug('failedConnection');
          incoming && incoming.end();
          closeServer(self, server, error, true);
          return reject(error);
        }
        var listenerOrIncomingConnection = JSON.parse(unParsedConnection);
        if (listenerOrIncomingConnection.listeningPort === 0) {
          if (pleaseConnect) {
            logger.warn('was expecting a forward connection to be made');
            closeServer(self, server, new Error('Cannot Connect To Peer'),
                        true);
            return reject(new Error('Unexpected Reverse Connection'));
          }
          // So this is annoying.. there's no guarantee on the order of the
          // server running it's onConnection handler and us getting here.
          // So we don't always find a mux when handling a reverse
          // connection. Handle that here.

          if (findMuxForReverseConnection(self._nativeServer,
              listenerOrIncomingConnection.clientPort)) {
            handleReverseConnection(self, incoming, server,
                                    listenerOrIncomingConnection);
            return resolve();
          }
          else {
            // Record the pending connection, give it a second to turn up
            self._pendingReverseConnections[
              listenerOrIncomingConnection.clientPort] = {
              handleReverseConnection : function () {
                handleReverseConnection(self, incoming, server,
                                        listenerOrIncomingConnection);
                resolve();
              },
              timerCancel: setTimeout(function () {
                logger.debug('timed out waiting for incoming connection');
                handleReverseConnection(self, incoming, server,
                                        listenerOrIncomingConnection);
                resolve();
              }, thaliConfig.MILLISECONDS_TO_WAIT_FOR_REVERSE_CONNECTION)
            };
          }
        }
        else {
          handleForwardConnection(self, listenerOrIncomingConnection, server,
                                  resolve, reject);
        }
      });
  });
}


/**
 * This creates a local TCP server (which MUST use {@link
 * module:makeIntoCloseAllServer~makeIntoCloseAllServer}) to accept incoming
 * connections from the Thali app that will be sent to the identified peer.
 *
 * If this method is called before start is called then a "Call Start!" error
 * MUST be thrown. If this method is called after stop is called then a "We are
 * stopped!" error MUST be thrown.
 *
 * If there is already a TCP server listening for connections to the submitted
 * peerIdentifier then the port for the TCP server MUST be returned.
 *
 * If there is no existing TCP server for the specified peer then we MUST
 * examine how many peers we are advertising 127.0.0.1 ports for. If that number
 * is equal to maxPeersToAdvertise then we MUST call destroy on one of those TCP
 * listeners before continuing with this method. That way we will never offer
 * connections to more than maxPeersToAdvertise peers at a time. We should
 * order existing listeners by the last time they had data sent across their
 * native link (this could, in the iOS case, be in either direction) and then
 * pick the oldest to close. Once we have closed the TCP server, if
 * necessary, then a new TCP server MUST be created on port 0 (e.g. any
 * available port) and configured as follows:
 *
 * ## TCP server
 *
 * ### Connection Event
 *
 * #### First call to connection event
 *
 * When the first connection event occurs we MUST issue a {@link
 * external:"Mobile('connect')".callNative} for the requested peer and handle
 * the response as given in the following sections.
 *
 * ##### Error
 *
 * If we get an error then we MUST close the TCP connection and fire a {@link
  * event:failedConnection} event with the returned error.
 *
 * ##### listenerPort
 *
 * If the response is listenerPort then we MUST make an immediate call to {@link
 * external:"Mobile('connect')".callNative} to connect to the specified peer. If
 * that call fails then we MUST call close on the TCP server since the peer is
 * not available and fire a {@link event:failedConnection} event with the error
 * set to "Cannot Connect To Peer". Otherwise a new multiplex object MUST be
 * created and a new TCP connection via net.createConnection pointed at the port
 * returned by the connect call. The multiplex object MUST be piped in both
 * directions with the new TCP connection. The TCP connection MUST have
 * setTimeout called on it and set to a reasonable value for the platform.
 *
 * #### Standard connection event behavior
 *
 * Each socket returned by the connection event MUST cause a call to
 * createStream on the multiplex object and the returned stream MUST be piped in
 * both directions with the connection TCP socket.
 *
 * ### Error Event
 *
 * The error MUST be logged.
 *
 * ### Close Event
 *
 * All the TCP sockets to routerPort MUST first be destroyed. Then all the TCP
 * sockets from the Thali application MUST be destroyed.
 *
 * Unless destroy was called on the TCP server by the multiplex object then
 * destroy MUST be called on the multiplex object.
 *
 * ## Multiplex object
 *
 * ### Error Event
 *
 * The error MUST be logged.
 *
 * ### Close Event
 *
 * If the destroy didn't come from the TCP server then destroy MUST be called on
 * the TCP server. If the destroy didn't come from the TCP native socket then
 * destroy MUST be called on the TCP native socket.
 *
 * ## TCP socket to native layer
 *
 * ### Timeout Event
 *
 * Destroy MUST be called on itself.
 *
 * ### Error Event
 *
 * The error MUST be logged.
 *
 * ### Close Event
 *
 * Destroy MUST be called on the multiplex object the stream is piped to.
 *
 * ## TCP socket from Thali Application
 *
 * ### Error Event
 *
 * The error MUST be logged.
 *
 * ### Close Event
 *
 * Destroy MUST be called on the stream object the socket is piped to if that
 * isn't the object that called destroy on the socket.
 *
 * ## createStream Socket
 *
 * ### Error Event
 *
 * The error MUST be logged.
 *
 * ### Finish Event
 *
 * We MUST call destroy on the mux which will trigger close.
 *
 * ### Close Event
 *
 * If destroy wasn't called by the TCP socket from Thali Application the stream
 * is piped to then destroy MUST be called on that TCP socket.
 *
 * @public
 * @param {module:thaliTcpServersManager~ThaliTcpServersManager} self the this
 * object from tcpServersManager.
 * @param {string} peerIdentifier
 * @returns {Promise<number|Error>}
 */
function createPeerListener(self, peerIdentifier, pleaseConnect) {

  // This section manages a server that accepts incoming connections
  // from the application. The first connection causes the p2p link to
  // be established and connects a mux to the native listener that will
  // have been set up. Subsequent connections create new streams on that
  // link.

  // In general:
  // - an incoming socket is one _from_ the application
  // - an outgoing socket is one to the native listener on the p2p side
  // - a client socket is one _to_ the application, 1 per remote created stream

  switch (self._state) {
    case self.TCPServersManagerStates.INITIALIZED: {
      return Promise.reject(new Error('Call Start!'));
    }
    case self.TCPServersManagerStates.STARTED: {
      break;
    }
    case self.TCPServersManagerStates.STOPPED: {
      return Promise.reject(new Error('We are stopped!'));
    }
    default: {
      return Promise.reject(new Error('Unsupported state ' + self._state));
    }
  }

  function _do(resolve, reject) {
    function onNewConnection(incoming) {
      // Handle a new connection from the app to the server
      if (!pleaseConnect && server._firstConnection) {
        server.muxPromise = connectToRemotePeer(self, incoming, peerIdentifier,
                                                server, pleaseConnect);
      }

      var incomingStream;

      // We need to subscribe to `incoming` immediately.
      // We want not to loose any event (issue #1473).
      incoming
      .on('error', function (err) {
        logger.error('error on incoming socket - ' + err);
        if (incomingStream) {
          incomingStream.destroy();
        }
      })
      .on('finish', function () {
        if (incomingStream) {
          incomingStream.end();
        }
      })
      .on('close', function () {
        if (incomingStream) {
          incomingStream.destroy();
        }
      });

      server.muxPromise
        .then(function () {
          // We don't need to create `incomingStream` and `pipe`
          //   if `incoming` is already closed (issue #1473).
          if (incoming.readyState === 'closed') {
            logger.debug('incoming is already closed');
            return;
          }

          assert(server._mux, 'server._mux must exist by now');
          incomingStream = server._mux.createStream();

          incomingStream
          .on('error', function (err) {
            logger.error('error on incoming stream - ' + err);
            incoming.destroy();
          })
          .on('finish', function () {
            incoming.end();
          })
          .on('close', function () {
            incoming.destroy();
          });

          incomingStream.pipe(incoming).pipe(incomingStream);
        })
        .catch(function (err) {
          logger.debug('failed incoming connection because of mux promise ' +
            'failure - ' + err);
          incoming.end();
        });
    }

    function createServer(onNewConnection) {
      // This is the server that will listen for connection coming from the
      // application

      function closeOldestServer() {
        var oldest = null;
        Object.keys(self._peerServers).forEach(function (k) {
          if (oldest == null) {
            oldest = k;
          }
          else {
            if (self._peerServers[k].lastActive <
              self._peerServers[oldest].lastActive) {
              oldest = k;
            }
          }
        });
        if (oldest) {
          closeServer(self, self._peerServers[oldest], null, false);
        }
      }

      if (self._peerServers.length === maxPeersToAdvertise) {
        closeOldestServer();
      }

      var server = makeIntoCloseAllServer(net.createServer(), true);
      server._peerIdentifier = peerIdentifier;
      server._firstConnection = true;

      server.on('connection', onNewConnection);

      server.on('close', function onClose() {
      });

      return server;
    }

    var peerServerEntry = self._peerServers[peerIdentifier];
    if (peerServerEntry) {
      // If address is there then we have successfully gotten a port for the
      // server
      var address = peerServerEntry.server.address();
      if (address) {
        return resolve(address.port);
      }
      // Otherwise we need to record the resolve and reject and clean things
      // up one way or another when we figure out if we are going to get
      // a port
      peerServerEntry.promisesOnListen.push({
        resolve: resolve,
        reject: reject
      });
      return;
    }

    logger.debug('createPeerListener creating new server');

    var server = createServer(onNewConnection);

    self._peerServers[peerIdentifier] =
    { lastActive: Date.now(), server: server, promisesOnListen: []};

    /**
      * We have to keep this value around because by the time we call failed
      * startup the server's entry will have been deleted from _peerServers
      * as part of closing the server (the inevitably result of anything that
      * ends up with us calling failedStartup).
      */
    peerServerEntry = self._peerServers[peerIdentifier];

    function successfulStartup() {
      resolve(server.address().port);
      self._peerServers[peerIdentifier].promisesOnListen.forEach(
        function (resolveReject) {
          resolveReject.resolve(server.address().port);
        });
      // Once successfulStartup is called it means that we are out of listen
      // and so no further promises should be enqueued, they will instead
      // be returned the server's address. So we can set this to null.
      self._peerServers[peerIdentifier].promisesOnListen = null;
    }

    function failedStartup(err) {
      peerServerEntry.promisesOnListen
        .forEach(function (resolveReject) {
          resolveReject.reject(err);
        });

      reject(err);
    }

    server.on('error', function (err) {
      logger.warn(err);
      failedStartup(err);
    });

    // listen(port, ...) port = 0 for random port
    server.listen(0, function () {
      var port = server.address().port;
      logger.debug('listening', port);

      logger.debug('pleaseConnect=', pleaseConnect);

      if (!pleaseConnect) {
        successfulStartup();
      }
      else {
        // We're being asked to connect to by a lower sorted peer
        server.muxPromise = connectToRemotePeer(self, null, peerIdentifier,
                                                server, pleaseConnect)
          .then(function () {
            successfulStartup();
          })
          .catch(function (err) {
            failedStartup(err);
          });
      }
    });
  }

  return new Promise(_do);
}

module.exports.createPeerListener = createPeerListener;
