'use strict';

var net = require('net');
var util = require('util');
var Promise = require('lie');
var Multiplex = require('multiplex');
var EventEmitter = require('events').EventEmitter;
var makeIntoCloseAllServer = require('./makeIntoCloseAllServer');
var logger = require('../thalilogger')('tcpServersManager');

/** @module TCPServersManager */

/**
 * Maximum number of peers we support simultaneously advertising
 * @type {number}
 */
var maxPeersToAdvertise = 20;

/**
 * @classdesc This is where we manage creating multiplex objects. For all
 * intents and purposes this file should be treated as part of {@link
 * module:thaliMobileNativeWrapper}. We have broken this functionality out here
 * in order to make the code more maintainable and easier to follow.
 *
 * When dealing with incoming connections this code creates a multiplex object
 * to handle de-multiplexing the incoming connections and in the iOS case to
 * also send TCP/IP connections down the incoming connection (reverse the
 * polarity as it were).
 *
 * When dealing with discovered peers we like to advertise a port that the
 * Thali Application can connect to in order to talk to that peer. But for perf
 * reasons that port is typically not connected to anything at the native layer
 * (with the exception of a lexically smaller peer) until someone connects to
 * the port. The reason for this design (thanks Ville!) is to make non-TCP and
 * TCP peers look the same. There is an address (in this case 127.0.0.1) and a
 * port and you connect and there you go. This file defines all the magic needed
 * to create the illusion that a non-TCP peer is actually available over TCP.
 *
 * There are three different scenarios where multiplex objects can get
 * created:
 *
 * Android
 * - We get an incoming connection from the native layer to the portNumber we
 * submitted to startUpdateAdvertisingAndListening
 *  - We create a mux that pipes to the incoming TCP/IP connection.
 * - We get a peerAvailabilityChanged Event
 *  - We create a local listener and advertise nonTCPPeerAvailabilityChanged.
 *  When we get a connection to that listener then we call native connect,
 *  create a connection to the native connect port, hook the mux to that
 *  connection on one end and the incoming listener to the mux on the other end.
 *
 * iOS - Lexically Smaller Peer
 * - We get an incoming connection from the native layer to the portNumber we
 * submitted to startUpdateAdvertisingAndListening
 *  - We create a mux that pipes to the incoming TCP/IP connection. We keep
 *  track of this mux because we might need it in the next entry. Remember, we
 *  don't know which peer made the incoming connection.
 * - We get a peerAvailabilityChanged Event
 *  - Because we are lexically smaller this event will have pleaseConnect set
 *  to false. So we create a port and advertise it on
 *  nonTCPPeerAvailabilityChanged. When we get a connection we call connect. If
 *  there is already an incoming connection then the connect will return with
 *  the clientPort/serverPort and we will re-use the existing mux If there is no
 *  existing incoming connection then the system will wait to trigger the
 *  lexically larger peer to create it and once it is created and properly
 *  terminated (per the previous section) then we will find the mux via
 *  clientPort/ServerPort.
 *
 * iOS - Lexically Larger Peer
 * - We get an incoming connection from the native layer to the portNumber we
 * submitted to startUpdateAdvertisingAndListening
 *  - It isn't possible.
 * - We get a peerAvailabilityChanged Event
 *  - If the peerAvailabilityChanged Event has pleaseConnect set to true then
 *  baring any limitation on available resources we should immediately issue a
 *  connect and hook in the mux to it configured to handling incoming
 *  connections and then create a TCP listener and have it use createStream with
 *  the mux for any incoming connections. Obviously if we already have a
 *  connection to the identified peer then we can ignore the pleaseConnect
 *  value.
 *  - If the peerAvailabilityChanged Event has pleaseConnect set to false
 *  then we will set up a TCP listener and advertise the port but we won't
 *  create the mux or call connect until the first connection to the TCP
 *  listener comes in.
 *
 *  We have two basic kinds of listeners. One type is for incoming
 *  connections from remote peers. In that case we will have a TCP connection
 *  from the native layer connecting to us which we will then connect to a
 *  multiplex object. The other listener is for connections from a Thali App to
 *  a remote peer. In that case we will create a TCP connection to a native
 *  listener and hook our TCP connection into a multiplex object. And of course
 *  with the iOS situation sometimes it all gets mixed up.
 *
 *  But the point is that each listener has at its root a TCP connection
 *  either going out to or coming in from the native layer. Because keeping
 *  native connections open eats battery (although this is probably a much less
 *  significant issue with iOS due to its UDP based design) we don't want to let
 *  connections hang open unused. This is why we put a timeout on the TCP
 *  connection under the multiplex. That connection sees all traffic in both
 *  directions (e.g. even in the iOS case where we mux connections both ways)
 *  and so it knows if anything is happening. If all is quiet then it knows it
 *  can kill the connection.
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
function TCPServersManager(routerPort) {

  this._state = 'initialized';

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

util.inherits(TCPServersManager, EventEmitter);

var objectId = 0;
// Use this to uniquely id objects as they're created
// (JS can only index on strings and many objects hash to the string ['Object'])
function nextId() {
  return objectId++;
}

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
 * external:"Mobile('startUpdateAdvertisingAndListening')".ca
 * llNative} when the system is ready to receive external incoming connections.
 */
