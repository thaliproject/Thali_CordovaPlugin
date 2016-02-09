'use strict';

var Promise = require('lie');
var EventEmitter = require('events').EventEmitter;

/** @module thaliMobileNativeWrapper */

/**
 * @file
 *
 * This is the primary interface for those wishing to talk directly to the
 * native layer. All the methods defined in this file are asynchronous. However,
 * with the exception of {@link module:thaliMobileNativeWrapper.emitter} and
 * {@link module:thaliMobileNativeWrapper.connect}, any time a method is called
 * the invocation will immediately return but the request will actually be put
 * on a queue and all incoming requests will be run out of that queue. This
 * means that if one calls two start methods on say advertising or discovery
 * then the first start method will execute, call back its promise and only then
 * will the second start method start running. This restriction is in place to
 * simplify the state model and reduce testing.
 *
 * ## Why not just call {@link module:thaliMobileNative} directly?
 *
 * Our contract in {@link module:thaliMobileNative} stipulates some behaviors
 * that have to be enforced at the node.js layer. For example, we can only issue
 * a single outstanding non-connect Mobile().callNative command at a time. We
 * also want to change the callbacks from callbacks to promises as well as
 * change registerToNative calls into Node.js events. All of that is handled
 * here. So as a general rule nobody but this module should ever call {@link
 * module:thaliMobileNative}. Anyone who wants to use the {@link
 * module:thaliMobileNative} functionality should be calling this module.
 */

/*
        METHODS
 */

/**
 * This method MUST be called before any other method here other than
 * registering for events on the emitter. This method will cause us to:
 * - create a TCP server (which MUST use {@link
 * module:makeIntoCloseAllServer~makeIntoCloseAllServer}) on a random port and
 * host the router on that server.
 * - create a {@link module:tcpServersManager}.
 * - listen for the {@link module:tcpServersManager~failedConnection} event and
 * then repeat it.
 * - listen for the {@link module:tcpServersManager~routerPortConnectionFailed}
 * event which we will then cause us to fire a {@link
 * event:incomingConnectionToPortNumberFailed}.
 * - call start on the {@link module:tcpServersManager} object and record the
 * returned port.
 *
 * We MUST register for the native layer handlers exactly once.
 *
 * If the start fails then the object is not in start state and vice versa.
 *
 * This method is not idempotent. If called two times in a row without an
 * intervening stop a "Call Stop!" Error MUST be returned.
 *
 * This method can be called after stop since this is a singleton object.
 *
 * @public
 * @param {Object} router This is an Express Router object (for example,
 * express-pouchdb is a router object) that the caller wants the non-TCP
 * connections to be terminated with. This code will put that router at '/' so
 * make sure your paths are set up appropriately.
 * @returns {Promise<?Error>}
 */
module.exports.start = function (router) {
  return new Promise();
};

/**
 * This method will call all the stop methods, call stop on the {@link
 * module:tcpServersManager} object and close the TCP server hosting the router.
 *
 * Once called the object is in stop state.
 *
 * This method is idempotent and so MUST be able to be called multiple times in
 * a row without changing state.
 *
 * @returns {Promise<?Error>}
 */
module.exports.stop = function () {
  return new Promise();
};

/**
 * This method instructs the native layer to discover what other devices are
 * within range using the platform's non-TCP P2P capabilities. When a device is
 * discovered its information will be published via {@link
 * event:nonTCPPeerAvailabilityChangedEvent}.
 *
 * This method is idempotent so multiple consecutive calls without an
 * intervening call to stop will not cause a state change.
 *
 * This method MUST NOT be called if the object is not in start state or a "Call
 * Start!" error MUST be returned.
 *
 * | Error String | Description |
 * |--------------|-------------|
 * | No Native Non-TCP Support | There are no non-TCP radios on this platform. |
 * | Radio Turned Off | The radio(s) needed for this method are not turned on. |
 * | Unspecified Error with Radio infrastructure | Something went wrong with the radios. Check the logs. |
 * | Call Start! | The object is not in start state. |
 *
 * @public
 * @returns {Promise<?Error>}
 * @throws {Error}
 */
