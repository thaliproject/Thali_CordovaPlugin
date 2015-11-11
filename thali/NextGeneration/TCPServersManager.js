"use strict";

var Promise = require("lie");

/** @module TCPServersManager */

/**
 * @file
 *
 * This is where we manage creating multiplex objects. There are three different scenarios where multiplex objects
 * can get created:
 *
 * Android
 * - We get an incoming connection from the native layer to the portNumber we submitted to
 * StartUpdateAdvertisingAndListenForIncomingConnections
 *  - We create a mux that pipes to the incoming TCP/IP connection.
 * - We get a peerAvailabilityChanged Event
 *  - We create a local listener and advertise nonTCPPeerAvailabilityChanged. When we get a connection to that listener
 *  then we call native connect, create a connection to the native connect port, hook the mux to that connection on
 *  one end and the incoming listener to the mux on the other end.
 *
 * iOS - Lexically Smaller Peer
 * * - We get an incoming connection from the native layer to the portNumber we submitted to
 * StartUpdateAdvertisingAndListenForIncomingConnections
 *  - We create a mux that pipes to the incoming TCP/IP connection. We keep track of this mux because we might need it
 *  in the next entry. Remember, we don't know which peer made the incoming connection.
 * - We get a peerAvailabilityChanged Event
 *  - Because we are lexically smaller this event will have pleaseConnect set to false. So we create a port and advertise it
 *  on nonTCPPeerAvailabilityChanged. When we get a connection we call connect. If there is already an incoming
 *  connection then the connect will return with the clientPort/serverPort and we will re-use the existing mux. If
 *  there is no existing incoming connection then the system will wait to trigger the lexically larger peer to create
 *  it and once it is created and properly terminated (per the previous section) then we will find the mux via
 *  clientPort/ServerPort.
 *
 * iOS - Lexically Larger Peer
 * - We get an incoming connection from the native layer to the portNumber we submitted to
 * StartUpdateAdvertisingAndListenForIncomingConnections
 *  - It isn't possible.
 * - We get a peerAvailabilityChanged Event
 *  - If the peerAvailabilityChanged Event has pleaseConnect set to true then baring any limitation on available
 *  resources we should immediately issue a connect and hook in the mux to it configured to handling incoming
 *  connections and then create a TCP listener and have it use createStream with the mux for any incoming connections.
 *  Obviously if we already have a connection to the identified peer then we can ignore the pleaseConnect value.
 *  - If the peerAvailabilityChanged Event has pleaseConnect set to false then we will set up a TCP listener and
 *  advertise the port but we won't create the mux or call connect until the first connection to the TCP listener
 *  comes in.
 */

/**
 * This method creates a TCP listener to handle requests from the native layer and to then pass them through a
 * multiplex object who will route all the multiplexed connections to routerPort, the port the system has hosted
 * the submitted router object on. The TCP listener will be started
 * on port 0 and the port it is hosted on will be returned in the promise. This is the port that MUST be submitted to
 * the native layer's
 * {@link external:"Mobile('StartUpdateAdvertisingAndListenForIncomingConnections')".callNative} command.
 *
 * This method MUST NOT be called more than once. If it is this strongly indicates that something is really wrong
 * in {@link module:ThaliMobileNativeWrapper}. If it is called twice then an exception with "Don't call me twice!"
 * MUST be thrown.
 *
 * ## TCP Listener
 *
 * ### Connect Event
 * A multiplex object MUST be created and MUST be directly piped in both directions with the
 * TCP socket returned by the listener. We MUST set a timeout on TCP socket to a reasonable value for the platform. The
 * created multiplex object MUST be recorded with an index of the client port used by the incoming TCP native client
 * connection.
 *
 * ### Error Event
 * The error MUST be logged.
 *
 * ### Close Event
 * We MUST call destroy on all multiplex objects spawned by this TCP listener.
 *
 * ## Incoming TCP socket returned by the server's connect event
 * ### Error Event
 * The error MUST be logged.
 *
 * ### Timeout Event
 * Destroy MUST be called on the multiplex object. This will trigger a total cleanup.
 *
 * ### Close Event
 * If this close is not the result of a destroy on the multiplex object then destroy MUST be called on the multiplex
 * object.
 *
 * ## Multiplex Object
 * ## onStream Callback
 * The incoming stream MUST cause us to create a net.createConnection to routerPort and to then take the new TCP socket
 * and pipe it in both directions with the newly created stream. We MUST track the TCP socket so we can clean it up
 * later. Note that the TCP socket will track its associated stream and handle cleaning it up. If the TCP socket
 * cannot be connected to routerPort then a routerPortConnectionFailed event MUST be fired and destroy MUST
 * be called on the stream provided in the callback.
 *
 * ### Error Event
 * The error MUST be logged.
 *
 * ### Close Event
 * Destroy MUST first be called on all the TCP sockets we created to routerPort (the TCP sockets will then close
 * their associated multiplex streams). Then we MUST call Destroy on the incoming TCP socket from the native
 * layer. Note that in some cases one or more of these objects could already be closed before we call destroy so we
 * MUST be prepared to catch any exceptions. Finally we MUST remove the multiplex object from the list of multiplex
 * objects we are maintaining.
 *
 * ## TCP client socket created by net.createConnection call from multiplex object
 * ### Error Event
 * The error MUST be logged.
 *
 * ### Close Event
 * Destroy MUST be called on the stream this TCP socket is piped to.
 *
 * ## multiplex onStream stream
 * ### Error Event
 * The error MUST be logged.
 *
 * ### Close Event
 * If the close did not come from the TCP socket this stream is piped to then close MUST be called on the associated
 * TCP socket.
 *
 * @private
 * @param {Number} routerPort Port that the router object submitted to
 * {@link module:ThaliMobileNativeWrapper.startUpdateAdvertisingAndListenForIncomingConnections} is hosted on.
 * @returns {Promise<Number|Error>} The port that the mux is listening on for connections from the native layer or an
 * Error object.
 */
