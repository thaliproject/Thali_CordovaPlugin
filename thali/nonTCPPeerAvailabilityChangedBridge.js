"use strict";

/** @module NonTCPPeerAvailabilityChangedBridge */

var Promise = require('lie');

/**
 * This function is passed in by {@link module:thaliMobileNativeWrapper} when it calls
 * {@link module:nonTCPPeeravailabilityChangedBridge~NonTCPPeerAvailabilityChangedBridge}. This code will then use
 * the output from this function as the multiplex object that it will connect its TCP/IP listener to. The reason
 * that we have to call back to {@link module:thaliMobileNativeWrapper} is that due to the iOS issue we sometimes
 * have to re-used an existing multiplexer from an incoming connection rather than creating a new one. This call
 * abstracts that problem.
 *
 * @public
 * @callback GetMultiplexerFunction
 * @returns {Object} The multiplexer object that this code should connect its TCP/IP listener to.
 */

/**
 * This event notifies the subscriber that the TCP/IP listener is now closed and the port is released.
 *
 * @public
 * @event closedListener
 * @type {object}
 * @property {error} Error The error explains why the connection was closed.
 */


/**
 * This creates a TCP/IP listener on 127.0.0.1 that can be advertised in nonTCPPeerAvailabilityChangedEvent to
 * accept incoming connections to the identifier peer. It will then handle multiplexing any TCP/IP connections
 * made to it onto a single TCP/IP connection that is piped to the native layer.
 *
 * @public
 * @param {module:NonTCPPeerAvailabilityChangedBridge~GetMultiplexerFunction} getMultiplexer This returns the
 * multiplexer object that this code should use to connect its TCP/IP listener to.
 * @returns {Promise<object|Error>} If successful then a multiplexer object will be returned, otherwise an error.
 * @constructor
 * @fires event:closedListener
 */
function NonTCPPeerAvailabilityChangedBridge(getMultiplexer) {
  return null;
}

/**
 * Start is idempotent and so MAY be called multiple times in a row without changing state. Note however that once
 * the object is stopped a call to start MUST result in a "Stopped Object" error.
 *
 * When start is called for the first time a TCP/IP listener MUST be created on 127.0.0.1 using whatever port is
 * available (e.g. pass in port 0) and that port MUST be returned in the promise resolve. This is the port that is to be
 * advertised in the {@link module:thaliMobileNativeWrapper~nonTCPPeerAvailabilityChangedEvent}.
 *
 * ## Error Events
 * All the objects below can fire error events. In each case we are guaranteed that the error events will be followed
 * up by a close event. So when we receive an error event we MUST log the cause but take no other action.
 *
 * ## Incoming listener TCP/IP Server Object
 * When the first incoming TCP/IP connection arrives then the the code MUST
 * call the {@link module:NonTCPPeerAvailabilityChangedBridge.NonTCPPeerAvailabilityChangedBridge.getMultiplexer} in
 * order to get back the multiplexer it is supposed to use. If an error is returned then the code MUST
 * call close on the TCP/IP server object.
 *
 * If the multiplex object is returned after the TCP/IP server object has been stopped then no action MAY be taken.
 * The creator of this object will already have received the event notifying them that the TCP/IP server object is
 * no longer functional.
 *
 * ### Close Event
 * We MUST call the destroy method on all open TCP/IP sockets that terminate at the server. Then if there is a multiplex
 * object we MUST call destroy on it. Finally we MUST fire the
 * {module:NonTCPPeerAvailabilityChangedBridge~closedListener} event with an appropriate error message.
 *
 * ## Incoming listener TCP/IP socket - Returned from a connection Event
 * If a multiplex object has been defined then createStream on the multiplex object MUST be called and the returned
 * stream MUST be piped in both directions with the TCP/IP stream.
 *
 * If a multiplex object has not been set then when the multiplex object is set then the previous MUST be implemented.
 *
 * ### Close Event
 * When a close is received then destroy MUST be called on the associated stream returned by createStream if it is still
 * open.
 *
 * ## Multiplex Object
 *
 * ### Close Event
 * We MUST call close on the TCP/IP server.
 *
 * ## Multiplex Stream
 * ### Close Event
 * We MUST call close on the piped TCP/IP stream if it is still open.
 *
 * @public
 * @returns {Promise<number|Error>} Returns the port the TCP/IP listener is using on 127.0.0.1 or an error.
 */
NonTCPPeerAvailabilityChangedBridge.prototype.start = function() {
  return Promise.resolve();
};

/**
 * If stop is called before start is called then a "Start Not Called" error MUST be returned.
 *
 * Stop is idempotent and so may be called several times in a row.
 *
 * When stop is called while there is an active TCP/IP listener then close MUST be called on that listener.
 *
 * @returns {Promise<null|Error>} Returns null if the stop worked or an error.
 */
NonTCPPeerAvailabilityChangedBridge.prototype.stop = function() {
  return Promise.resolve();
};

module.exports = NonTCPPeerAvailabilityChangedBridge;
