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
    logger.debug('We are emitting failedConnection with error "%s" and ' +
      'peerIdentifier "%s"', failedConnectionErr, server._peerIdentifier);
    self.emit('failedConnection', {
      error: failedConnectionErr,
      peerIdentifier: server._peerIdentifier,
      recreated: true
    });
  }
  if (canRetry) {
    assert(failedConnectionErr, 'Calling canRetry set to true without ' +
      'emitting an error will mean we do not emit an event that the peer ' +
      'is not available before emitting an event that the peer is available ' +
      'which violates thaliMobiles contract to not emit repeated available ' +
      'events for the same peer');
    logger.debug('Will try to recreate server for %s', server._peerIdentifier);
    // We use next tick just to avoid building up a stack but we want
    // to make sure this code runs before anyone else so we can grab
    // the server spot for the identifier we are using and no this probably
    // isn't actually required and we could have used setImmediate
    process.nextTick(function () {
      createPeerListener(self, server._peerIdentifier)
        .then(function (port) {
          logger.debug('We are emitting listenerRecreatedAfterFailure with ' +
            'peerIdentifier %s and portNumber %d', server._peerIdentifier,
              port);
          self.emit('listenerRecreatedAfterFailure', {
            'peerIdentifier': server._peerIdentifier,
            'portNumber': port
          });
        })
        .catch(function (err) {
          logger.warn('Got error trying to restart listener for peer %s' +
            ' after failure %s', server._peerIdentifier, err.toString());
        });
    });
  }
}

module.exports.closeServer = closeServer;

