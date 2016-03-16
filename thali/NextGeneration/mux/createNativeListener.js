'use strict';

var net = require('net');
var Promise = require('lie');
var logger = require('../../thalilogger')('createNativeListener');
var makeIntoCloseAllServer = require('./../makeIntoCloseAllServer');
var multiplex = require('multiplex');
var thaliConfig = require('../thaliConfig');
var assert = require('assert');

function removeArrayElement(a, e) {
  var index = a.indexOf(e);
  if (index === -1) {
    return false;
  }
  a.splice(index, 1);
  return true;
}

function emitIncomingConnectionState(self, incomingConnectionId,
                                     incomingConnectionState) {
  self.emit(self.INCOMING_CONNECTION_STATE, {
    incomingConnectionId: incomingConnectionId,
    state: incomingConnectionState
  });
}

// jscs:disable jsDoc
/**
 * This method creates a TCP listener (which MUST use {@link
 * module:makeIntoCloseAllServer~makeIntoCloseAllServer}) to handle requests
 * from the native layer and to then pass them through a multiplex object who
 * will route all the multiplexed connections to routerPort, the port the system
 * has hosted the submitted router object on. The TCP listener will be started
 * on port 0 and the port it is hosted on will be returned in the promise. This
 * is the port that MUST be submitted to the native layer's {@link
 * external:"Mobile('startUpdateAdvertisingAndListening')".callNative} command.
 *
 * If this method is called when we are not in the start state then an exception
 * MUST be thrown because this is a private method and something very bad just
 * happened.
 *
 * If this method is called twice an exception MUST be thrown because this
 * should only be called once from the constructor.
 *
 * ## TCP Listener
 *
 * ### Connect Event
 *
 * A multiplex object MUST be created and MUST be directly piped in both
 * directions with the TCP socket returned by the listener. We MUST set a
 * timeout on the incoming TCP socket to a reasonable value for the platform.
 * The created multiplex object MUST be recorded with an index of the client
 * port used by the incoming TCP socket.
 *
 * A unique ID MUST be created for this connection and stored with this
 * connection and then a
 * {@link module:TCPServersManager.event:incomingConnectionState} event MUST
 * be fired.
 *
 * ### Error Event
 *
 * The error MUST be logged.
 *
 * ### Close Event
 *
 * We MUST call destroy on all multiplex objects spawned by this TCP listener.
 *
 * We MUST also fire a
 * {@link module:TCPServersManager.event:incomingConnectionState} event.
 *
 * ## Incoming TCP socket returned by the server's connect event
 *
 * ### Error Event
 *
 * The error MUST be logged.
 *
 * ### Timeout Event
 *
 * Destroy MUST be called on the piped multiplex object. This will trigger a
 * total cleanup.
 *
 * ### Close Event
 *
 * If this close is not the result of a destroy on the multiplex object then
 * destroy MUST be called on the multiplex object.
 *
 * ## Multiplex Object
 *
 * ### onStream Callback
 *
 * The incoming stream MUST cause us to create a net.createConnection to
 * routerPort and to then take the new TCP socket and pipe it in both directions
 * with the newly created stream. We MUST track the TCP socket so we can clean
 * it up later. Note that the TCP socket will track its associated stream and
 * handle cleaning it up. If the TCP socket cannot be connected to routerPort
 * then a routerPortConnectionFailed event MUST be fired and destroy MUST be
 * called on the stream provided in the callback.
 *
 * ### Error Event
 *
 * The error MUST be logged.
 *
 * ### Close Event
 *
 * Destroy MUST first be called on all the TCP sockets we created to routerPort
 * (the TCP sockets will then close their associated multiplex streams). Then we
 * MUST call Destroy on the incoming TCP socket from the native layer. Note that
 * in some cases one or more of these objects could already be closed before we
 * call destroy so we MUST be prepared to catch any exceptions. Finally we MUST
 * remove the multiplex object from the list of multiplex objects we are
 * maintaining.
 *
 * ## TCP client socket created by net.createConnection call from multiplex
 * object
 *
 * ### Error Event
 *
 * The error MUST be logged.
 *
 * ### Close Event
 *
 * Destroy MUST be called on the stream this TCP socket is piped to assuming
 * that it wasn't that stream that called destroy on the TCP client socket.
 *
 * ## multiplex onStream stream
 *
 * ### Error Event
 *
 * The error MUST be logged.
 *
 * ### Close Event
 *
 * If the close did not come from the TCP socket this stream is piped to then
 * close MUST be called on the associated TCP socket.
 *
 * @public
 * @param {module:tcpServersManager~TCPServersManager} self The 'this' object
 * from tcpServersManager
 * @returns {Promise<number|Error>}}
 */