module.exports.startListeningForAdvertisements = function () {
  return new Promise();
};

/**
 * This method instructs the native layer to stop listening for discovery
 * advertisements. Note that so long as discovery isn't occurring (because, for
 * example, the radio needed isn't on) this method will return success.
 *
 * This method is idempotent and MAY be called even if
 * startListeningForAdvertisements has not been called.
 *
 * This method MUST NOT terminate any existing connections created locally using
 * {@link module:thaliMobileNativeWrapper.connect}.
 *
 * | Error String | Description |
 * |--------------|-------------|
 * | Failed | Somehow the stop method couldn't do its job. Check the logs. |
 *
 * @public
 * @returns {Promise<?Error>}
 */
module.exports.stopListeningForAdvertisements = function () {
  return new Promise();
};

/**
 * This method has two separate but related functions. It's first function is to
 * begin advertising the Thali peer's presence to other peers. The second
 * purpose is to accept incoming non-TCP/IP connections (that will then be
 * bridged to TCP/IP) from other peers.
 *
 * In Android these functions can be separated but with iOS the multi-peer
 * connectivity framework is designed such that it is only possible for remote
 * peers to connect to the current peer if and only if the current peer is
 * advertising its presence. So we therefore have put the two functions together
 * into a single method.
 *
 * This method MUST NOT be called unless in the start state otherwise a "Call
 * Start!" error MUST be returned.
 *
 * ## Discovery
 *
 * Thali currently handles discovery by announcing over the discovery channel
 * that the Thali peer has had a state change without providing any additional
 * information, such as who the peer is or who the state changes are relevant
 * to. The remote peers, when they get the state change notification, will have
 * to connect to this peer in order to retrieve information about the state
 * change.
 *
 * Therefore the purpose of this method is just to raise the "state changed"
 * flag. Each time it is called a new event will be generated that will tell
 * listeners that the system has changed state since the last call. Therefore
 * this method is not idempotent since each call causes a state change.
 *
 * Once an advertisement is sent out as a result of calling this method
 * typically any new peers who come in range will be able to retrieve the
 * existing advertisement. So this is not a one time event but rather more of a
 * case of publishing an ongoing advertisement regarding the peer's state.
 *
 * ## Incoming Connections
 *
 * By default all incoming TCP connections generated by {@link
 * external:"Mobile('startUpdateAdvertisingAndListening')".callNative} MUST be
 * passed through a multiplex layer. The details of how this layer works are
 * given in {@link module:TCPServersManager}. This method will pass the port
 * from {@link module:TCPServersManager.start} output to {@link
 * external:"Mobile('startUpdateAdvertisingAndListening')".callNative}.
 *
 * If the TCP connection established by the native layer to the previously
 * specified port is terminated by the server for any reason then the native
 * layer MUST tear down the associated Bluetooth socket or MPCF mcSession.
 *
 * ## Repeated calls
 *
 * By design this method is intended to be called multiple times without calling
 * stop as each call causes the currently notification flag to change.
 *
 * | Error String | Description |
 * |--------------|-------------|
 * | No Native Non-TCP Support | There are no non-TCP radios on this platform. |
 * | Radio Turned Off | The radio(s) needed for this method are not turned on. |
 * | Unspecified Error with Radio infrastructure | Something went wrong with the radios. Check the logs. |
 * | Call Start! | The object is not in start state. |
 *
 * @public
 * @returns {Promise<?Error>}
 */
module.exports.startUpdateAdvertisingAndListening =
  function () {
    return new Promise();
  };

/**
 * This method tells the native layer to stop advertising the presence of the
 * peer, stop accepting incoming connections over the non-TCP/IP transport and
 * to disconnect all existing non-TCP/IP transport incoming connections.
 *
 * Note that so long as advertising has stopped and there are no incoming
 * connections or the ability to accept them then this method will return
 * success. So, for example, if advertising was never started then this method
 * will return success.
 *
 * | Error String | Description |
 * |--------------|-------------|
 * | Failed | Somehow the stop method couldn't do its job. Check the logs. |
 *
 * @public
 * @returns {Promise<?Error>}
 */
