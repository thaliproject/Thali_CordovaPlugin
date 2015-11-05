"use strict";

/** @module thaliMobileNative */

/*
      callNative methods
 */

/**
 * @file This file is really just a mockup describing the available Mobile bindings that Thali provides for JXcore's
 * native call interface. The actual API calls will "just be there" since they are added to the global environment
 * via JXcore's native binding mechanism. It is expected that these methods will not be called directly but rather
 * will be called via the {@link module:thaliMobileNativeWrapper} wrappers.
 *
 * The primary use of these apis is to enable us to leverage non-TCP/IP capabilities on various devices
 * we run on. In the case of Android this is a combination of BLE (for discovery) and Bluetooth (for high bandwidth
 * data transfer). In the case of iOS this is multi-peer connectivity framework which runs on a mix of Bluetooth,
 * an Apple proprietary variant of Wi-Fi Direct and normal Wi-Fi (if connected to an access point that supports
 * local multi-cast and connectivity between devices on the same AP or network of local APs). Note that Apple's
 * multi-peer connectivity framework actually appears to use a combination of TCP and UDP in some cases but it does
 * not expose a TCP level socket. So although TCP/IP is involved nevertheless that use of TCP is hidden from programs
 * using the multi-peer connectivity framework and so for all intents and purposes it is a non-TCP/IP transport.
 *
 * This library also provides
 * information from the native platform such as information about network connectivity.
 *
 * Note that callbacks rather than promises are specified below because that is required by the JXcore native API.
 *
 * ## Request processing model
 *
 * With the exception of `Connect` the `callNative` methods defined in this file MUST only be called serially. That is,
 * once a `callNative` method other than `Connect` is called no other `callNative` methods but `Connect` can be called
 * until the first `callNative`'s callback has been called. If this prohibition is violated then the system will
 * enter an undefined state.
 *
 * ## Idempotent calls
 *
 * All stop methods are idempotent. So multiple calls will not result in a state change.
 *
 * All stop methods are always safe to call even if their start paired method has not yet been called. The default
 * start state is "stop" so calling a stop method before calling its start method pair just means to stay in the
 * stop state.
 *
 * ## Initial system state
 * When a Thali app starts up and before any of the APIs defined here are called the initial state of the system MUST
 * be:
 * - No listening for discovery announcements using the native facilities
 * - No listening for incoming connections using the native facilities
 * - No advertising information using the native facilities
 *
 * ## registerToNative
 * In some cases the `registerToNative` callbacks are prohibited from being called back until a start method has
 * been called. A start method is considered called as soon as `callNative` for that start method is called, even
 * if the callback submitted with the `callNative` call has not yet been called. This just means
 * that those interested in getting all the relevant `registerToNative` callbacks must register before calling
 * the related start method.
 */

/**
 * This is the default callback we use for the methods defined in this file.
 * @public
 * @callback ThaliMobileCallback
 * @param {error} err - If null then the call the callback was submitted to was successful. If not null then it will be
 * an Error object that will define what went wrong.
 * @returns {null} - No response is expected.
 */

/**
 * @external "Mobile('StartListeningForAdvertisements')"
 */

/**
 * Please see the definition of {@link module:thaliMobileNativeWrapper.startListeningForAdvertisements}.
 *
 * @public
 * @function external:"Mobile('StartListeningForAdvertisements')".callNative
 * @param {module:thaliMobileNative~ThaliMobileCallback} callBack
 * @returns {null}
 */

/**
 * @external "Mobile('StopListeningForAdvertisements')"
 */

/**
 * Please see the definition of {@link module:thaliMobileNativeWrapper.stopListeningForAdvertisements}.
 *
 * @public
 * @function external:"Mobile('StopListeningForAdvertisements')".callNative
 * @param {module:thaliMobileNative~ThaliMobileCallback} callBack
 * @returns {null}
 */

/**
 * @external "Mobile('StartUpdateAdvertisingAndListenForIncomingConnections')"
 */