// jscs:enable jsDoc
module.exports = function (self) {
  if (self._state !== self.TCPServersManagerStates.STARTED) {
    return Promise.reject(new Error('Call Start!'));
  }

  if (self._nativeServer) {
    // Must have been called twice
    return Promise.reject(new Error('Don\'t call directly!'));
  }

  return new Promise(function (resolve, reject) {
    logger.debug('creating native server');

    self._nativeServer = makeIntoCloseAllServer(net.createServer());
    self._nativeServer._incoming = [];

    self._nativeServer.on('error', function (err) {
      logger.debug(err);
    });

    self._nativeServer.on('close', function () {
      // this == self._nativeServer (which is already null by
      // the time this handler is called)
      this._incoming.forEach(function (i) {
        if (i._mux) {
          i._mux.destroy();
        }
      });
      this._incoming = [];
    });

    self._nativeServer.on('connection', function (incoming) {
      self._nativeServer._incoming.push(incoming);
      logger.debug('new incoming socket');

      // We've received a new incoming connection from the P2P layer
      // Wrap this new socket in a multiplex. New streams appearing
      // from the mux are client sockets being created on the remote
      // side and should be connected to the application server port.

      incoming.on('error', function (err) {
        logger.debug(err);
      });

      incoming.setTimeout(thaliConfig.NON_TCP_PEER_UNAVAILABILITY_THRESHOLD);
      incoming.on('timeout', function () {
        logger.debug('incoming socket timeout');
        incoming.destroy();
        incoming._mux && incoming._mux.destroy();
      });

      incoming.on('close', function () {
        logger.debug('incoming socket close');
        if (self._nativeServer) {
          removeArrayElement(self._nativeServer._incoming, incoming);
        }
        emitIncomingConnectionState(self, incoming,
          self.incomingConnectionState.DISCONNECTED);
      });

      logger.debug('creating incoming mux');
      var mux = multiplex(function onStream(stream) {
        mux._streams.push(stream);

        logger.debug('new stream: ', stream);

        // Remote side is trying to connect a new client
        // socket into their mux, connect this new stream
        // to the application server

        stream.on('error', function (err) {
          logger.debug(err);
        });

        stream.on('finish', function () {
          stream.destroy(); // Guarantees that close event will fire
        });

        stream.on('close', function () {
          logger.debug('stream close:', stream);
          stream._outgoing.end();
          if (!removeArrayElement(mux._streams, stream)) {
            logger.debug('stream not found in mux');
          }
        });

        var outgoing = net.createConnection(self._routerPort, function () {
          if (!stream.destroyed && !outgoing.destroyed) {
            stream.pipe(outgoing).pipe(stream);
          } else {
            !stream.destroyed && stream.destroy();
            !outgoing.destroyed && outgoing.destroy();
          }
        });

        stream._outgoing = outgoing;

        outgoing.on('close', function () {
          stream.destroy();
          removeArrayElement(mux._streams, stream);
        });

        outgoing.on('error', function (err) {
          logger.debug(err);
          self.emit(self.ROUTER_PORT_CONNECTION_FAILED);
        });

        logger.debug('new outgoing socket');
      });

      incoming._mux = mux;
      mux._incoming = incoming;
      mux._streams = [];

      logger.debug('new mux');

      mux.on('error', function (err) {
        logger.debug('mux ' + err);
      });

      mux.on('close', function () {
        logger.debug('mux close');
        mux._incoming.end();
        mux._incoming._mux = null;
        mux._incoming = null;
      });

      // The client connection may have run it's connection
      // handler before this one.. handle that.
      if (self._pendingReverseConnections[incoming.remotePort]) {
        self._pendingReverseConnections[incoming.remotePort][0]();
      }

      incoming.pipe(mux).pipe(incoming);
      emitIncomingConnectionState(self, incoming,
        self.incomingConnectionState.CONNECTED);
    });

    self._nativeServer.listen(0, function (err) {
      if (err) {
        logger.warn(err);
        return reject(err);
      }

      assert(self._nativeServer, 'It should not be possible for it to be ' +
        'nulled out before we return from this call');

      logger.debug('listening', self._nativeServer.address().port);
      resolve(self._nativeServer.address().port);
    });
  });
};

