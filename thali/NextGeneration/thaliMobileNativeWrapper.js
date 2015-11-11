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
 * {@link event:nonTCPPeerAvailabilityChangedEvent}.
 *
 * This method is idempotent so multiple consecutive calls without an intervening call to stop will not cause a state
 * change.
 *
 * This method MUST NOT be called if the object is not in start mode or a "Call Start!" error MUST be returned.
 *
 * | Error String | Description |
 * |--------------|-------------|
 * | No Native Non-TCP Support | There are no non-TCP radios on this platform. |
 * | Radio Turned Off | The radio(s) needed for this method are not turned on. |
 * | Unspecified Error with Radio infrastructure | Something went wrong with the radios. Check the logs. |
 * | Call Start! | The object is not in start state. |
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
 * This method MUST NOT be called unless in the start state otherwise a "Call Start!" error MUST be returned.
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
 * By default all incoming TCP connections generated by
 * {@link external:"Mobile('StartUpdateAdvertisingAndListenForIncomingConnections')".callNative} MUST be passed
 * through a multiplex layer. The details of how this layer works are given in {@link module:TCPServersManager}.
 * This method will pass the port from {@link module:TCPServersManager.start} output to
 * {@link external:"Mobile('StartUpdateAdvertisingAndListenForIncomingConnections')".callNative}.
 *
 * ## Repeated calls
 * By design this method is intended to be called multiple times without calling stop as each call causes the
 * currently notification flag to change. But this method MUST NOT be called with a different router object than
 * previous calls unless there was an intervening call to stop. This restriction is just to reduce our test matrix and
 * because it does not interfere with any of our current supported scenarios. If this method is called consecutively
 * without an intervening stop using different router objects then the callback MUST return a "No Changing router
 * without a stop" error.
 *
 * | Error String | Description |
 * |--------------|-------------|
 * | No Native Non-TCP Support | There are no non-TCP radios on this platform. |
 * | Radio Turned Off | The radio(s) needed for this method are not turned on. |
 * | Unspecified Error with Radio infrastructure | Something went wrong with the radios. Check the logs. |
 * | Call Start! | The object is not in start state. |
 *
 * @public
 * @returns {Promise<number|Error>} If successful then the promise will return the portNumber where the router object
 * has been attached on 127.0.0.1. If failed then an Error object with one of the above strings will be returned.
 */
