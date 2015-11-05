"use strict";

/** @module NonTCPPeerAvailabilityChangedBridge */

var Promise = require('lie');

/**
 * This creates a TCP/IP listener on 127.0.0.1 that can be advertised in nonTCPPeerAvailabilityChangedEvent to
 * accept incoming connections to the associated peer. It will then handle multiplexing any TCP/IP connections
 * made to it onto a single TCP/IP connection that is piped to the native layer.
 *
 * @public
 * @param {string} peerIdentifier This is the peerID to be passed to {@link external:"Mobile('Connect')".callNative}.
 * @param {module:incomingConnectionsMultiplexer} incomingConnectionsMultiplexer This is the object used to manage
 * incoming connections. If incoming connections are not being listened for then this object MUST be null.
 * @returns {null}
 * @constructor
 */
function NonTCPPeerAvailabilityChangedBridge(peerIdentifier, incomingConnectionsMultiplexer) {
  return null;
}

/**
 * When start is called a TCP/IP listener MUST be created on 127.0.0.1 using whatever port is available (e.g. pass in
 * port 0) and that port MUST be returned in the promise resolve. This is the port that is to be advertised in the
 * {@link module:thaliMobileNativeWrapper~nonTCPPeerAvailabilityChangedEvent}.
 *
 * When a connection is received over the returned nonTCPPeerAvailabilityChangedBridge port then the code MUST
 * call {@link external:"Mobile('Connect')".callNative} with the supplied peerIdentifier. Note that multiple connections
 * MAY arrive on the TCP/IP listener while waiting for the connect callback. The system MUST be prepared to hold those
 * connections.
 *
 * If the callback from connect is a failure then all connects to the TCP/IP listener MUST be terminated and then
 * the TCP/IP listener MUST be closed.
 *
 * If the callback returns with {@link module:thaliMobileNative~ListenerOrIncomingConnection.listeningPort} set to a
 * number then the code MUST use net.createConnection to create a TCP/IP connection to listeningPort. Then the code
 * MUST create a multiplex object and MUST pipe it in both directions with the newly created TCP/IP connection.
 *
 * Please refer to the file description of {@link module:incomingConnectionsMultiplexer} and the description of
 * {@link module:thaliMobileNativeWrapper~nonTCPPeerAvailabilityChanged} to understand why we use a peerIdentifier
 * in some cases and multiplex object in others.

 *
 * @returns {Promise<number|Error>}
 */
NonTCPPeerAvailabilityChangedBridge.prototype.start = function() {
  return Promise.resolve();
};

module.exports = NonTCPPeerAvailabilityChangedBridge;
