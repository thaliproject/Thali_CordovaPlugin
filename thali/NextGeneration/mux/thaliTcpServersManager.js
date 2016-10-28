'use strict';

var util = require('util');
var Promise = require('lie');
var EventEmitter = require('events').EventEmitter;
var createNativeListener = require('./createNativeListener');
var createPeerListener = require('./createPeerListener');
var logger = require('../../ThaliLogger')('thaliTcpServersManager');

/** @module TCPServersManager */

/**
 * @classdesc This is where we manage creating multiplex objects. For all
 * intents and purposes this file should be treated as part of {@link
 * module:thaliMobileNativeWrapper}. We have broken this functionality out here
 * in order to make the code more maintainable and easier to follow.
 *
 * This code is for 'connect' platforms only.
 *
 * When dealing with incoming connections this code creates a multiplex object
 * to handle de-multiplexing the incoming connections.
 *
 * In our original design we would advertise a TCP/IP server as soon as we
 * discovered a peer and then connect to Bluetooth when someone connected to
 * the TCP/IP server. This enabled us to create an experience just like WiFi
 * were we could advertise ports and users could connect when they wanted. And
 * if they didn't connect then all we wasted was a TCP/IP listener that wasn't
 * doing anything. But due to the needs of the 'multiConnect' platform we
 * switched to a model where users have to explicitly ask for addresses and
 * ports to connect to a peer. This would have let us simplify this design so
 * that we would first call connect at the native layer and only once that
 * worked would we set up the TCP/IP listener. This would have been a simpler
 * approach. But the existing code, which first sets up the TCP/IP listener and
 * then creates the Bluetooth connection is fully tested so it's not worth the
 * time to change it to a simpler design.
 *
 * A multiplex object will be created when we:
 * - get an incoming connection from the native layer to the portNumber we
 * submitted to startUpdateAdvertisingAndListening
 *  - We create a mux that pipes to the incoming TCP/IP connection.
 * - get a call from getPort
 *  - We create a local listener and return the port. When we get a connection
 *  to that listener then we call native connect, create a connection to the
 *  native connect port, hook the mux to that connection on one end and the
 *  incoming listener to the mux on the other end.
 *
 *  We have two basic kinds of listeners. One type is for incoming
 *  connections from remote peers. In that case we will have a TCP connection
 *  from the native layer connecting to us which we will then connect to a
 *  multiplex object. The other listener is for connections from a Thali App to
 *  a remote peer. In that case we will create a TCP connection to a native
 *  listener and hook our TCP connection into a multiplex object.
 *
 *  But the point is that each listener has at its root a TCP connection either
 *  going out to or coming in from the native layer. Because keeping native
 *  connections open eats battery we don't want to let connections hang open
 *  unused. This is why we put a timeout on the TCP connection under the
 *  multiplex. That connection sees all traffic in both directions (e.g. even in
 *  the iOS case where we mux connections both ways) and so it knows if anything
 *  is happening. If all is quiet then it knows it can kill the connection.
 *
 *  Note that the connection killing behavior is probably not a good idea and
 *  at some point we should change it, please see
 *  https://github.com/thaliproject/Thali_CordovaPlugin/issues/859.
 *
 *  We also need to deal with cleaning things up when they go wrong.
 *  Typically we will focus the cleanup code on the multiplex object. It will
 *  first close the TCP connections with the Thali app then the multiplex
 *  streams connected to those TCP connections then it will close the listener
 *  and any native connections before closing itself.
 *
 *  Separately it is possible for individual multiplexed TCP connections to
 *  die or the individual streams they are connected to can die. This only
 *  requires local clean up. We just have to be smart so we don't try to close
 *  things that are already closed. So when a TCP connection gets a closed event
 *  it has to detect if it was closed by the underlying multiplex stream or by a
 *  TCP level error. If it was closed by the multiplex stream then it shouldn't
 *  call close on the multiplex stream it is paired with otherwise it should.
 *  The same logic applies when an individual stream belonging to multiplex
 *  object gets closed. Was it closed by its paired TCP connection? If so, then
 *  it's done. Otherwise it needs to close that connection.
 *
 * @public
 * @constructor
 * @param {number} routerPort The port that the system is hosting the local
 * router instance for the Thali Application.
 * @fires event:routerPortConnectionFailed
 * @fires event:failedConnection
 * @fires event:incomingConnectionState
 */