module.exports.stopAdvertisingAndListening = function () {
  return new Promise();
};

/**
 * This method returns the last value sent by the
 * {@link module:thaliMobileNativeWrapper.event:networkChangedNonTCP}
 * event.
 *
 * The reason we use a promise is that there is a race condition where someone
 * could call this before we have gotten the first network status event. Rather
 * than force everyone to play the game where they have to subscribe to the
 * event and call this method just to figure out the status for things like UX
 * that says "Hey you don't have the right radio!" we just use a promise that
 * won't return until we have a value.
 *
 * @public
 * @returns {Promise<module:thaliMobileNative~networkChanged>}
 */
module.exports.getNonTCPNetworkStatus = function() {
  return new Promise();
};

/**
 * This is used for native connections and calls through to TCPServersManager.
 *
 * @param {Object} incomingConnectionId
 * @returns {Promise<?Error>}
 */
module.exports.terminateConnection = function (incomingConnectionId) {
  return new Promise();
};

/**
 * # WARNING: This method is intended for internal Thali testing only. DO NOT
 * USE!
 *
 * This method is only intended for iOS. It's job is to terminate all incoming
 * and outgoing multipeer connectivity framework browser, advertiser, MCSession
 * and stream connections immediately without using the normal stop and start
 * interfaces or TCP/IP level connections. The goal is to simulate what would
 * happen if we switched the phone to something like airplane mode. This
 * simulates what would happen if peers went out of range.
 *
 * This method MUST return "Not Supported" if called on Android. On Android we
 * can get this functionality by using JXCore's ability to disable the local
 * radios.
 *
 * | Error String | Description |
 * |--------------|-------------|
 * | Failed | Somehow the stop method couldn't do its job. Check the logs. |
 * | Not Supported | This method is not support on this platform. |
 *
 * @private
 * @returns {Promise<?Error>}
 */
module.exports.killConnections = function () {
  return new Promise();
};

/*
        EVENTS
 */

/**
 * When a {@link module:thaliMobileNative~peerAvailabilityChangedCallback}
 * occurs each peer MUST be placed into a queue. Each peer in the queue MUST be
 * processed as given below and only once all processing related to that peer
 * has completed MAY the next peer be taken from the queue.
 *
 * If a peer's peerAvailable is set to false then we MUST use platform specific
 * heuristics to decide how to process this. For example, on Android it is
 * possible for a peer to go into the background at which point their BLE radio
 * will go to low power even though their Bluetooth radio may still be
 * reachable. So the system might decide to wait for a bit before issuing a
 * peerAvailable = false for that peer. But when the system decides to issue a
 * peer not available event it MUST issue a {@link
 * event:nonTCPPeerAvailabilityChangedEvent} with peerIdentifier set to the
 * value in the peer object, portNumber set to null and suggestedTCPTimeout not
 * set.
 *
 * If a peer's peerAvailable is set to true then we MUST call {@link
 * module:tcpServersManager.createPeerListener}. If an error is returned then
 * the error MUST be logged and we MUST treat this as if we received the value
 * with peerAvailable equal to false. If the call is a success then we MUST
 * issue a {@link event:nonTCPPeerAvailabilityChangedEvent} with peerIdentifier
 * set to the value in the peer object, portNumber set to the returned value and
 * suggestedTCPTimeout set based on the behavior we have seen on the platform.
 * That is, some non-TCP technologies can take longer to set up a connection
 * than others so we need to warn those upstream of that.
 *
 * @public
 * @typedef {Object} nonTCPPeerAvailabilityChanged
 * @property {string} peerIdentifier See {@link module:thaliMobileNative~peer.peerIdentifier}.
 * @property {number|null} portNumber If this value is null then the system is advertising that it no longer believes
 * this peer is available. If this value is non-null then it is a port on 127.0.0.1 at which the local peer can
 * connect in order to establish a TCP/IP connection to the remote peer.
 * @property {number} [suggestedTCPTimeout] Based on the characteristics of the underlying non-TCP transport how long
 * the system suggests that the caller be prepared to wait before the TCP/IP connection to the remote peer can be
 * set up. This is measured in milliseconds.
 */