/**
 * Please see the definition of
 * {@link module:thaliMobileNativeWrapper.startUpdateAdvertisingAndListenForIncomingConnections}.
 *
 * However, in addition to what is written there, when the system receives an incoming connection it will do so
 * by initiating a single TCP/IP connection to the port given below in `portNumber`. If the non-TCP connection
 * from which the content in the TCP/IP connection is sourced should terminate for any reason then the TCP/IP
 * connection MUST also be terminated. If the TCP connection to `portNumber` is terminated for any reason then
 * the associated non-TCP connection MUST be terminated.
 *
 * @public
 * @function external:"Mobile('StartUpdateAdvertisingAndListenForIncomingConnections')".callNative
 * @param {Number} portNumber - The port on 127.0.0.1 that any incoming connections over the native non-TCP/IP transport
 * should be bridged to.
 * @param {module:thaliMobileNative~ThaliMobileCallback} callback
 * @returns {null}
 */

/**
 * @external "Mobile('StopAdvertisingAndListeningForIncomingConnections')"
 */

/**
 * Please see the definition of {@link module:thaliMobileNativeWrapper.stopAdvertisingAndListeningForIncomingConnections}.
 *
 * @public
 * @function external:"Mobile('StopAdvertisingAndListeningForIncomingConnections')".callNative
 * @param {module:thaliMobileNative~ThaliMobileCallback} callback
 * @returns {null}
 */

/**
 * When we are asked to connect to a remote peer the way we normally handles this is by opening a port on 127.0.0.1
 * and listening for an incoming connection. When we get the incoming connection we then bridge it to the remote peer.
 *
 * When we are using our normal behavior the listeningPort parameter will be set to the port the local Thali application
 * should connect to and both clientPort and serverPort MUST be null.
 *
 * However, we also have to deal with a bug in iOS's multipeer connectivity framework. Our original iOS design involved
 * us having one MCSession that connected peer A as a TCP/IP client to peer B and then a second MCSession that connected
 * peer B as a TCP/IP client to peer A. But there is apparently a bug in iOS that if two peers have two MCSessions and
 * if one moves around a bunch of data then the connections become unstable and randomly fail.
 *
 * Our work around for this problem is that we will always form exactly one MCSession between two peers. So let's say
 * that peer A establishes a MCSession with peer B. In that case peer A will create an output stream to peer B
 * who will then respond with an output stream to peer A. We will then marshal these streams to TCP/IP by exposing
 * peer A as a TCP/IP listener that peer A connects to and sends data to peer B. Peer B will see the connection
 * as an incoming TCP/IP client that connects to Peer B's `portNumber`.
 *
 * Now imagine that Peer B issues a connect request to Peer A's `peerIdentifier`. Ideally we would just create
 * a new MCSession and do what we described above in reverse. But we cannot because of the bug. So the work around
 * is that we will use this type to notify the caller that what they have to do is to use the existing connection
 * from Peer A to Peer B to send TCP/IP connection requests back to Peer A. This involves magic at the mux layer.
 * In other words we are pushing an iOS bug up from the iOS native code into Node.js and requiring us to solve it
 * up in Node.js land. For all the gory details on how this works see the
 * [binding spec](http://www.thaliproject.org/presenceprotocolBindings.md).
 *
 * We use the `clientPort` value below so that the mux layer can figure out which of its connections is the one
 * it needs to use to talk to the desired peer.
 *
 * We use the `serverPort` to indicate which 127.0.0.1 port we connected to. The reason
 * we include it here is because there is a potential race condition where between the time we created the
 * response to the connect request and when it was actually sent to Node.js in theory we could have received
 * a stop and start that switched us to a different `portNumber`. So by including `serverPort` we can
 * catch those race conditions.
 *
 * @public
 * @typedef {Object} ListenerOrIncomingConnection
 * @property {Number} listeningPort The port on which the native layer is listening on 127.0.0.1 for an incoming
 * TCP/IP connection that the native layer will then relay to the remote peer.
 * @property {Number} clientPort The port that the native layer's TCP/IP client uses to connect to the `portNumber`
 * submitted by the Thali application.
 * @property {Number} serverPort The port that the native layer's TCP/IP client connected to.
 */