function ThaliTcpServersManager(routerPort) {

  this._state = this.TCPServersManagerStates.INITIALIZED;

  // The single native server created by _createNativeListener
  this._nativeServer = null;

  // The set of peer servers created by createPeerListener
  this._peerServers = {};

  // See note in createPeerListener
  this._pendingReverseConnections = {};

  // The port on which we expect the application to be
  // listening
  this._routerPort = routerPort;
}

util.inherits(ThaliTcpServersManager, EventEmitter);

/**
 * This method will call
 * {@link module:tcpServersManager~TCPServersManager#_createNativeListener}
 * using the routerPort from the constructor and record the returned port.
 *
 * This method is idempotent and so MUST be able to be called multiple times
 * in a row without changing state.
 *
 * If called successfully then the object is in the start state.
 *
 * If this method is called after a call to
 * {@link tcpServersManager~TCPServersManager#stop} then a "We are stopped!"
 * error MUST be thrown.
 *
 * @public
 * @returns {Promise<number|Error>} Returns the port to be passed to {@link
 * external:"Mobile('startUpdateAdvertisingAndListening')".callNative} when the
 * system is ready to receive external incoming connections.
 */
ThaliTcpServersManager.prototype.start = function () {
  var self = this;
  function _do(resolve, reject) {
    switch (self._state) {
      case self.TCPServersManagerStates.STOPPED: {
        return reject('We are stopped!');
      }
      case self.TCPServersManagerStates.STARTED: {
        return resolve(self._nativeServer.address().port);
      }
      case self.TCPServersManagerStates.INITIALIZED: {
        break;
      }
      default: {
        return reject('start - Unsupported TCPServersManagerStates value - ' +
          self._state);
      }
    }

    self._state = self.TCPServersManagerStates.STARTED;
    self._createNativeListener()
    .then(function (localPort) {
      resolve(localPort);
    })
    .catch(function (err) {
      reject(err);
    });
  }
  return new Promise(_do);
};

// jscs:exclude jsDoc
/**
 * This will cause destroy to be called on the TCP server created by {@link
 * module:tcpServersManager._createNativeListener} and then on all the TCP
 * servers created by {@link
 * module:tcpServersManager.connectToPeerViaNativeLayer}.
 *
 * This method is idempotent and so MUST be able to be called multiple times in
 * a row without changing state.
 *
 * If this method is called before calling start then a "Call Start!" Error MUST
 * be returned.
 *
 * Once called the object is in the stop state and cannot leave it. To start
 * again this object must be disposed and a new one created.
 *
 * @public
 * @returns {Promise<?Error>}
 */
// jscs:include jsDoc
ThaliTcpServersManager.prototype.stop = function () {
  var self = this;
  switch (self._state) {
    case self.TCPServersManagerStates.STOPPED: {
      return Promise.resolve();
    }
    case self.TCPServersManagerStates.INITIALIZED: {
      return Promise.reject(new Error('Call Start!'));
    }
    case self.TCPServersManagerStates.STARTED: {
      break;
    }
    default: {
      return Promise.reject(
        new Error('stop - Unsupported TCPServersManagerStates value - ' +
          self._state));
    }
  }

  self._state = self.TCPServersManagerStates.STOPPED;

  var promisesArray = [];

  if (self._nativeServer) {
    promisesArray.push(self._nativeServer.closeAllPromise()
      .then(function () {
        self._nativeServer = null;
      }));
  }
  for (var peerIdentifier in self._peerServers) {
    if (self._peerServers.hasOwnProperty(peerIdentifier)) {
      self._peerServers[peerIdentifier].server._closing = true;
      promisesArray.push(
        self._peerServers[peerIdentifier].server.closeAllPromise());
    }
  }
  self._peerServers = {};

  return Promise.all(promisesArray);
};

/**
 * @private
 * @returns {Promise<number|Error>} The port that the mux is listening on for
 * connections from the native layer or an Error object.
 */
ThaliTcpServersManager.prototype._createNativeListener = function () {
  return createNativeListener(this);
};

/**
 * @public
 * @param {string} peerIdentifier
 * @returns {Promise<number|Error>}
 */