TCPServersManager.prototype.createIncomingListener = function(routerPort) {
  return Promise.resolve();
};

/**
 * This creates a local TCP server to accept incoming connections from the Thali app that will be sent to the
 * identified peer.
 *
 * If this method is called before start is called then a "Start First!" error MUST be thrown. If this method is
 * called after stop is called then a "We are stopped!" error MUST be thrown.
 *
 * If there is already a TCP server listening for connections to the submitted peerIdentifier and if that server
 * was created with a different pleaseConnect value then the Error "We are connected to that peer with a different
 * pleaseConnect" MUST be returned. Otherwise if the pleaseConnect is the same then the port for the TCP server
 * MUST be returned.
 *
 * If there is no existing TCP server for the specified peer then we MUST examine how many peers we are advertising
 * 127.0.0.1 ports for. If that number is equal to 1000 then we MUST call destroy on one of those TCP listeners before
 * continuing with this method. That way we will never offer connections to more than 1000 peers at a time. We should
 * exclude all TCP servers that have active multiplex objects and pick a TCP server to close based on FIFO. Once
 * we have closed the TCP server, if necessary, then a new TCP server MUST be created on port 0 (e.g.
 * any available port) and configured as follows:
 *
 * ## TCP server
 * If pleaseConnect is true then an immediate call MUST be made to {@link external:"Mobile('Connect')".callNative} to
 * connect to the specified peer. If that call fails then the error MUST be returned. Otherwise a new multiplex
 * object MUST be created and a new TCP connection via net.createConnection pointed at the port returned by the
 * connect call. The multiplex object MUST be piped in both directions with the new TCP connection. The TCP connection
 * MUST have setTimeout called on it and set to a reasonable value for the platform.
 *
 * ### Connection Event
 * #### First call to connection event when pleaseConnect is false
 * If pleaseConnect is false then when the first connection event occurs we MUST issue a
 * {@link external:"Mobile('Connect')".callNative} for the requested peer and handle the response as given in the
 * following sections.
 *
 * ##### Error
 * If we get an error then we MUST close the TCP connection and fire a {@link event:failedConnection} event with the
 * returned error.
 *
 * ##### listenerPort
 * If the response is listenerPort then
 * we MUST perform the actions specified above for pleaseConnect is true with the exception that if the Connect fails
 * then we MUST call close on the TCP server since the peer is not available and fire a {@link event:failedConnection}
 * event with the error set to "Cannot Connect To Peer".
 *
 * ##### clientPort/serverPort
 * If clientPort/serverPort are not null then we MUST confirm that the
 * serverPort matches the port that the server created in
 * {@link module:TCPServersManager.createIncomingListener} is listening on and if not then we MUST call destroy on
 * the incoming TCP connection, fire a {@link event:failedConnection} event with the error set to "Mismatched serverPort",
 * and act as if connection had not been called (e.g. the next connection will be treated
 * as the first).
 *
 * Otherwise we must then lookup the multiplex object via the clientPort. If there is no multiplex object associated
 * with that clientPort then we have a race condition where the incoming connection died between when the connect
 * response was sent and now. In that case we MUST call destroy on the incoming TCP connection, first a
 * {@link event:failedConnection} event with the error set to "Incoming connection died" and as previously
 * described treat the next connection as if it were the first.
 *
 * Otherwise we MUST configure the multiplex object with the behavior specified below.
 *
 * #### Standard connection event behavior
 * Each socket returned by the connection event MUST cause a call to createStream on the multiplex object and the
 * returned stream MUST be piped in both directions with the connection TCP socket.
 *
 * ### Error Event
 * The error MUST be logged.
 *
 * ### Close Event
 * All the TCP sockets to routerPort MUST first be destroyed. Then all the TCP sockets from the Thali
 * application MUST be destroyed.
 *
 * Unless destroy was called on the TCP server by the multiplex object then destroy MUST be called on the multiplex
 * object.
 *
 * ## Multiplex object
 * ### onStream callback
 * If a stream is received a call to net.createConnection MUST be made pointed at routerPort. If the TCP connection
 * cannot be successfully connected then a {@link event:routerPortConnectionFailed} MUST be fired and destroy MUST be
 * called on the stream. Otherwise the TCP connection and the stream MUST be piped to each other in both directions.
 *
 * Note that we will support the ability to accept incoming connections over the multiplex object even for platforms
 * like Android that do not need it. This is just to keep the code and testing simple and consistent.
 *
 * ### Error Event
 * The error MUST be logged.
 *
 * ### Close Event
 * If the destroy didn't come the TCP server then destroy MUST be called on the TCP server.
 * If the destroy didn't come from the TCP native socket then destroy MUST be called on the TCP native socket.
 *
 * ## TCP socket to native layer
 * ### Timeout Event
 * Destroy MUST be called on itself.
 *
 * ### Error Event
 * The error MUST be logged.
 *
 * ### Close Event
 * Destroy MUST be called on the multiplex object the stream is piped to.
 *
 * ## TCP socket from Thali Application
 * ### Error Event
 * The error MUST be logged.
 *
 * ### Close Event
 * Destroy MUST be called on the stream object the socket is piped to if that isn't the object that called destroy
 * on the socket.
 *
 * ## createStream Socket
 * ### Error Event
 * The error MUST be logged.
 *
 * ### Close Event
 * If destroy wasn't called by the TCP socket from Thali Application the stream is piped to then destroy MUST be called
 * on that TCP socket.
 *
 * ## TCP socket to routerPort
 * ### Error Event
 * The error MUST be logged.
 *
 * ### Close Event
 * Destroy MUST be called on the stream object the socket is piped to if that isn't the object that called destroy
 * on the socket.
 *
 * ## onStream callback stream
 * ### Error Event
 * The error MUST be logged.
 *
 * ### Close Event
 * If destroy wasn't called by the TCP socket to routerPort the stream is piped to then destroy MUST be called on that
 * TCP socket.
 *
 * @public
 * @param {String} peerIdentifier
 * @param {Boolean} [pleaseConnect] If set to true this indicates that a lexically smaller peer asked for a connection
 * so the lexically larger peer (the local device) will immediately call
 * {@link external:"Mobile('Connect')".callNative} to create a connection. If false (the default value) then the call
 * to {@link external:"Mobile('Connect')".callNative} will only happen on the first incoming connection to the
 * TCP server.
 * @returns {Promise<Number|Error>}
 */