/**
 * This is the callback used by {@link external:"Mobile('Connect')".callNative}.
 *
 * If err is not NULL then `portNumber` and `incomingConnection` MUST be null.
 * If err is NULL then exactly one of `portNumber` and `incomingConnection` MUST be non-null and the other MUST
 * be NULL.
 *
 * @public
 * @callback ConnectCallback
 * @param {error} err If null then the call the callback was submitted to was successful. If not null then it will be
 * an Error object that will define what went wrong.
 * @param {module:thaliMobileNative~ListenerOrIncomingConnection} listenerOrIncomingConnection Provides either
 * the TCP/IP 127.0.0.1 port to connect to in order to bridge to the remote peer or it returns information about
 * an existing incoming TCP/IP connection that will have to be reused at the multiplexer layer to talk to the remote
 * peer.
 * @returns {null}
 */

/**
 * @external "Mobile('Connect')"
 */

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
 * @function external:"Mobile('Connect')".callNative
 * @param {String} peerIdentifier
 * @param {module:thaliMobileNative~ConnectCallback} callback - Returns an error or the 127.0.0.1 port to connect to in
 * order to get a connection to the remote peer
 * @returns {null}
 */

/**
 * @external "Mobile('KillConnections')"
 * @private
 */

/**
 * Please see the definition of {@link module:thaliMobileNativeWrapper.killConnections}.
 *
 * @private
 * @function external:"Mobile('KillConnections')".callNative
 * @param {module:thaliMobileNative~ThaliMobileCallback} callback
 * @returns {null}
 */

/*
        registerToNative Methods
 */

/**
 * This object defines peerAvailabilityChanged information about a single peer.
 *
 * @typedef {Object} peer
 * @property {String} peerIdentifier An opaque value that identifies a non-TCP/IP transport handle for the discovered
 * peer. Because of how non-TCP/IP transports work it is completely possible for the same remote peer to have many
 * different peerIdentifiers assigned to them. So the only purpose of this value is to use it in a connect call.
 * @property {Boolean} peerAvailable If true this indicates that the peer is available for connectivity. If false
 * it means that the peer can no longer be connected to. For too many reasons to count it's perfectly possible to never
 * get a false for peerAvailable. It is also possible to get a false when the peer is still reachable. A classic
 * example is on Android where the app can go into the background reducing the power to the BLE radio which can make
 * the peer seem to disappear. But Bluetooth would still be on full power so a connect could still work. So this value
 * can at best be treated as a hint.
 */

/**
 * @external "Mobile('PeerAvailabilityChanged')"
 */

/**
 * This is the callback used by {@link external:"Mobile('PeerAvailabilityChanged')".registerToNative}
 *
 * @public
 * @callback peerAvailabilityChangedCallback
 * @property {module:thaliMobileNative~peer[]} peers
 * @returns {null}
 */

/**
 * Please see the definition of {@link module:thaliMobileNativeWrapper~peerAvailabilityChanged}
 *
 * In addition to what is written there the following applies to the native implementation:
 * The native layer MUST NOT send peerAvailabilityChanged callbacks more frequently than every 200 ms. This is to
 * prevent starving out the node.js main thread. Therefore updates that become available before the next transmission
 * MUST be queued up in the native layer and then sent at once to node.js using the array capability of
 * peerAvailabilityChanged.
 *
 * @public
 * @function external:"Mobile('PeerAvailabilityChanged')".registerToNative
 * @param {module:thaliMobileNative~peerAvailabilityChangedCallback} callback
 * @returns {null}
 */

/**
 * This object defines the state of discovery and advertising
 *
 * @typedef {Object} discoveryAdvertisingStateUpdate
 * @property {Boolean} discoveryActive - True if discovery is running otherwise false. Note that this value can
 * change as a result of calling start and stop but also due to the user or other apps altering the system's
 * radio state.
 * @property {Boolean} advertisingActive - True if advertising is running otherwise false. Note that this value can
 * change as a result of calling start and stop but also due to the user or other apps altering the system's
 * radio state.
 */

