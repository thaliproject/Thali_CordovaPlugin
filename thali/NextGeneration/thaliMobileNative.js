'use strict';

/** @module thaliMobileNative */

/**
 * @file This file defines the contract for the Mobile bindings that Thali
 * provides for JXcore's native call interface. The actual API calls will "just
 * be there" since they are added to the global environment via JXcore's native
 * binding mechanism. It is expected that these methods will not be called
 * directly but rather will be called via the {@link
 * module:thaliMobileNativeWrapper} wrappers.
 *
 * The primary use of these apis is to enable us to leverage non-TCP/IP
 * capabilities on various devices we run on. In the case of Android this is a
 * combination of BLE (for discovery) and Bluetooth (for high bandwidth data
 * transfer). In the case of iOS this is multi-peer connectivity framework which
 * runs on a mix of Bluetooth, an Apple proprietary variant of Wi-Fi Direct and
 * normal Wi-Fi (if connected to an access point that supports local multi-cast
 * and connectivity between devices on the same AP or network of local APs).
 * Note that Apple's multi-peer connectivity framework actually appears to use a
 * combination of TCP and UDP in some cases but it does not expose a TCP level
 * socket. So although TCP/IP is involved nevertheless that use of TCP is hidden
 * from programs using the multi-peer connectivity framework and so for all
 * intents and purposes it is a non-TCP/IP transport.
 *
 * This library also provides information from the native platform such as
 * information about network connectivity.
 *
 * Note that callbacks rather than promises are specified below because that
 * is required by the JXcore native API.
 *
 * ## Request processing model
 *
 * With the exception of `connect` the `callNative` methods defined in this
 * file MUST only be called serially. That is, once a `callNative` method other
 * than `connect` is called no other `callNative` methods but `connect` can be
 * called until the first `callNative`'s callback has been called. If this
 * prohibition is violated then the system will enter an undefined state.
 *
 * ## Idempotent calls
 *
 * All stop methods are idempotent. So multiple calls will not result in a
 * state change.
 *
 * All stop methods are always safe to call even if their start paired method
 * has not yet been called. The default start state is "stop" so calling a stop
 * method before calling its start method pair just means to stay in the stop
 * state.
 *
 * ## Initial system state When a Thali app starts up and before any of the
 * APIs defined here are called the initial state of the system MUST be:
 * - No listening for discovery announcements using the native facilities
 * - No listening for incoming connections using the native facilities
 * - No advertising information using the native facilities
 */


/*
                   callNative methods
 */

/**
 * This is the default callback we use for the methods defined in this file.
 * @public
 * @callback ThaliMobileCallback
 * @param {error} err If null then the call the callback was submitted to was
 * successful. If not null then it will be an Error object that will define what
 * went wrong.
 */

/**
 * @external "Mobile('startListeningForAdvertisements')"
 */

/**
 * Please see the definition of
 * {@link module:thaliMobileNativeWrapper.startListeningForAdvertisements}.
 *
 * @public
 * @function external:"Mobile('startListeningForAdvertisements')".callNative
 * @param {module:thaliMobileNative~ThaliMobileCallback} callBack
 */

/**
 * @external "Mobile('stopListeningForAdvertisements')"
 */

/**
 * Please see the definition of
 * {@link module:thaliMobileNativeWrapper.stopListeningForAdvertisements}.
 *
 * @public
 * @function external:"Mobile('stopListeningForAdvertisements')".callNative
 * @param {module:thaliMobileNative~ThaliMobileCallback} callBack
 */

/**
 * @external "Mobile('startUpdateAdvertisingAndListening')"
 */

/**
 * Please see the definition of
 * {@link module:thaliMobileNativeWrapper.startUpdateAdvertisingAndListening}.
 *
 * However, in addition to what is written there, when the system receives an
 * incoming connection it will do so by initiating a single TCP/IP connection to
 * the port given below in `portNumber`. If the non-TCP connection from which
 * the content in the TCP/IP connection is sourced should terminate for any
 * reason then the TCP/IP connection MUST also be terminated. If the TCP
 * connection to `portNumber` is terminated for any reason then the associated
 * non-TCP connection MUST be terminated.
 *
 * @public
 * @function external:"Mobile('startUpdateAdvertisingAndListening')".callNative
 * @param {number} portNumber The port on 127.0.0.1 that any incoming connections over the native non-TCP/IP transport
 * should be bridged to.
 * @param {module:thaliMobileNative~ThaliMobileCallback} callback
 */

