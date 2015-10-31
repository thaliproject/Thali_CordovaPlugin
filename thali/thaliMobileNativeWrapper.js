"use strict";

var Promise = require("lie");

/** @module thaliMobileNativeWrapper */

/*
        METHODS
 */

/**
 * @file
 *
 * This is the primary interface for those wishing to talk directly to the native layer. All the methods defined
 * in this file are asynchronous. However, with the exception of {@link module:thaliMobileNativeWrapper.emitter} and
 * {@link module:thaliMobileNativeWrapper.connect}, any time a method is called the invocation will immediately return
 * but the request will actually be put on a queue and all incoming requests will be run out of that queue. This means
 * that if one calls two start methods then the first start method will execute, call back its promise and only then
 * will the second start method start running. This restriction is in place to simplify the state model and reduce
 * testing.
 *
 * ## Why not just call {@link module:thaliMobileNative} directly?
 * Our contract in {@link module:thaliMobileNative} stipulates some behaviors that have to be enforced
 * at the node.js layer. For example, we can only issue a single outstanding non-connect Mobile().callNative
 * command at a time. We also want to change the callbacks from callbacks to promises as well as change
 * registerToNative calls into Node.js events. All of that is handled here. So as a general rule nobody
 * but this module should ever call {@link module:thaliMobileNative}. Anyone who wants to use the
 * {@link module:thaliMobileNative} functionality should be calling this module.
 */

/**
 * This method instructs the native layer to discover what other devices are within range using the platform's non-TCP
 * P2P capabilities. When a device is discovered its information will be published via
 * {@link event:peerAvailabilityChanged} public from {@link module:thaliMobileNativeWrapper.emitter}.
 *
 * This method is idempotent so multiple consecutive calls without an intervening call to stop will not cause a state
 * change.
 *
 * | Error String | Description |
 * |--------------|-------------|
 * | No Native Non-TCP Support | There are no non-TCP radios on this platform. |
 * | Radio Turned Off | The radio(s) needed for this method are not turned on. |
 * | Unspecified Error with Radio infrastructure | Something went wrong with the radios. Check the logs. |
 *
 * @public
 * @returns {Promise<null|Error>}
 * @throws {Error}
 */
module.exports.startListeningForAdvertisements = function() {
  return Promise.resolve();
};

/**
 * This method instructs the native layer to stop listening for discovery advertisements. Note that so long as
 * discovery isn't occurring (because, for example, the radio needed isn't on) this method will return success.
 *
 * This method MUST NOT terminate any existing connections created locally using
 * {@link module:thaliMobileNativeWrapper.connect}.
 *
 * | Error String | Description |
 * |--------------|-------------|
 * | Failed | Somehow the stop method couldn't do its job. Check the logs. |
 *
 * @public
 * @returns {Promise<null|Error>}
 */
module.exports.stopListeningForAdvertisements = function() {
  return Promise.resolve();
};