ThaliTcpServersManager.prototype.createPeerListener = function (peerIdentifier,
                                                                pleaseConnect) {
  return createPeerListener.createPeerListener(this, peerIdentifier,
                                                pleaseConnect);
};

/**
 * Terminates an incoming connection with the associated incomingConnectionId.
 *
 * It is NOT an error to terminate a connection that on longer exists.
 *
 * This method MUST be idempotent so multiple calls with the same value MUST NOT
 * cause an error or a state change.
 *
 * @param {Object} incomingConnectionId
 * @returns {Promise<?error>}
 */
ThaliTcpServersManager.prototype.terminateIncomingConnection =
  function (incomingConnectionId) {
    return new Promise(function (resolve) {
      if (incomingConnectionId.destroyed) {
        return resolve();
      }
      incomingConnectionId.once('close', function () {
        resolve();
      });
      incomingConnectionId.destroy();
    });
  };

/**
 * Terminates a server listening for connections to be sent to a remote device.
 *
 * It is NOT an error to terminate a listener that has already been terminated.
 *
 * This method MUST be idempotent so multiple calls with the same value MUST NOT
 * cause an error or a state change.
 *
 * Note that this method will ONLY terminate the native connection. It will not
 * fire a 'failedConnection' nor will it fire a 'listenerRecreatedAfterFailure'
 * event.
 *
 * @param {string} peerIdentifier The identifier of the peer we are connected
 * to and whose local listener we want to shut down.
 * @param {number} port The port that the local listener for that peer is
 * running on. We use the port to prevent race conditions where there is already
 * a new listener for the peer but the code who called
 * terminateOutgoingConnection doesn't know. It is explicitly not an error to
 * put a port that is no longer correct. The method should return successfully.
 * @returns {Promise<?error>}
 */
ThaliTcpServersManager.prototype.terminateOutgoingConnection =
  function (peerIdentifier, port) {
    logger.debug('Terminate outgoing connection called on peerID ' +
      peerIdentifier + ' with port ' + port);
    var peerServer = this._peerServers[peerIdentifier];
    if (peerServer && peerServer.server.address().port === port) {
      createPeerListener.closeServer(this, peerServer.server, null, false);
    }
    return Promise.resolve(null);
  };

/**
 * Notifies the listener of a failed connection attempt. This is mostly used to
 * determine when we have hit the local maximum connection limit but it's used
 * any time there is a connection error since the only other hint that a
 * connection has failed is that the TCP/IP connection to the 127.0.0.1 port
 * will fail.
 *
 * @public
 * @event failedConnection
 * @property {Error} error
 * @property {string} peerIdentifier
 */

/**
 * Notifies the listener that an attempt to connect to routerPort failed.
 *
 * @public
 * @event routerPortConnectionFailed
 * @property {Error} error
 * @property {number} routerPort
 */

ThaliTcpServersManager.prototype.ROUTER_PORT_CONNECTION_FAILED =
  'routerPortConnectionFailed';

/**
 * @readonly
 * @public
 * @enum {string}
 */
ThaliTcpServersManager.prototype.incomingConnectionState = {
  'CONNECTED': 'connected',
  'DISCONNECTED': 'disconnected'
};

/**
 * Notifies the listener when a connection is formed or cut. We use the
 * incomingConnectionId rather than say client TCP ports to prevent confusion in
 * the (unlikely) case that the same port is used twice.
 *
 * @public
 * @event incomingConnectionState
 * @property {Object} incomingConnectionId Uniquely identifies an incoming
 * connection. The only legal operation on this object is an equality check.
 * Otherwise the object must be treated as opaque.
 * @property
 * {module:TCPServersManager~TCPServersManager.incomingConnectionState} state
 * Indicates if the connection has been established or cut.
 */

ThaliTcpServersManager.prototype.INCOMING_CONNECTION_STATE =
  'incomingConnectionState';

/**
 * Defines the state TCPServersManager can be in
 * @readonly
 * @enum {string}
 */
ThaliTcpServersManager.prototype.TCPServersManagerStates = {
  /** Neither start nor stop have been called yet **/
  INITIALIZED: 'initialized',
  /** Start has been called, but not stop **/
  STARTED: 'started',
  /** Stop has been called **/
  STOPPED: 'stopped'
};

module.exports = ThaliTcpServersManager;