/**
 * @external "Mobile('stopAdvertisingAndListening')"
 */

/**
 * Please see the definition of
 * {@link module:thaliMobileNativeWrapper.stopAdvertisingAndListening}.
 *
 * @public
 * @function external:"Mobile('stopAdvertisingAndListening')".callNative
 * @param {module:thaliMobileNative~ThaliMobileCallback} callback
 */

/**
 * When we are asked to connect to a remote peer the way we normally handles
 * this is by opening a port on 127.0.0.1 and listening for an incoming
 * connection. When we get the incoming connection we then bridge it to the
 * remote peer.
 *
 * When we are using our normal behavior the listeningPort parameter will be
 * set to the port the local Thali application should connect to and both
 * clientPort and serverPort MUST be null.
 *
 * However, we also have to deal with a bug in iOS's multipeer connectivity
 * framework. Our original iOS design involved us having one MCSession that
 * connected peer A as a TCP/IP client to peer B and then a second MCSession
 * that connected peer B as a TCP/IP client to peer A. But there is apparently a
 * bug in iOS that if two peers have two MCSessions and if one moves around a
 * bunch of data then the connections become unstable and randomly fail.
 *
 * Our work around for this problem is that we will always form exactly one
 * MCSession between two peers. So let's say that peer A establishes a MCSession
 * with peer B. In that case peer A will create an output stream to peer B who
 * will then respond with an output stream to peer A. We will then marshal these
 * streams to TCP/IP by exposing peer A as a TCP/IP listener that peer A
 * connects to and sends data to peer B. Peer B will see the connection as an
 * incoming TCP/IP client that connects to Peer B's `portNumber`.
 *
 * Now imagine that Peer B issues a connect request to Peer A's
 * `peerIdentifier`. Ideally we would just create a new MCSession and do what we
 * described above in reverse. But we cannot because of the bug. So the work
 * around is that we will use this type to notify the caller that what they have
 * to do is to use the existing connection from Peer A to Peer B to send TCP/IP
 * connection requests back to Peer A. This involves magic at the mux layer. In
 * other words we are pushing an iOS bug up from the iOS native code into
 * Node.js and requiring us to solve it up in Node.js land. For all the gory
 * details on how this works see the [binding
 * spec](http://thaliproject.org/PresenceProtocolBindings/).
 *
 * We use the `clientPort` value below so that the mux layer can figure out
 * which of its connections is the one it needs to use to talk to the desired
 * peer.
 *
 * We use the `serverPort` to indicate which 127.0.0.1 port we connected to.
 * The reason we include it here is because there is a potential race condition
 * where between the time we created the response to the connect request and
 * when it was actually sent to Node.js in theory we could have received a stop
 * and start that switched us to a different `portNumber`. So by including
 * `serverPort` we can catch those race conditions.
 *
 * @public
 * @typedef {Object} ListenerOrIncomingConnection
 * @property {number} listeningPort The port on which the native layer is
 * listening on 127.0.0.1 for an incoming TCP/IP connection that the native
 * layer will then relay to the remote peer.
 * @property {number} clientPort The port that the native layer's TCP/IP
 * client uses to connect to the `portNumber` submitted by the Thali
 * application.
 * @property {number} serverPort The port that the native layer's TCP/IP
 * client connected to.
 */

/**
 * This is the callback used by {@link external:"Mobile('connect')".callNative}.
 *
 * If err is not NULL then listenerOrIncomingConnection MUST be null and vice
 * versa.
 *
 * @public
 * @callback ConnectCallback
 * @param {error} err If null then the call the callback was submitted to was
 * successful. If not null then it will be an Error object that will define what
 * went wrong.
 * @param {module:thaliMobileNative~ListenerOrIncomingConnection} listenerOrIncomingConnection
 */

/**
 * @external "Mobile('connect')"
 */