/**
 * @external "Mobile('DiscoveryAdvertisingStateUpdateNonTcp')"
 */

/**
 * This is the callback used by {@link external:"Mobile('DiscoveryAdvertisingStateUpdateNonTcp')".registerToNative}
 *
 * @public
 * @callback discoveryAdvertisingStateUpdateNonTcpCallback
 * @property {module:thaliMobileNative~discoveryAdvertisingStateUpdate} discoveryAdvertisingStateUpdateValue
 * @returns {null}
 */

/**
 * Please see the definition of {@link module:thaliMobileNativeWrapper~discoveryAdvertisingStateUpdateNonTcpEvent}
 *
 * @public
 * @function external:"Mobile('DiscoveryAdvertisingStateUpdateNonTcp')".registerToNative
 * @param {module:thaliMobileNative~discoveryAdvertisingStateUpdateNonTcpCallback} callback
 * @returns {null}
 */


/**
 * Enum to describe the state of the system's radios
 *
 * @readonly
 * @enum {number}
 */
var radioState = {
  /** The radio is on and available for use. */
  on: "on",
  /** The radio exists on the device but is turned off. */
  off: "off",
  /** The radio exists on the device and is on but for some reason the system won't let us use it. */
  unavailable: "unavailable",
  /** We depend on this radio type for this platform type but it doesn't appear to exist on this device. */
  notHere: "notHere",
  /** Thali doesn't use this radio type on this platform and so makes no effort to determine its state. */
  doNotCare: "doNotCare"
};

/**
 * This object defines the current state of the network
 *
 * @public
 * @typedef {Object} NetworkChanged
 * @property {module:thaliMobileNative~radioState} blueToothLowEnergy
 * @property {module:thaliMobileNative~radioState} blueTooth
 * @property {module:thaliMobileNative~radioState} wifi
 * @property {String} bssidName - If null this value indicates that either wifiRadioOn is not 'on' or that
 * the Wi-Fi isn't currently connected to an access point. If non-null then this is the BSSID of the access point
 * that Wi-Fi is connected to.
 */

/**
 * @external "Mobile('NetworkChanged')"
 */

/**
 * This is the callback used by {@link external:"Mobile('NetworkChanged')".registerToNative}
 *
 * @public
 * @callback networkChangedCallback
 * @property {module:thaliMobileNative~NetworkChanged} networkChanged
 * @returns {null}
 */

/**
 * Any time the state of the network changes (meaning any of the values in the
 * {@link module:thaliMobileNative~NetworkChanged} object are
 * altered) any callbacks registered with this method will be called. Note that calls to this callback will start after
 * the first network changed event the first callback is registered.
 *
 * The callbacks MUST NOT be sent more frequently than every 100 ms. If multiple network changes occur during that
 * period then only the last update before the waiting period is up MUST be sent. This means that we do not guarantee
 * that all changes in the network's status will necessarily result in a networkChanged callback.
 *
 * @public
 * @function external:"Mobile('NetworkChanged')".registerToNative
 * @param {module:thaliMobileNative~networkChangedCallback} callback
 * @returns {null}
 */

/**
 * @external "Mobile('IncomingConnectionToPortNumberFailed')"
 */

/**
 * This is the callback used by {@link external:"Mobile('IncomingConnectionToPortNumberFailed')".registerToNative}
 *
 * @public
 * @callback incomingConnectionToPortNumberFailedCallback
 * @property {Number} portNumber The 127.0.0.1 port that the TCP/IP bridge tried to connect to.
 * @returns {null}
 */

/**
 * Please see the definition of {@link module:thaliMobileNativeWrapper.incomingConnectionToPortNumberFailed}.
 *
 * This event MUST NOT be sent more often than every 100 ms. This means that one cannot count the number of instances
 * of this event in order to count how many connections were missed.
 *
 * @public
 * @function external:"Mobile('IncomingConnectionToPortNumberFailed')".registerToNative
 * @param {module:thaliMobileNative~incomingConnectionToPortNumberFailedCallback} callback
 * @returns {null}
 */

