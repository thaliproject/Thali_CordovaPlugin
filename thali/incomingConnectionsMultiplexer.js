"use strict";

/** @module IncomingConnectionsMultiplexer */

var Promise = require('lie');

/**
 * @file
 *
 * This file's job is primarily to deal with incoming connections over non-TCP transports which contained
 * multiplexed content. This file will de-multiplex them and direct the individual requests into TCP/IP and then
 * on to the listening server.
 *
 * However it's not that simple unfortunately.  Some platforms (currently meaning iOS but we suspect Android may join)
 * cannot handle have two native connections
 * between two peers. For example, imagine that peer A wants to initiate a TCP/IP connection with peer B. Historically
 * the way we would try to handle this is by having peer A invite peer B to a MCSession and then establish two
 * output streams (one from each peer) and run the TCP/IP connection over it. If peer B should then decide that it
 * wanted to initiate a TCP connection to peer A then peer B would create a second MCSession and invite peer A to it.
 * The end result is that if both peer A and peer B both simultaneously wanted to establish TCP/IP sessions to each
 * other then they would create two independent MCSession objects between each other. However we have found
 * experimentally that at least as of iOS 8 if two peers establish two simultaneous MCSession objects and start to
 * move a lot of data over them then the output streams will start to randomly fail. To work around this we have to
 * detect when there is an existing non-TCP connection with the desired peer and then re-use it. This works because
 * the multiplexer library is kind enough to allow for multiplexing full duplex node.js streams in either direction.
 */

/**
 * This method is used to terminate an incoming connection from {@link module:thaliMobileNative}, de-multiplex its
 * content and then issue individual TCP/IP requests to thaliMobileNativeWrapperListenerPortNumber.
 *
 * Due to issues with iOS described in the fle description we also have to be ready for a call to the port returned
 * by {@link module:thaliMobileNativeWrapper~nonTCPPeerAvailabilityChangedEvent} to want to connect to the remote
 * peer via the multiplex connection established here.
 *
 * @public
 * @param {number} thaliMobileNativeWrapperListenerPortNumber This is the port number that the server instance
 * created by {@link module:thaliMobileNativeWrapper.startUpdateAdvertisingAndListenForIncomingConnections} created
 * its listener on.
 * @returns {null}
 * @constructor
 */
function IncomingConnectionsMultiplexer(thaliMobileNativeWrapperListenerPortNumber) {
  return null;
}

/**
 * When start is called the code MUST create a new instance of a TCP/IP listener on 127.0.0.1. A random port MUST
 * be chosen (e.g. start with port 0) and that port MUST be returned in the promise. The IncomingConnectionsMultiplexer
 * returned port MUST be passed as the portNumber to
 * {@link external:"Mobile('StartUpdateAdvertisingAndListenForIncomingConnections')".callNative}.
 *
 * Whenever a connection is made to the IncomingConnectionsMultiplexer listener then a new
 * [multiplex](https://www.npmjs.com/package/multiplex) object MUST be created and the incoming TCP/IP connection's
 * socket object MUST be piped in both directions to the multiplex object. This means that if we have N incoming
 * connections tot he TCP/IP listener then we will end up with N multiplex objects.
 *
 * When the multiplex object's onStream callback is called then the incoming client socket MUST cause a
 * net.createConnection to the thaliMobileNativeWrapperListenerPortNumber and then the newly created TCP/IP socket
 * MUST be piped in both directions with the incoming multiplex socket.
 *
 * If a connection to the IncomingConnectionsMultiplexer listener is lost for any reason then the following actions
 * MUST occur in the following order:
 * 1. Close all TCP/IP outgoing connections generated from the multiplex object
 * 2. Call destroy on the multiplex object
 *
 * @public
 * @returns {Promise<number|Error>} If successful then the promise will return the 127.0.0.1 port number where this
 * instance of the IncomingConnectionsMultiplexer is listening for a connection from {@link module:thaliMobileNative}.
 */
IncomingConnectionsMultiplexer.prototype.start = function() {
  return Promise.resolve();
};

/**
 * To deal with the iOS issue explained in the file description we need to get a hold of the multiplex object being
 * used for the incoming connection from the remote peer so that we can use it to establish outgoing TCP/IP connections
 * over the multiplex object out to that peer.
 *
 * @public
 * @param {number} thaliMobileNativeIncomingTCPPort This is the client port that {@link module:thaliMobileNative} is
 * using to connect to IncomingConnectionsMultiplexer's port returned from start. The multiplex object will be used
 * to create connections from this device to the remote device.
 * @returns {Object} The multiplex o
 */
IncomingConnectionsMultiplexer.prototype.getMultipex = function(thaliMobileNativeIncomingTCPPort) {
  return {};
};

IncomingConnectionsMultiplexer.prototype.stop = function() {

};



module.exports = IncomingConnectionsMultiplexer;