/**
 * This method tells the native layer to establish a non-TCP/IP connection to
 * the identified peer and to then create a TCP/IP bridge on top of that
 * connection which can be accessed locally by opening a TCP/IP connection to
 * the port returned in the callback.
 *
 * This method MUST return an error if called while start listening for
 * advertisements is not active. This restriction is really only needed for iOS
 * but we enforce it on Android as well in order to keep the platform
 * consistent.
 *
 * If this method is called consecutively with the same peerIdentifier and a
 * connection is either in progress or already exists then an error MUST
 * be returned. Otherwise a new
 * connection MUST be created. 
 * 
 * In the case of Android there MUST be at most one
 * Bluetooth client connection between this peer and the identified remote peer.
 * In the case of iOS there MUST be at most one MCSession between this peer and
 * the identified remote peer. In the case of iOS if this peer is lexically
 * smaller than the other peer then the iOS layer MUST try to establish a
 * MCSession with the remote peer as a signaling mechanism per the instructions
 * in the binding spec. If an incoming connection is created within a reasonable
 * time period from the lexically larger peer then the system MUST issue a
 * connect callback with listeningPort set to null and clientPort/serverPort set
 * based on the values used when establishing the incoming connection from the
 * remote peer.
 *
 * The port created by a connect call MUST only accept a single TCP/IP
 * connection at a time. Any subsequent TCP/IP connections to the 127.0.0.1 port
 * MUST be rejected.
 *
 * It is implementation dependent if the non-TCP/IP connection that the
 * 127.0.0.1 port will be bound to is created before the callback is called or
 * only when the TCP/IP port is first connected to.
 *
 * If any of the situations listed below occur then the non-TCP/IP connection
 * MUST be fully closed, the existing connection to the 127.0.0.1 port (if any)
 * MUST be closed and the port MUST be released:
 *
 *  - The TCP/IP connection to the 127.0.0.1 port is closed or half closed
 *  - No connection is made to the 127.0.0.1 port within a fixed period of
 *  time, typically 2 seconds (this only applies on Android and for lexically
 *  larger iOS peers)
 *  - If the non-TCP/IP connection should fail in whole or in part (e.g. some
 *  non-TCP/IP transports have the TCP/IP equivalent of a 1/2 closed connection)
 *
 * A race condition exists that can cause something called a "channel binding
 * problem". This race condition occurs when a callback to this method is
 * received with a port but before the port can be used it gets closed and
 * re-assign to someone else. The conditions under which this occur typically
 * involve interactions with the native system and other parallel
 * threads/processes. But if this happens then the client code can think that a
 * certain port represents a particular peer when it may not.
 *
 * Typically we use TLS to address this problem for connections run on the
 * multiplexer layer that sits on top of the port returned by this method. TLS
 * allows us to authenticate that we are talking with whom we think we are
 * talking. But if TLS can't be used then some equivalent mechanism must be or
 * an impersonation attack becomes possible.
 *
 * | Error String | Description |
 * |--------------|-------------|
 * | Illegal peerID | The peerID has a format that could not have been returned by the local platform |
 * | startListeningForAdvertisements is not active | Go start it! |
 * | Alreading connect(ing/ed) | There already is a connection or a request to createone is already in process |
 * | Connection could not be established | The attempt to connect to the peerID failed. This could be because the peer is gone, no longer accepting connections or the radio stack is just horked. |
 * | Connection wait timed out | This is for the case where we are a lexically smaller peer and the lexically larger peer doesn't establish a connection within a reasonable period of time. |
 * | Max connections reached | The native layers have practical limits on how many connections they can handle at once. If that limit has been reached then this error is returned. The only action to take is to wait for an existing connection to be closed before retrying.  |
 * | No Native Non-TCP Support | There are no non-TCP radios on this platform. |
 * | Radio Turned Off | The radio(s) needed for this method are not turned on. |
 * | Unspecified Error with Radio infrastructure | Something went wrong with the radios. Check the logs. |
 *
 * @public
 * @function external:"Mobile('connect')".callNative
 * @param {string} peerIdentifier
 * @param {module:thaliMobileNative~ConnectCallback} callback Returns an
 * error or the 127.0.0.1 port to connect to in order to get a connection to the
 * remote peer
 */