/**
 * This event MAY start firing as soon as either of the start methods is called.
 * Start listening for advertisements obviously looks for new peers but in some
 * cases so does start advertising. This is because in some cases it's possible
 * for peer A to discover peer B but not vice versa. This can result in peer A
 * connecting to peer B who previously didn't know peer A exists. When that
 * happens we will fire a discovery event.
 *
 * This event MUST stop firing when both stop methods have been called.
 *
 * The native layer does not guarantee that it will filter out duplicate
 * peerAvailabilityChanged callbacks. This means it is possible to receive
 * multiple announcements about the same peer in the same state.
 *
 * While the native layer can return multiple peers in a single callback the
 * wrapper breaks them into individual events. See {@link
 * module:thaliMobileNativeWrapper~nonTCPPeerAvailabilityChanged} for details on
 * how to process each peer.
 *
 * If we receive a {@link module:tcpServersManager~failedConnection} then we
 * MUST treat that as the equivalent of having received a peer for
 * nonTCPPeerAvailabilityChanged with peerAvailable set to false.
 *
 * @public
 * @event nonTCPPeerAvailabilityChangedEvent
 * @type {Object}
 * @property {module:thaliMobileNativeWrapper~nonTCPPeerAvailabilityChanged} peer
 */

/**
 * This is used whenever discovery or advertising starts or stops. Since it's
 * possible for these to be stopped (in particular) due to events outside of
 * node.js's control (for example, someone turned off a radio) we provide a
 * callback to track these changes. Note that there is no guarantee that the
 * same callback value couldn't be sent multiple times in a row.
 *
 * But the general rule we will only fire this event in response to receiving
 * the event from the native layer. That is, we won't fire it ourselves when
 * someone calls start or stop advertising/incoming on the wrapper.
 *
 * @public
 * @event discoveryAdvertisingStateUpdateNonTCPEvent
 * @type {Object}
 * @property {module:thaliMobileNative~discoveryAdvertisingStateUpdate} discoveryAdvertisingStateUpdateValue
 */

/**
 * Provides a notification when the network's state changes as well as when our
 * use of the network changes, specifically when discovery or
 * advertising/listening starts and stops. This event MUST fire with the current
 * network state when the first subscription to the event is received.
 *
 * @public
 * @event networkChangedNonTCP
 * @type {Object}
 * @property {module:thaliMobileNative~networkChanged} networkChangedValue
 */

/**
 * This event specifies that our internal TCP servers are no longer accepting
 * connections so we are in serious trouble. Stopping and restarting is almost
 * certainly necessary at this point. We can discover this either because of an
 * error in {@link module:tcpServersManager} or because of {@link
 * external:"Mobile('incomingConnectionToPortNumberFailed')".registerToNative}.
 *
 * @public
 * @event incomingConnectionToPortNumberFailed
 * @property {number} portNumber the 127.0.0.1 port that the TCP/IP bridge tried
 * to connect to.
 */

/**
 * Use this emitter to subscribe to events.
 *
 * @public
 * @fires event:nonTCPPeerAvailabilityChangedEvent
 * @fires event:networkChangedNonTCP
 * @fires event:incomingConnectionToPortNumberFailed
 * @fires event:discoveryAdvertisingStateUpdateNonTCPEvent
 * @fires module:TCPServersManager~failedConnection We repeat these events
 * @fires module:TCPServersManager~incomingConnectionState we repeat these
 * events.
 */
module.exports.emitter = new EventEmitter();

if (typeof Mobile !== 'undefined') {
  Mobile('PeerAvailabilityChange').registerToNative(function (peers) {
    // do stuff!
  });

  Mobile('discoveryAdvertisingStateUpdateNonTCP').registerToNative(
    function (discoveryAdvertisingStateUpdateValue) {
      // do stuff!
    });

  Mobile('networkChanged').registerToNative(function (networkChanged) {
    // do stuff!
  });

  Mobile('incomingConnectionToPortNumberFailed').registerToNative(
    function (portNumber) {
      // do stuff!
    });
}