/**
 * This method has two separate but related functions. It's first function is to begin advertising the Thali peer's
 * presence to other peers. The second purpose is to accept incoming non-TCP/IP connections (that will then be bridged
 * to TCP/IP) from other peers.
 *
 * In Android these functions can be separated but with iOS the multi-peer connectivity framework is designed such
 * that it is only possible for remote peers to connect to the current peer if and only if the current peer is
 * advertising its presence. So we therefore have put the two functions together into a single method.
 *
 * ## Discovery
 * Thali currently handles discovery by announcing over the discovery channel that the Thali peer has had a
 * state change without providing any additional information, such as who the peer is or who the state changes
 * are relevant to. The remote peers, when they get the state change notification, will have to connect to this
 * peer in order to retrieve information about the state change.
 *
 * Therefore the purpose of this method is just to raise the "state changed" flag. Each time it is called a new
 * event will be generated that will tell listeners that the system has changed state since the last call. Therefore
 * this method is not idempotent since each call causes a state change.
 *
 * Once an advertisement is sent out as a result of calling this method typically any new peers who come in range
 * will be able to retrieve the existing advertisement. So this is not a one time event but rather more of a case
 * of publishing an ongoing advertisement regarding the peer's state.
 *
 * ## Incoming Connections
 * This method also instructs the native layer to accept incoming connections over the non-TCP/IP transport and to
 * bridge those connections to TCP/IP and then connect to the submitted portNumber on 127.0.0.1.
 *
 * When another device connects to this device over the non-TCP/IP based native technology the native layer will create
 * a local TCP/IP client who will connect to 127.0.0.1 using the supplied portNumber. This will make the remote device
 * look to the local Node.js code as if it were talking over TCP/IP. But this is just a bridge from the non-TCP/IP
 * native technology to TCP/IP.
 *
 * ## Repeated calls
 * By design this method is intended to be called multiple times without calling stop as each call causes the
 * currently notification flag to change. But this method MUST NOT be called with a different portNumber than
 * previous calls unless there was an intervening call to stop. This restriction is just to reduce our test matrix and
 * because it does not interfere with any of our current supported scenarios. If this method is called consecutively
 * without an intervening stop using different portNumbers then the callback MUST return a "No Changing portNumber
 * without a stop" error.
 *
 * | Error String | Description |
 * |--------------|-------------|
 * | portNumber is not a legal number | The port has to be between 1 and 65535 |
 * | No Changing portNumber without a stop | See previous paragraph. |
 * | No Native Non-TCP Support | There are no non-TCP radios on this platform. |
 * | Radio Turned Off | The radio(s) needed for this method are not turned on. |
 * | Unspecified Error with Radio infrastructure | Something went wrong with the radios. Check the logs. |
 *
 * @public
 * @param portNumber
 * @returns {Promise<null|Error>}
 */
module.exports.startUpdateAdvertisingAndListenForIncomingConnections = function(portNumber) {
  return Promise.resolve();
};

/**
 * This method tells the native layer to stop advertising the presence of the peer, stop accepting incoming
 * connections over the non-TCP/IP transport and to disconnect all existing non-TCP/IP transport incoming connections.
 *
 * Note that so long as advertising has stopped and there are no incoming connections or the ability to accept them
 * then this method will return success. So, for example, if advertising was never started then this method will
 * return success.
 *
 * | Error String | Description |
 * |--------------|-------------|
 * | Failed | Somehow the stop method couldn't do its job. Check the logs. |
 *
 * @public
 * @returns {Promise<null|Error>}
 */
module.exports.stopAdvertisingAndListeningForIncomingConnections = function() {
  return Promise.resolve();
};

/**
 * This method tells the native layer to establish a non-TCP/IP connection to the identified peer and to then create
 * a TCP/IP bridge on top of that connection which can be accessed locally by opening a TCP/IP connection to the
 * port returned in the callback.
 *
 * This method MUST return an error if called while start listening for advertisements is not active.
 * This restriction is really only needed for iOS but we enforce it on Android as well in order to keep the platform
 * consistent.
 *
 * If this method is called consecutively with the same peerIdentifier then if a connection already exists its port
 * MUST be returned otherwise a new connection MUST be created.
 *
 * The port created by a Connect call MUST only accept a single TCP/IP connection at a time. Any subsequent TCP/IP
 * connections to the 127.0.0.1 port MUST be rejected.
 *
 * It is implementation dependent if the non-TCP/IP connection that the 127.0.0.1 port will be bound to is created
 * before the callback is called or only when the TCP/IP port is first connected to.
 *
 * If any of the situations listed below occur then the non-TCP/IP connection MUST be fully closed, the existing
 * connection to the 127.0.0.1 port (if any) MUST be closed and the port MUST be released:
 *
 *  - The TCP/IP connection to the 127.0.0.1 port is closed or half closed
 *  - No connection is made to the 127.0.0.1 port within a fixed period of time, typically 2 seconds
 *  - If the non-TCP/IP connection should fail in whole or in part (e.g. some non-TCP/IP transports have the TCP/IP
 *  equivalent of a 1/2 closed connection)
 *
 * A race condition exists that can cause something called a "channel binding problem". This race condition occurs
 * when a callback to this method is received with a port but before the port can be used it gets closed and re-assign
 * to someone else. The conditions under which this occur typically involve interactions with the native system
 * and other parallel threads/processes. But if this happens then the client code can think that a certain port
 * represents a particular peer when it may not.
 *
 * Typically we use TLS to address this problem for connections run on the multiplexer layer that sits on top of
 * the port returned by this method. TLS allows us to authenticate that we are talking with whom we think we are
 * talking. But if TLS can't be used then some equivalent mechanism must be or an impersonation attack becomes
 * possible.
 *
 * | Error String | Description |
 * |--------------|-------------|
 * | Illegal peerID | The peerID has a format that could not have been returned by the local platform |
 * | StartListeningForAdvertisements is not active | Go start it! |
 * | Connection could not be established | The attempt to connect to the peerID failed. This could be because the peer is gone, no longer accepting connections or the radio stack is just horked. |
 * | Max connections reached | The native layers have practical limits on how many connections they can handle at once. If that limit has been reached then this error is returned. The only action to take is to wait for an existing connection to be closed before retrying.  |
 * | No Native Non-TCP Support | There are no non-TCP radios on this platform. |
 * | Radio Turned Off | The radio(s) needed for this method are not turned on. |
 * | Unspecified Error with Radio infrastructure | Something went wrong with the radios. Check the logs. |
 *
 * @public
 * @param {String} peerIdentifier
 * @returns {Promise<module:thaliMobileNative~ListenerOrIncomingConnection|Error>}
 */