/**
 * @external "Mobile('killConnections')"
 * @private
 */

/**
 * Please see the definition of
 * {@link module:thaliMobileNativeWrapper.killConnections}.
 *
 * @private
 * @function external:"Mobile('killConnections')".callNative
 * @param {module:thaliMobileNative~ThaliMobileCallback} callback
 */

/*
              registerToNative Methods
 */

/**
 * This object defines peerAvailabilityChanged information about a single peer.
 *
 * @typedef {Object} peer
 * @property {string} peerIdentifier An opaque value that identifies a
 * non-TCP/IP transport handle for the discovered peer. Because of how
 * non-TCP/IP transports work it is completely possible for the same remote peer
 * to have many different peerIdentifiers assigned to them. So the only purpose
 * of this value is to use it in a connect call not to uniquely identify a peer.
 * @property {boolean} peerAvailable If true this indicates that the peer is
 * available for connectivity. If false it means that the peer can no longer be
 * connected to. For too many reasons to count it's perfectly possible to never
 * get a false for peerAvailable. It is also possible to get a false when the
 * peer is still reachable. A classic example is on Android where the app can go
 * into the background reducing the power to the BLE radio which can make the
 * peer seem to disappear. But Bluetooth would still be on full power so a
 * connect could still work. So this value can at best be treated as a hint.
 * @property {boolean} pleaseConnect If true then this means that a lexically
 * smaller peer wishes to establish a connection to this peer but requires this
 * peer to initiate the connection per the binding spec. If this peer already
 * has called {@link external:"Mobile('connect')".callNative} for the identified
 * peer then no action MUST be taken. Similarly if this peer already has a
 * connection to the remote peer then no action MUST be taken. Yes, there are
 * many race conditions here but the binding protocol calls for the other peer
 * to repeat its request a number of times so it should be o.k. If this value is
 * false then it either means that this isn't iOS or it means that the remote
 * peer is either lexically larger or not currently interested in connecting.
 */

/**
 * @external "Mobile('peerAvailabilityChanged')"
 */

/**
 * This is the callback used by
 * {@link external:"Mobile('peerAvailabilityChanged')".registerToNative}
 *
 * @public
 * @callback peerAvailabilityChangedCallback
 * @property {module:thaliMobileNative~peer[]} peers
 */

/**
 * Please see the definition of
 * {@link module:thaliMobileNativeWrapper~peerAvailabilityChanged}
 *
 * In addition to what is written there the following applies to the native
 * implementation: The native layer MUST NOT send peerAvailabilityChanged
 * callbacks more frequently than every 200 ms. This is to prevent starving out
 * the node.js main thread. Therefore updates that become available before the
 * next transmission MUST be queued up in the native layer and then sent at once
 * to node.js using the array capability of peerAvailabilityChanged. We also
 * MUST keep the total size of these notifications down (e.g. don't DOS node).
 * So if we are getting lots of repeated announcements we can throw those away
 * and if we are just getting large numbers of unique announcements then it's
 * better to drop some than starve out Node. When overloaded with too many
 * announcements prefer to drop the oldest ones first.
 *
 * @public
 * @function external:"Mobile('peerAvailabilityChanged')".registerToNative
 * @param {module:thaliMobileNative~peerAvailabilityChangedCallback} callback
 */

/**
 * This object defines the state of discovery and advertising
 *
 * @typedef {Object} discoveryAdvertisingStateUpdate
 * @property {boolean} discoveryActive True if discovery is running otherwise
 * false. Note that this value can change as a result of calling start and stop
 * on discovery but also due to the user or other apps altering the system's
 * radio state.
 * @property {boolean} advertisingActive True if advertising is running
 * otherwise false. Note that this value can change as a result of calling start
 * and stop on advertising but also due to the user or other apps altering the
 * system's radio state.
 */

/**
 * @external "Mobile('discoveryAdvertisingStateUpdateNonTCP')"
 */

/**
 * This is the callback used by
 * {@link external:"Mobile('discoveryAdvertisingStateUpdateNonTCP')".registerToNative}
 *
 * @public
 * @callback discoveryAdvertisingStateUpdateNonTCPCallback
 * @property {module:thaliMobileNative~discoveryAdvertisingStateUpdate} discoveryAdvertisingStateUpdateValue
 */

