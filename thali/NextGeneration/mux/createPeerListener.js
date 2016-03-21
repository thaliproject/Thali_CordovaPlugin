'use strict';

var logger = require('../../thalilogger')('createPeerListener');
var multiplex = require('multiplex');
var net = require('net');
var makeIntoCloseAllServer = require('./../makeIntoCloseAllServer');
var Promise = require('lie');
var assert = require('assert');

/**
 * Maximum number of peers we support simultaneously advertising as being
 * available to be connected to
 * @type {number}
 */
var maxPeersToAdvertise = 20;


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
 * If pleaseConnect is true then an immediate call MUST be made to {@link
 * external:"Mobile('connect')".callNative} to connect to the specified peer. If
 * that call fails then the error MUST be returned. Otherwise a new multiplex
 * object MUST be created and a new TCP connection via net.createConnection
 * pointed at the port returned by the connect call. The multiplex object MUST
 * be piped in both directions with the new TCP connection. The TCP connection
 * MUST have setTimeout called on it and set to a reasonable value for the
 * platform.
 *
 * ### Connection Event
 *
 * #### First call to connection event when pleaseConnect is false
 *
 * If pleaseConnect is false then when the first connection event occurs we MUST
 * issue a {@link external:"Mobile('connect')".callNative} for the requested
 * peer and handle the response as given in the following sections.
 *
 * ##### Error
 *
 * If we get an error then we MUST close the TCP connection and fire a {@link
  * event:failedConnection} event with the returned error.
 *
 * ##### listenerPort
 *
 * If the response is listenerPort then we MUST perform the actions specified
 * above for pleaseConnect is true with the exception that if the connect fails
 * then we MUST call close on the TCP server since the peer is not available and
 * fire a {@link event:failedConnection} event with the error set to "Cannot
 * Connect To Peer".
 *
 * ##### clientPort/serverPort
 *
 * If clientPort/serverPort are not null then we MUST confirm that the
 * serverPort matches the port that the server created in {@link
 * module:tcpServersManager._createNativeListener} is listening on and if not
 * then we MUST call destroy on the incoming TCP connection, fire a {@link
 * event:failedConnection} event with the error set to "Mismatched serverPort",
 * and act as if connection had not been called (e.g. the next connection will
 * be treated as the first).
 *
 * Otherwise we must then lookup the multiplex object via the clientPort. If
 * there is no multiplex object associated with that clientPort then we have a
 * race condition where the incoming connection died between when the connect
 * response was sent and now. In that case we MUST call destroy on the incoming
 * TCP connection, fire a {@link event:failedConnection} event with the error
 * set to "Incoming connection died" and as previously described treat the next
 * connection as if it were the first.
 *
 * Otherwise we MUST configure the multiplex object with the behavior specified
 * below.
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
 * ### onStream callback
 *
 * If a stream is received a call to net.createConnection MUST be made pointed
 * at routerPort. If the TCP connection cannot be successfully connected then a
 * {@link event:routerPortConnectionFailed} MUST be fired and destroy MUST be
 * called on the stream. Otherwise the TCP connection and the stream MUST be
 * piped to each other in both directions.
 *
 * Note that we will support the ability to accept incoming connections over the
 * multiplex object even for platforms like Android that do not need it. This is
 * just to keep the code and testing simple and consistent.
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
 * ## TCP socket to routerPort
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
 * ## onStream callback stream
 *
 * ### Error Event
 *
 * The error MUST be logged.
 *
 * ### Close Event
 *
 * If destroy wasn't called by the TCP socket to routerPort the stream is piped
 * to then destroy MUST be called on that TCP socket.
 *
 * @public
 * @param {module:thaliTcpServersManager~ThaliTcpServersManager} self the
 * this object from tcpServersManager.
 * @param {string} peerIdentifier
 * @param {boolean} [pleaseConnect] If set to true this indicates that a
 * lexically smaller peer asked for a connection so the lexically larger peer
 * (the local device) will immediately call {@link
 * external:"Mobile('connect')".callNative} to create a connection. If false
 * (the default value) then the call to {@link
 * external:"Mobile('connect')".callNative} will only happen on the first
 * incoming connection to the TCP server.
 * @returns {Promise<number|Error>}
 */