TCPServersManager.prototype.start = function () {
  var self = this;
  function _do(resolve, reject) {
    if (self._state === 'stopped') {
      reject('We are stopped!');
      return;
    }
    if (self._state == 'started') {
      resolve(self._nativeServer.address().port);
      return;
    }
    self._state = 'started';
    self._createNativeListener(self._routerPort)
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
 * be thrown.
 *
 * Once called the object is in the stop state and cannot leave it. To start
 * again this object must be disposed and a new one created.
 *
 * @public
 * @returns {?Error}
 */
// jscs:include jsDoc
TCPServersManager.prototype.stop = function () {
  if (this._state !== 'started') {
    throw new Error('Call Start!');
  }
  if (this._nativeServer) {
    this._nativeServer.closeAll();
    this._nativeServer = null;
  }
  for (var peerIdentifier in this._peerServers) {
    if (this._peerServers.hasOwnProperty(peerIdentifier)) {
      this._peerServers[peerIdentifier][1].closeAll();
    }
  }
  this._peerServers = {};

  return null;
};

// jscs:exclude jsDoc
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
 * @private
 * @param {number} routerPort Port that the router object submitted to {@link
 * module:ThaliMobileNativeWrapper.startUpdateAdvertisingAndListening} is hosted
 * on. This value was passed into this object's constructor.
 * @returns {Promise<number|Error>} The port that the mux is listening on for
 * connections from the native layer or an Error object.
 */
// jscs:include jsDoc
TCPServersManager.prototype._createNativeListener = function (routerPort) {

  if (this._state !== 'started') {
    throw new Error('Call Start!');
  }

  if (this._nativeServer) {
    // Must have been called twice
    throw new Error('Don\'t call directly!');
  }

  function removeArrayElement(a, e) {
    // Remove an element from array based on __id comparison
    function findIndex() {
      for (var i = 0; i < a.length; i++) {
        if (a[i].__id === e.__id) {
          return i;
        }
      }
      return -1;
    }
    var idx = findIndex();
    if (idx !== -1) {
      a.splice(idx, 1);
      return true;
    }
    return false;
  }

  var self = this;
  function _do(resolve) {

    logger.debug('creating native server');

    self._nativeServer = makeIntoCloseAllServer(net.createServer());
    self._nativeServer.__id = nextId();
    self._nativeServer._incoming = [];

    self._nativeServer.on('error', function (err) {
      logger.warn(err);
    });

    self._nativeServer.on('close', function () {
      // this == self._nativeServer (which is already null by
      // the time this handler is called)
      self.emit('incomingConnectionState', 'DISCONNECTED');
      this._incoming.forEach(function (i) {
        i.end();
      });
      this._incoming = [];
    });

    self._nativeServer.on('connection', function (incoming) {

      incoming.__id = nextId();
      self._nativeServer._incoming.push(incoming);
      logger.debug('new incoming socket:', incoming.__id);

      // We've received a new incoming connection from the P2P layer
      // Wrap this new socket in a multiplex. New streams appearing
      // from the mux are client sockets being created on the remote
      // side and should be connected to the application server port.

      incoming.on('error', function (err) {
        logger.warn(err);
      });

      incoming.on('timeout', function () {
        logger.debug('incoming socket timeout');
        if (self._nativeServer) {
          removeArrayElement(self._nativeServer._incoming, incoming);
        }
      });

      incoming.on('close', function () {
        logger.debug('incoming socket close', incoming.__id);
        if (self._nativeServer) {
          removeArrayElement(self._nativeServer._incoming, incoming);
        }
        self.emit('incomingConnectionState', 'DISCONNECTED');
      });

      logger.debug('creating incoming mux');
      var mux = new Multiplex(function onStream(stream) {

        stream.__id = nextId();
        mux._streams.push(stream);

        logger.debug('new stream: ', stream.__id);

        // Remote side is trying to connect a new client
        // socket into their mux, connect this new stream
        // to the application server

        stream.on('error', function (err) {
          logger.warn(err);
        });

        stream.on('close', function () {
          logger.debug('stream close:', stream.__id);
          stream._outgoing.end();
          if (!removeArrayElement(mux._streams, stream)) {
            logger.debug('stream not found in mux');
          }
        });

        var outgoing = net.createConnection(routerPort, function () {
          stream.pipe(outgoing).pipe(stream);
        });
        outgoing.__id = nextId();

        stream._outgoing = outgoing;

        outgoing.on('end', function () {
          logger.debug('outgoing close: ', outgoing.__id);
          stream.end();
          removeArrayElement(mux._streams, stream);
        });

        outgoing.on('error', function (err) {
          logger.warn(err, outgoing.__id);
          removeArrayElement(mux._streams, stream);
          self.emit('routerPortConnectionFailed');
        });

        logger.debug('new outgoing socket:', outgoing.__id);
      });

      mux.__id = nextId();
      incoming._mux = mux;
      mux._incoming = incoming;
      mux._streams = [];

      logger.debug('new mux', mux.__id);

      mux.on('error', function (err) {
        logger.warn(err);
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
      self.emit('incomingConnectionState', 'CONNECTED');
    });

    self._nativeServer.listen(0, function (err) {
      if (err) {
        logger.warn(err);
        reject(err);
        return;
      }
      if (self._nativeServer) {
        logger.debug('listening', self._nativeServer.address().port);
        resolve(self._nativeServer.address().port);
      }
    });
  }

  return new Promise(_do);
};

/**
 * This creates a local TCP server (which MUST use {@link
 * module:makeIntoCloseAllServer~makeIntoCloseAllServer}) to accept incoming
 * connections from the Thali app that will be sent to the identified peer.
 *
 * If this method is called before start is called then a "Start First!" error
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
 * exclude all TCP servers that have active multiplex objects and pick a TCP
 * server to close based on FIFO. Once we have closed the TCP server, if
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
 * TCP connection, first a {@link event:failedConnection} event with the error
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
 * If the destroy didn't come the TCP server then destroy MUST be called on the
 * TCP server. If the destroy didn't come from the TCP native socket then
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
TCPServersManager.prototype.createPeerListener = function (peerIdentifier,
                                                           pleaseConnect) {

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

  if (this._state !== 'started') {
    throw new Error('Call Start!');
  }

  var self = this;
  function _do(resolve, reject) {

    if (self._peerServers[peerIdentifier]) {
      resolve(self._peerServers[peerIdentifier].address().port);
      return;
    }

    function closeServer(server) {
      server.closeAll();
      delete self._peerServers[server.__peerIdentifier];
    }

    function multiplexToNativeListener(connection, server) {
      logger.debug('outgoing to: ', connection.listeningPort);

      var outgoing = net.createConnection(connection.listeningPort,
        function () {
          var mux = new Multiplex(function onStream(stream) {
            var client = net.createConnection(self._routerPort, function () {
              client.pipe(stream).pipe(client);
            });

            client.on('error', function (err) {
              logger.warn(err);
              self.emit('routerPortConnectionFailed');
            });

            client.on('close', function () {
              stream.end();
            });
          });

          mux.on('error', function (err) {
            logger.warn(err);
          });

          mux.on('close', function () {
            closeServer(server);
          });

          outgoing.pipe(mux).pipe(outgoing);
        });

      return outgoing;
    }

    function onNewConnection(incoming) {

      // Handle a new connection from the app to the server

      function findMuxForReverseConnection(_port) {
        // Find the mux for the reverse connection based on
        // incoming socket's remote port
        var mux = null;
        logger.debug('looking up mux for port: ', _port);
        self._nativeServer._incoming.forEach(function (i) {
          if (i.remotePort === _port) {
            mux = i._mux;
          }
        });
        return mux;
      }

      function handleForwardConnection(connection, server) {

        logger.debug('forward connection');

        // Connect to the native listener and mux the connection
        // When the other side creates a stream, send it to the application
        var outgoing = multiplexToNativeListener(connection, server);

        outgoing.on('error', function (err) {
          logger.warn(err);
          closeServer(server);
          self.emit('failedConnection', {
            'error':'Cannot Connect To Peer',
            'peerIdentifier':peerIdentifier
          });
        });

        outgoing.on('timeout', function () {
          outgoing.destroy();
        });
      }

      function handleReverseConnection(connection) {
        // We expect to be connected to from the p2p side which
        // implies by the time we get here there is already a
        // client socket connected to the server set up by
        // _createNativeListener, find the associated mux
        // and hook it to our incoming connection

        logger.debug('reverse connection');

        if (connection.clientPort in self._pendingReverseConnections) {
          clearTimeout(
            self._pendingReverseConnections[connection.clientPort][1]);
          delete self._pendingReverseConnections[connection.clientPort];
        }

        if (connection.serverPort !== self._nativeServer.address().port) {
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
        var mux = findMuxForReverseConnection(connection.clientPort);
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

        // Create a new stream on the existing mux
        var stream = mux.createStream();
        stream.__id = nextId();

        stream.on('error', function () {
          logger.warn('stream error - reverse connection');
        });

        stream.on('close', function () {
          console.log('stream close');
          incoming.end();
        });

        incoming.pipe(stream).pipe(incoming);
      }

      if (!pleaseConnect && server._firstConnection) {

        server._firstConnection = false;
        logger.debug('first connection');

        Mobile('connect').callNative(peerIdentifier, // jshint ignore:line
          function (err, connection) {

            if (err) {
              logger.warn(err);
              logger.debug('failedConnection');
              incoming.end();
              self.emit('failedConnection',
                { 'error':err, 'peerIdentifier':peerIdentifier });
              return;
            }

            if (connection.listeningPort === 0) {

              // So this is annoying.. there's no guarantee on the order of the
              // server running it's onConnection handler and us getting here.
              // So we don't always find a mux when handling a reverse
              // connection. Handle that here.

              if (findMuxForReverseConnection(connection.clientPort)) {
                handleReverseConnection(connection, server);
              }
              else {
                // Record the pending connection, give it a second to turn up
                self._pendingReverseConnections[connection.clientPort] = [
                  function () { handleReverseConnection(connection, server); },
                  setTimeout(function () {
                    logger.debug('timed out waiting for incoming connection');
                    handleReverseConnection(connection, server);
                  }, 1000)
                ];
              }
            }
            else {
              handleForwardConnection(connection, server);
            }
          });
      }
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
            if (self._peerServers[k][0] < self._peerServers[oldest][0]) {
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
      server.__peerIdentifier = peerIdentifier;
      server._firstConnection = true;

      server.on('connection', onNewConnection);

      server.listen(0, function (err) {
        if (err) {
          logger.warn(err);
          return null;
        }
      });

      self._peerServers[peerIdentifier] = [new Date(), server];

      return server;
    }

    var server = createServer(onNewConnection);
    if (server == null) {
      reject(null);
      return;
    }

    logger.debug('pleaseConnect=', pleaseConnect);

    if (pleaseConnect) {

      // We're being asked to connect to by a lower sorted peer
      Mobile('connect').callNative(peerIdentifier, // jshint ignore:line
        function (err, connection) {
          // This must be a forward connection (connection.listeningPort != 0),
          // anything else would be an error

          if (err) {
            logger.warn(err);
            logger.debug('failedConnection');
            reject(err);
            return;
          }

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
          var outgoing = multiplexToNativeListener(connection, server);

          outgoing.on('error', function (err) {
            logger.warn(err);
            closeServer(server);
            self.emit('failedConnection', {
              'error':'Cannot Connect To Peer',
              'peerIdentifier':peerIdentifier
            });
            reject(err);
          });

          outgoing.on('timeout', function () {
            outgoing.destroy();
          });

          resolve(server.address().port);
        });
    }
    else {
      resolve(server.address().port);
    }
  }

  return new Promise(_do);
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
TCPServersManager.prototype.terminateIncomingConnection =
  function () {
    return new Promise();
  };

/**
 * Notifies the listener of a failed connection attempt. This is mostly used to
 * determine when we have hit the local maximum connection limit but it's used
 * any time there is a connection error since the only other hint that a
 * connection is failed is that the TCP/IP connection to the 127.0.0.1 port will
 * fail.
 *
 * In the case that this error is generated from a callback to the
 * {@link external:"Mobile('connect')".callNative} method then the error
 * returned by connect MUST be returned in this event.
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

/**
 * @readonly
 * @public
 * @enum {string}
 */
TCPServersManager.incomingConnectionState = {
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
 * Indicated if the connection has been established or cut.
 */

module.exports = TCPServersManager;