/**
 * Please see the definition of
 * {@link module:thaliMobileNativeWrapper~discoveryAdvertisingStateUpdateNonTCPEvent}
 *
 * @public
 * @function external:"Mobile('discoveryAdvertisingStateUpdateNonTCP')".registerToNative
 * @param {module:thaliMobileNative~discoveryAdvertisingStateUpdateNonTCPCallback} callback
 */

/**
 * Enum to describe the state of the system's radios
 *
 * @public
 * @readonly
 * @enum {string}
 */
var radioState = {
  /** The radio is on and available for use. */
  ON: 'on',
  /** The radio exists on the device but is turned off. */
  OFF: 'off',
  /** The radio exists on the device and is on but for some reason the system won't let us use it. */
  UNAVAILABLE: 'unavailable',
  /** We depend on this radio type for this platform type but it doesn't appear to exist on this device. */
  NOT_HERE: 'notHere',
  /** Thali doesn't use this radio type on this platform and so makes no effort to determine its state. */
  DO_NOT_CARE: 'doNotCare'
};

/**
 * This object defines the current state of the network
 *
 * @public
 * @typedef {Object} networkChanged
 * @property {module:thaliMobileNative~radioState} blueToothLowEnergy
 * @property {module:thaliMobileNative~radioState} blueTooth
 * @property {module:thaliMobileNative~radioState} wifi
 * @property {string} bssidName If null this value indicates that either
 * wifiRadioOn is not 'on' or that the Wi-Fi isn't currently connected to an
 * access point. If non-null then this is the BSSID of the access point that
 * Wi-Fi is connected to.
 */

/**
 * @external "Mobile('networkChanged')"
 */

/**
 * This is the callback used by
 * {@link external:"Mobile('networkChanged')".registerToNative}
 *
 * @public
 * @callback networkChangedCallback
 * @property {module:thaliMobileNative~networkChanged} networkChanged
 */

/**
 * Any time the state of the network changes (meaning any of the values in the
 * {@link module:thaliMobileNative~networkChanged} object are altered) any
 * callbacks registered with this method will be called. The native layer is
 * obligated to send an instance of this callback in response to the first
 * subscription it gets to this event. This will be used by the 
 * {@link module:thaliMobileNativeWrapper} to initialize its tracking of
 * the network's state for 
 * {@link module:thaliMobileNativeWrapper~getNonTCPNetworkStatus}.
 *
 * The callbacks MUST NOT be sent more frequently than every 100 ms. If
 * multiple network changes occur during that period then only the last update
 * before the waiting period is up MUST be sent. This means that we do not
 * guarantee that all changes in the network's status will necessarily result in
 * a networkChanged callback.
 *
 * @public
 * @function external:"Mobile('networkChanged')".registerToNative
 * @param {module:thaliMobileNative~networkChangedCallback} callback
 */

/**
 * @external "Mobile('incomingConnectionToPortNumberFailed')"
 */

/**
 * This is the callback used by
 * {@link external:"Mobile('incomingConnectionToPortNumberFailed')".registerToNative}
 *
 * @public
 * @callback incomingConnectionToPortNumberFailedCallback
 * @property {number} portNumber The 127.0.0.1 port that the TCP/IP bridge tried to connect to.
 */

/**
 * Please see the definition of
 * {@link module:thaliMobileNativeWrapper.incomingConnectionToPortNumberFailed}.
 *
 * This event MUST NOT be sent more often than every 100 ms. This means that
 * one cannot count the number of instances of this event in order to count how
 * many connections were missed. This also means that the native layer is only
 * required to track exactly one instance of this event for any given port within
 * the 100 ms window. In other words if the systetm is listening on port X and
 * 10,000 incoming requests come for port X within 100 ms (that would be impressive)
 * then the native layer is only obligated to send up exactly one notification of
 * the problem. This is because the native app only needs to know that its port is
 * either overloaded or down as a general notification.
 *
 * @public
 * @function external:"Mobile('incomingConnectionToPortNumberFailed')".registerToNative
 * @param {module:thaliMobileNative~incomingConnectionToPortNumberFailedCallback} callback
 */