module.exports.connect = function(peerIdentifier) {
  return Promise.resolve();
};

/**
 *  * WARNING: This method is intended for internal Thali testing only. DO NOT USE!
 *
 * This method is only intended for iOS. It's job is to terminate all incoming and outgoing multipeer connectivity
 * framework browser, advertiser, MCSession and stream connections immediately without using the normal stop and
 * start interfaces or TCP/IP level connections. The goal is to simulate what would happen if we switched the
 * phone to something like airplane mode. This simulates what would happen if peers went out of range.
 *
 * This method MUST return "Not Supported" if called on Android.
 *
 * | Error String | Description |
 * |--------------|-------------|
 * | Failed | Somehow the stop method couldn't do its job. Check the logs. |
 * | Not Supported | This method is not support on this platform. |
 *
 * @private
 * @returns {Promise<null|Error>}
 */
module.exports.killConnections = function() {
  return Promise.resolve();
};

/*
        EVENTS
 */

/**
 * This event is fired whenever the network's state or our use of the network's state has changed.
 *
 * This event MAY start firing as soon as either of the start methods is called. Start listening for advertisements
 * obviously looks for new peers but in some cases so does start advertising. This is because in some cases
 * it's possible for peer A to discover peer B but not vice versa. This can result in peer A connecting to peer B
 * who previously didn't know peer A exists. When that happens we will first a discovery event.
 *
 * This event MUST stop firing when both stop methods have been called.
 *
 * The native layer will make no attempt to filter out peerAvailabilityChanged callbacks. This means it is possible to
 * receive multiple announcements about the same peer in the same state.
 *
 * @event peerAvailabilityChanged
 * @public
 * @type {Object}
 * @property {module:thaliMobileNative~peer[]} peers
 */

/**
 * Provides a notification when the network's state changes as well as when our use of the network changes,
 * specifically when discovery or advertising/listening starts and stops. This event can start firing as soon
 * as the system starts.
 *
 * @event networkChanged
 * @public
 * @type {Object}
 * @property {module:thaliMobileNative~NetworkChanged} networkChangedValue
 */

/**
 * This event specifies that a non-TCP communication mechanism was used to successfully connect an incoming connection
 * from a remote peer but the system could not complete a TCP/IP handshake with the `portNumber` on 127.0.0.1 that
 * was passed into the system.
 *
 * @event incomingConnectionToPortNumberFailed
 * @public
 * @property {number} portNumber the 127.0.0.1 port that the TCP/IP bridge tried to connect to.
 */


/**
 * Use this emitter to subscribe to events.
 *
 * @public
 * @fires event:peerAvailabilityChanged
 * @fires event:networkChanged
 * @fires event:incomingConnectionToPortNumberFailed
 */
module.exports.emitter = new EventEmitter();