module.exports.startUpdateAdvertisingAndListenForIncomingConnections = function() {
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
 * # WARNING: This method is intended for internal Thali testing only. DO NOT USE!
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
 * When a {@link module:thaliMobileNative~peerAvailabilityChangedCallback} occurs each peer MUST be placed into a queue.
 * Each peer in the queue MUST be processed as given below and only once all processing related to that peer has
 * completed MAY the next peer be taken from the queue.
 *
 * If a peer's peerAvailable is set to false then we MUST use platform specific heuristics to decide how to process
 * this. For example, on Android it is possible for a peer to go into the background at which point their BLE radio
 * will go to low power even though their Bluetooth radio may still be reachable. So the system might decide to
 * wait for a bit before issuing a peerAvailable = false for that peer. But when the system decides to issue a
 * peer not available event it MUST issue a {@link event:nonTCPPeerAvailabilityChangedEvent} with
 * peerIdentifier set to the value in the peer object, portNumber set to null and suggestedTCPTimeout not set.
 *
 * If a peer's peerAvailable is set to true then we MUST cSTART HERE!!!!!
 *
 * ## Deciding when to mark peers as not being available
 * Whenever the system believes a peer has disappeared it MUST issue a nonTCPPeerAvailabilityChanged event with the
 * peer's ID and a null portNumber. The actual heuristic used to determine that a peer is gone is platform
 * dependent. For example, on Android it's possible for a device's BLE radio to be on low power while
 * its Bluetooth radio is available on higher power. This would mean that Android would think that a peer was
 * gone (because it no longer sees its BLE announcements) when in fact the peer is still in range. So it's reasonable
 * for Android, if it hasn't receive a peerAvailabilityChanged event for the peer in the last few seconds to start
 * a timer to 30 seconds or even a minute and only then sending a nonTCPPeerAvailabilityChanged event stating that
 * the peer is gone.
 *
 * ## Maximum number of peers to advertise
 * If the system is currently advertising more than 1000 ports then when the next peer is discovered one of the
 * existing ports MUST be closed a nonTCPPeerAvailabilityChanged event with portNumber set to null MUST be fired
 * for the selected peer. And yes, this means that Thali is currently not designed to handle enormous numbers
 * of simultaneous peers.
 *
 * ## Dealing with a maximum number of simultaneous connections
 * Non-TCP transports typically have a fairly low limit on the number of simultaneous connections they will support.
 * Furthermore Thali may restrict this limit even further based on practical experience with a particular transport's
 * ability to handle multiple connections well. If attempts are made to connect to an unconnected TCP/IP port
 * exposed by `portNumber` below when the system has reached its limit of native connections then the connection
 * request MUST be rejected and a maxPeerReached event MUST be fired. The caller MUST NOT attempt to open any
 * subsequent connections until it has closed one.
 *
 * @public
 * @typedef {Object} nonTCPPeerAvailabilityChanged
 * @property {String} peerIdentifier See {@link module:thaliMobileNative~peer.peerIdentifier}.
 * @property {number|null} portNumber If this value is null then the system is advertising that it no longer believes
 * this peer is available. If this value is non-null then it is a port on 127.0.0.1 at which the local peer can
 * connect in order to establish a TCP/IP connection to the remote peer.
 * @property {number} [suggestedTCPTimeout] Based on the characteristics of the underlying non-TCP transport how long
 * the system suggests that the caller be prepared to wait before the TCP/IP connection to the remote peer can be
 * set up.
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
 * Note that while the native layer can return multiple peers in a single callback the wrapper breaks them into
 * individual events.
 *
 * @public
 * @event nonTCPPeerAvailabilityChangedEvent
 * @type {Object}
 * @property {module:thaliMobileNativeWrapper~nonTCPPeerAvailabilityChanged} peer
 */

/**
 * This is used whenever discovery or advertising starts or stops. Since it's possible for these to
 * be stopped (in particular) due to events outside of node.js's control (for example, someone turned off a radio)
 * we provide a callback to track. Note that there is no guarantee that the same callback value couldn't be sent
 * multiple times in a row.
 *
 * @public
 * @event discoveryAdvertisingStateUpdateNonTcpEvent
 * @type {object}
 * @property {module:thaliMobileNative~discoveryAdvertisingStateUpdate} discoveryAdvertisingStateUpdateValue
 */

/**
 * Provides a notification when the network's state changes as well as when our use of the network changes,
 * specifically when discovery or advertising/listening starts and stops. This event can start firing as soon
 * as the system starts.
 *
 * @public
 * @event networkChanged
 * @type {Object}
 * @property {module:thaliMobileNative~NetworkChanged} networkChangedValue
 */

/**
 * This event specifies that our internal TCP servers are no longer accepting connections so we are in serious
 * trouble. Stopping and restarting is almost certainly necessary at this point.
 *
 * @public
 * @event incomingConnectionToPortNumberFailed
 * @property {number} portNumber the 127.0.0.1 port that the TCP/IP bridge tried to connect to.
 */


/**
 * This method MUST be called before any other method here other than registering for events on the emitter. This
 * method will cause us to:
 * - create a TCP server on a random port and host the router on that server.
 * - create a {@link module:TCPServersManager}.
 * - listen for the {@link module:TCPServersManager~routerPortConnectionFailed} event which we will then cause us to
 * fire a {@link event:incomingConnectionToPortNumberFailed}.
 * - call start on the {@link module:TCPServersManager} object.
 *
 * We MUST register for the native layer handlers exactly once.
 *
 * If the start fails then the object is not in start state.
 *
 * This method is not idempotent. If called two times in a row without an intervening stop a "Call Stop!" Error
 * MUST be returned.
 *
 * This method can be called after stop since this is a singleton object.
 *
 * @public
 * @param {Object} router This is an Express Router object (for example, express-pouchdb is a router object) that the
 * caller wants the non-TCP connections to be terminated with. This code will put that router at '/' so make sure your
 * paths are set up appropriately. The server will be hosted on 127.0.0.1 using whatever port is available and return it
 * in the promise. If stop is called then the system will take down the server so it is no longer available.
 * @returns {Promise<null|Error>}
 */
module.exports.start = function(router) {
  return Promise.resolve();
};

/**
 * This method will call all the stop methods, stop the TCP server hosting the router and call stop on the
 * {@link module:TCPServersManager} object.
 *
 * Once called the object is in stop state.
 *
 * This method is idempotent and so MUST be able to be called multiple times in a row without changing state.
 *
 * @returns {Promise<null|Error>}
 */
module.exports.stop = function() {
  return Promise.resolve();
};

/**
 * Use this emitter to subscribe to events.
 *
 * @public
 * @fires event:nonTCPPeerAvailabilityChangedEvent
 * @fires event:networkChanged
 * @fires event:incomingConnectionToPortNumberFailed
 * @fires event:discoveryAdvertisingStateUpdateNonTcpEvent
 */
module.exports.emitter = new EventEmitter();

// We must register exactly once when this module is first required for the following handlers:
//  * {@link external:"Mobile('PeerAvailabilityChanged')".registerToNative},
//  * {@link external:"Mobile('DiscoveryAdvertisingStateUpdateNonTcp')".registerToNative},
//  * {@link external:"Mobile('NetworkChanged')".registerToNative} and
//  * {@link external:"Mobile('IncomingConnectionToPortNumberFailed')".registerToNative}