module.exports = function (self, peerIdentifier, pleaseConnect) {

  // This section manages a server that accepts incoming connections
  // from the application. The first connection causes the p2p link to
  // be established and connects a mux to the native listener that will
  // have been set up. Subsequent connections create new streams on that
  // link.

  // In general:
  // - an incoming socket is one _from_ the application
  // - an outgoing socket is one to the native listener on the p2p side
  // - a client socket is one _to_ the application, 1 per remote created stream

  logger.debug('createPeerListener');

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
    if (self._peerServers[peerIdentifier]) {
      resolve(self._peerServers[peerIdentifier].server.address().port);
      return;
    }

    function closeServer(server) {
      server._closing = true;
      server.closeAll();
      delete self._peerServers[server._peerIdentifier];
    }

    function multiplexToNativeListener(listenerOrIncomingConnection, server, cb)
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

            client.on('error', function (err) {
              logger.debug('multiplexToNativeListener.client ' + err);
              self.emit('routerPortConnectionFailed', {
                error: err,
                routerPort: self._routerPort
              });
            });

            client.on('close', function () {
              stream.end();
            });
          });

          mux.on('error', function (err) {
            logger.debug('multiplexToNativeListener.mux ' + err);
          });

          mux.on('close', function () {
            if (!server._closing) {
              closeServer(server);
            }
          });

          outgoing.on('data', function () {
            if (self._peerServers[server._peerIdentifier]) {
              self._peerServers[server._peerIdentifier].lastActive = Date.now();
            }
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

    function onNewConnection(incoming) {

      // Handle a new connection from the app to the server

      function findMuxForReverseConnection(clientPort) {
        // Find the mux for the reverse connection based on
        // incoming socket's remote port
        var mux = null;
        logger.debug('looking up mux for client port: ', clientPort);
        self._nativeServer._incoming.forEach(function (i) {
          if (i.remotePort === clientPort) {
            mux = i._mux;
          }
        });
        return mux;
      }

      function handleForwardConnection(listenerOrIncomingConnection, server,
        resolve, reject) {
        logger.debug('forward connection');
        var promiseResolved = false;

        // Connect to the native listener and mux the connection
        // When the other side creates a stream, send it to the application
        var outgoing = multiplexToNativeListener(listenerOrIncomingConnection,
          server,
          function onConnection() {
            promiseResolved = true;
            resolve();
          });

        outgoing.on('error', function (err) {
          logger.warn(err);
          if (!server._closing) {
            closeServer(server);
          }
          self.emit('failedConnection', {
            'error':'Cannot Connect To Peer',
            'peerIdentifier':peerIdentifier
          });
          if (!promiseResolved) {
            promiseResolved = true;
            reject();
          }
        });

        outgoing.on('timeout', function () {
          outgoing.destroy();
        });
      }

      function handleReverseConnection(listenerOrIncomingConnection) {
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
              listenerOrIncomingConnection.clientPort][1]);
          delete self._pendingReverseConnections[
            listenerOrIncomingConnection.clientPort];
        }

        if (listenerOrIncomingConnection.serverPort !==
                self._nativeServer.address().port) {
          logger.warn('failedConnection');
          // This isn't the socket you're looking for !!
          incoming.destroy();
          self.emit('failedConnection', {
            'error': 'Mismatched serverPort',
            'peerIdentifier':peerIdentifier
          });
          server._firstConnection = true;
          return;
        }

        // Find the mux for the incoming socket that should have
        // been created when the reverse connection completed
        var mux = findMuxForReverseConnection(
                            listenerOrIncomingConnection.clientPort);
        if (!mux) {
          logger.debug('no mux found');
          incoming.destroy();
          self.emit('failedConnection', {
            'error':'Incoming connection died',
            'peerIdentifier':peerIdentifier
          });
          server._firstConnection = true;
          return false;
        }

        server._mux = mux;
      }

      function processFirstNoPleaseConnectConnection() {
        server.muxPromise = new Promise(function (resolve, reject) {
          server._firstConnection = false;
          logger.debug('first connection');

          Mobile('connect').callNative(peerIdentifier, // jshint ignore:line
            function (err, unParsedConnection) {
              if (err) {
                var error = new Error(err);
                logger.warn(error);
                logger.debug('failedConnection');
                incoming.end();
                self.emit('failedConnection',
                  { 'error':error, 'peerIdentifier':peerIdentifier });
                return reject(err);
              }
              var listenerOrIncomingConnection = JSON.parse(unParsedConnection);
              if (listenerOrIncomingConnection.listeningPort === 0) {
                // So this is annoying.. there's no guarantee on the order of the
                // server running it's onConnection handler and us getting here.
                // So we don't always find a mux when handling a reverse
                // connection. Handle that here.

                if (findMuxForReverseConnection(
                    listenerOrIncomingConnection.clientPort)) {
                  handleReverseConnection(listenerOrIncomingConnection);
                  return resolve();
                }
                else {
                  // Record the pending connection, give it a second to turn up
                  self._pendingReverseConnections[
                    listenerOrIncomingConnection.clientPort] = [
                    function () {
                      handleReverseConnection(listenerOrIncomingConnection,
                        server);
                      resolve();
                    },
                    setTimeout(function () {
                      logger.debug('timed out waiting for incoming connection');
                      handleReverseConnection(listenerOrIncomingConnection,
                        server);
                      resolve();
                    }, 1000)
                  ];
                  return;
                }
              }
              else {
                handleForwardConnection(listenerOrIncomingConnection, server,
                                         resolve, reject);
              }
            });
        });
      }

      if (!pleaseConnect && server._firstConnection) {
        processFirstNoPleaseConnectConnection();
      }

      server.muxPromise
        .then(function () {
          assert(server._mux, 'server._mux must exist by now');
          var incomingStream = server._mux.createStream();

          incomingStream.on('error', function (err) {
            logger.debug('error on incoming stream - ' + err);
          });

          incomingStream.on('finish', function () {
            server._mux.destroy();
          });

          incomingStream.on('close', function () {
            incoming.end();
          });

          incomingStream.pipe(incoming).pipe(incomingStream);
        })
        .catch(function (err) {
          logger.debug('failed incoming connection because of mux promise ' +
            'failure: ' + err);
          incoming.end();
        });
    }

    function createServer(onNewConnection, onListen) {
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
          closeServer(self._peerServers[oldest]);
        }
      }

      if (self._peerServers.length === maxPeersToAdvertise) {
        closeOldestServer();
      }

      var server = makeIntoCloseAllServer(net.createServer());
      server._peerIdentifier = peerIdentifier;
      server._firstConnection = true;
      server._muxes = [];

      server.on('connection', onNewConnection);

      server.on('close', function onClose() {
        server._muxes.forEach(function (m) {
          m.end();
        });
        server._muxes = [];
      });

      return server;
    }

    var server = createServer(onNewConnection);

    server.on('error', function (err) {
      logger.warn(err);
      reject(err);
    });

    server.on('listening', function () {

      self._peerServers[peerIdentifier] =
      { lastActive: Date.now(), server: server };

      logger.debug('pleaseConnect=', pleaseConnect);

      if (!pleaseConnect) {
        resolve(server.address().port);
      }
      else {
        // We're being asked to connect to by a lower sorted peer
        Mobile('connect').callNative(peerIdentifier, // jshint ignore:line
          function (err, unParsedConnection) {

            // This must be a forward connection (connection.listeningPort !=
            // 0), anything else would be an error

            if (err) {
              var error = new Error(err);
              logger.warn(error);
              logger.debug('failedConnection');
              reject(error);
              return;
            }

            var connection = JSON.parse(unParsedConnection);
            if (connection.listeningPort === 0) {
              logger.warn('was expecting a forward connection to be made');
              self.emit('failedConnection', {
                'error':'Cannot Connect To Peer',
                'peerIdentifier':peerIdentifier
              });
              reject(new Error('Unexpected Reverse Connection'));
              return;
            }

            // Create a connection to the native listener, mux it and
            // connect new streams to the application
            server.muxPromise = new Promise(
              function (muxPromiseResolve, muxPromiseReject) {
                var outgoing = multiplexToNativeListener(connection, server,
                  function onConnect() {
                    outgoing._connected = true;
                    resolve(server.address().port);
                    muxPromiseResolve();
                  });

                outgoing.on('error', function (err) {
                  logger.warn('outgoing socket - ' + err);
                  if (!server._closing) {
                    closeServer(server);
                    self.emit('failedConnection', {
                      'error':'Cannot Connect To Peer',
                      'peerIdentifier':peerIdentifier
                    });
                  }

                  if (!outgoing._connected) {
                    // Failed to connect, reject
                    reject(err);
                    muxPromiseReject();
                  }
                });

                outgoing.on('timeout', function () {
                  outgoing.destroy();
                });
              });

            // Prevent race conditions where the promise is failed but no
            // incoming connections have been created to hear the failure,
            // this causes an uncaught reject exception
            server.muxPromise.then(function () {}).catch(function () {});
          });
      }
    });

    server.listen(0);
  }

  return new Promise(_do);
};