TCPServersManager.prototype.connectToPeer = function(peerIdentifier, pleaseConnect) {
  return Promise.resolve();
};

/**
 * This method will call {@link module:TCPServersManager.createIncomingListener} and return the port or error
 * from that method.
 *
 * This method is idempotent and so MUST be able to be called multiple times in a row without changing state.
 *
 * If this method is called after a call to {@link module:TCPServersManager.stop} then a "We are stopped!" Error
 * MUST be thrown.
 *
 * @returns {Promise<Number|Error>} Returns the port to be passed to
 * {@link external:"Mobile('StartUpdateAdvertisingAndListenForIncomingConnections')".callNative} when the system
 * is ready to receive external incoming connections.
 */
TCPServersManager.prototype.start = function() {
  return Promise.resolve();
};

/**
 * This will cause destroy to be called on the TCP server created by
 * {@link module:TCPServersManager.createIncomingListener} and then on all the TCP servers created by
 * {@link module:TCPServersManager.connectToPeerViaNativeLayer}.
 *
 * This method is idempotent and so MUST be able to be called multiple times in a row without changing state.
 *
 * If this method is called before calling start then a "Call Start!" Error MUST be thrown.
 */
TCPServersManager.prototype.stop = function() {

};

/**
 * Notifies the listener of a failed connection attempt. This is mostly used to determine when we have hit the
 * local maximum connection limit but it's used any time there is a connection error since the only other hint
 * that a connection is failed is that the TCP/IP connection to the 127.0.0.1 port will fail.
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
 * An instance of this class is used by {@link module:thaliMobileNativeWrapper} to create the TCP servers needed
 * to handle non-TCP incoming and outgoing connections.
 *
 * @public
 * @constructor
 * @param {number} routerPort The port that the system is hosting the local router instance for the Thali Application.
 * @fires event:routerPortConnectionFailed
 * @fires event:failedConnection
 */
function TCPServersManager(routerPort) {

}

module.exports = TCPServersManager;