function multiplexToNativeListener(self, listenerOrIncomingConnection, server,
                                   peerIdentifier, cb)
{
  // Create an outgoing socket to the native listener via a mux
  // New streams created on this mux by the remote side are initiated
  // by the user app connecting a socket to a remote thali server
  var outgoing = net.createConnection(
    listenerOrIncomingConnection.listeningPort,
    function () {
      var mux = multiplex(function onStream() {
        logger.error('We have received an incoming stream on and outgoing ' +
          'mux. That should not happen.');
      });

      mux.on('error', function (err) {
        logger.debug('mux - mux <-> outgoing TCP/IP client connection to ' +
          'Android - %s - err %s',
            peerIdentifier, err);
        outgoing.destroy();
      });

      mux.on('finish', function () {
        logger.silly('mux - mux <-> outgoing TCP/IP client connection to ' +
          'Android - %s - finish',
          peerIdentifier);
        outgoing.end();
      });

      mux.on('close', function () {
        logger.silly('mux - mux <-> outgoing TCP/IP client connection to ' +
          'Android - %s - close',
          peerIdentifier);
        outgoing.end();
      });

      outgoing.on('data', function (data) {
        logger.silly('outgoing - mux <-> outgoing TCP/IP client connection ' +
          'to Android - %s - data length (bytes) - %d', peerIdentifier,
          data.length);
        var peerServerEntry = self._peerServers[server._peerIdentifier];
        if (peerServerEntry) {
          peerServerEntry.lastActive = Date.now();
        }
      });

      outgoing.on('error', function (err) {
        logger.warn('outgoing - mux <-> outgoing TCP/IP client connection ' +
          'to Android - %s -  error %s',
          peerIdentifier, err);

        mux.destroy();
      });

      outgoing.on('finish', function () {
        logger.silly('outgoing - mux <-> outgoing TCP/IP client connection ' +
          'to Android - %s - finish',
          peerIdentifier);
        mux.end();
      });

      outgoing.on('close', function () {
        logger.silly('outgoing - mux <-> outgoing TCP/IP client connection ' +
          'to Android  - %s - close',
          peerIdentifier);
        mux.destroy();
      });

      outgoing.on('timeout', function () {
        logger.silly('outgoing - mux <-> outgoing TCP/IP client connection ' +
          'to Android - %s - timeout');
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

function handleConnection(self, listenerOrIncomingConnection, server,
                                 peerIdentifier, resolve, reject) {
  logger.debug('Creating outgoing connection to native layer for ' +
    'peerID ' + peerIdentifier);
  var promiseResolved = false;
  var error = null;

  // Connect to the native listener and mux the connection
  // When the other side creates a stream, send it to the application
  var outgoing = multiplexToNativeListener(self, listenerOrIncomingConnection,
    server, peerIdentifier,
    function onConnection() {
      promiseResolved = true;
      resolve();
    });

  outgoing.on('error', function (err) {
    error = new Error('Cannot Connect To Peer');
    error.outgoingError = err;
    if (!promiseResolved) {
      promiseResolved = true;
      reject();
    }
  });

  outgoing.on('close', function () {
    error = error ? error : new Error('Outgoing closed, recreating ' +
      'connection');
    closeServer(self, server, error, true);
  });

  outgoing.on('timeout', function () {
    outgoing.destroy();
  });
}

function connectToRemotePeer(self, incoming, peerIdentifier, server)
{
  return new Promise(function (resolve, reject) {
    assert(server._firstConnection, 'We should only get called once');
    server._firstConnection = false;
    logger.debug('Issuing callNative for %s', peerIdentifier);

    Mobile('connect').callNative(peerIdentifier, // jshint ignore:line
      function (err, unParsedConnection) {
        if (err) {
          var error = new Error(err);
          logger.warn('callNative for %s failed with %s', peerIdentifier,
            err);
          incoming && incoming.end();
          closeServer(self, server, error, true);
          return reject(error);
        }
        logger.debug('callNative for %s connected', peerIdentifier);
        var listenerOrIncomingConnection = JSON.parse(unParsedConnection);
        assert(listenerOrIncomingConnection.listeningPort !== 0,
        'We should not get a 0 port, this check is to see if we forgot' +
        ' any of the old reverse connection code');
        handleConnection(self, listenerOrIncomingConnection, server,
                              peerIdentifier, resolve, reject);
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
function createPeerListener(self, peerIdentifier) {

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
    var incomingConnectionId = -1;
    function onNewConnection(incoming) {
      ++incomingConnectionId;
      var localIncomingConnectionId = incomingConnectionId;

      logger.silly('incoming (TCP) - Node TCP/IP client <-> Mux stream' +
        ' - %s - %d - got a new incoming connection', peerIdentifier,
        localIncomingConnectionId);
      // Handle a new connection from the app to the server
      if (server._firstConnection) {
        server.muxPromise = connectToRemotePeer(self, incoming, peerIdentifier,
                                                server);
      }

      var incomingStream;

      // We need to subscribe to `incoming` immediately.
      // We want not to loose any event (issue #1473).
      incoming
      .on('error', function (err) {
        logger.error('incoming (TCP) - Node TCP/IP client <-> Mux stream' +
          '- %s - %d - error: %s', peerIdentifier,
          localIncomingConnectionId, err);
        if (incomingStream) {
          incomingStream.destroy();
        }
      })
      .on('finish', function () {
        logger.silly('incoming (TCP) - Node TCP/IP client <-> Mux stream ' +
          '- %s - %d - finish', peerIdentifier, localIncomingConnectionId);
        if (incomingStream) {
          incomingStream.destroy();
        }
      })
      .on('close', function () {
        logger.silly('incoming (TCP) - Node TCP/IP client <-> Mux stream' +
          ' - %s - %d - close', peerIdentifier, localIncomingConnectionId);
        if (incomingStream) {
          incomingStream.destroy();
        }
      });

      server.muxPromise
        .then(function () {
          // We don't need to create `incomingStream` and `pipe`
          //   if `incoming` is already closed (issue #1473).
          if (incoming.readyState === 'closed') {
            logger.debug('incoming (TCP) - Node TCP/IP client - is already closed');
            return;
          }

          assert(server._mux, 'server._mux must exist by now');
          incomingStream = server._mux.createStream();

          incomingStream
          .on('error', function (err) {
            logger.error('incomingStream (mux) - Node TCP/IP client <-> ' +
              'Mux stream - %s - %d - error: %s', peerIdentifier,
              localIncomingConnectionId, err);
            incoming.destroy();
          })
          .on('finish', function () {
            logger.silly('incomingStream (mux) - Node TCP/IP client <-> ' +
              'Mux stream - %s - %d - finish', peerIdentifier,
              localIncomingConnectionId);
            incoming.destroy();
          })
          .on('close', function () {
            logger.silly('incomingStream (mux) - Node TCP/IP client <-> ' +
              'Mux stream -  %s - %d - close', peerIdentifier,
              localIncomingConnectionId);
            incoming.destroy();
          });

          // I had wanted to add an incoming.on('data) event handler here to
          // just measure the amount of data being sent but when I put on the
          // event handler, even if it doesn't do anything, it causes a massive
          // slow down in the rate at which JXcore executes and so causes
          // tests to fail.

          incomingStream.pipe(incoming).pipe(incomingStream);
        })
        .catch(function () {
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
        logger.silly('Closed Node TCP/IP listener (server) for %s',
          peerIdentifier);
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

    logger.debug('creating new server for %s', peerIdentifier);

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
      logger.warn('Node TCP/IP listener (server) for %s received error %s',
        peerIdentifier, err);
      failedStartup(err);
    });

    // listen(port, ...) port = 0 for random port
    server.listen(0, function () {
      var port = server.address().port;
      logger.debug('Node TCP/IP listener (server) for %s listening on %d',
        peerIdentifier, port);

      successfulStartup();
    });
  }

  return new Promise(_do);
}

module.exports.createPeerListener = createPeerListener;
