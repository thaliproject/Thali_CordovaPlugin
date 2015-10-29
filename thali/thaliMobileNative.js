"use strict";

/** @module thaliMobileNative */

/*
      callNative methods
 */

/**
 * @file This file is really just a mockup describing the available Mobile bindings that Thali provides for JXcore's
 * native call interface. The actual API calls will "just be there" since they are added to the global environment
 * via JXcore's native binding mechanism. It is expected that these methods will not be called directly but rather
 * will be called via the {@link module:thaliMobile} wrappers.
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
 * This method instructs the native layer to discover what other devices are within range using the platforms P2P
 * capabilities. When a device is discovered its information will be published as an
 * {@link event:peerAvailabilityChanged}.
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
 * @function external:"Mobile('StartListeningForAdvertisements')".callNative
 * @param {ThaliMobileCallback} callBack
 * @returns {null}
 */

/**
 * @external "Mobile('StopListeningForAdvertisements')"
 */

/**
 * This method instructs the native layer to stop listening for discovery advertisements. Note that so long as
 * discovery isn't occurring (because, for example, the radio needed isn't on) this method will return success.
 *
 * This method MUST NOT terminate any existing connections created locally using
 * {@link external:"Mobile('Connect')".callNative}.
 *
 * | Error String | Description |
 * |--------------|-------------|
 * | Failed | Somehow the stop method couldn't do its job. Check the logs. |
 *
 * @public
 * @function external:"Mobile('StopListeningForAdvertisements')".callNative
 * @param {ThaliMobileCallback} callBack
 * @returns {null}
 */

/**
 * @external "Mobile('StartUpdateAdvertisingAndListenForIncomingConnections')"
 */

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
 * previous calls unless there was an intervene call to stop. This restriction is just to reduce our test matrix and
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
 * @function external:"Mobile('StartUpdateAdvertisingAndListenForIncomingConnections')".callNative
 * @param {Number} portNumber - The port on 127.0.0.1 that any incoming connections over the native non-TCP/IP transport
 * should be bridged to.
 * @param {ThaliMobileCallback} callback
 * @returns {null}
 */

/**
 * @external "Mobile('StopAdvertisingAndListenForIncomingConnections')"
 */

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
 * @function external:"Mobile('StopAdvertisingAndListenForIncomingConnections')".callNative
 * @param {ThaliMobileCallback} callback
 * @returns {null}
 */

/**
 * This is the callback used by {@link external:"Mobile('Connect')".callNative}.
 *
 * @public
 * @callback ConnectCallback
 * @param {error} err - If null then the call the callback was submitted to was successful. If not null then it will be
 * an Error object that will define what went wrong.
 * @param {Number} portNumber - If err is null then portNumber will be set to the port with which the local Thali
 * application can create a 127.0.0.1 link to in order to talk to the peer identified in the
 * {@link external:"Mobile('Connect')".callNative} call this callback was sent in response to.
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
 * This method MUST return an error if called while
 * {@link external:"Mobile('StartListeningForAdvertisements')".callNative} is not active.
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
 * @param {ConnectCallback} callback - Returns an error or the 127.0.0.1 port to connect to in order to get a connection
 * to the remote peer
 * @returns {null}
 */

/**
 * @external "Mobile('KillConnections')"
 * @private
 */

/**
 * WARNING: This method is intended for internal Thali testing only. DO NOT USE!
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
 * @function external:"Mobile('KillConnections')".callNative
 * @param {ThaliMobileCallback} callback
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
 * @property {peer[]} peers
 * @returns {null}
 */

/**
 * The callback registered with this method will be called whenever information is discovered about a local peer
 * using the native non-TCP/IP infrastructure.
 *
 * The callback can be called as a result of two methods being called, either
 * {@link external:"Mobile('StartListeningForAdvertisements')".callNative} or
 * {@link external:"Mobile('StartUpdateAdvertisingAndListenForIncomingConnections')".callNative}. The former because
 * that is what it exists for, to discover peers, and the later because of a feature we support on some platforms
 * where we can fail to discover a peer over the normal peer discovery mechanism but they might find us and then
 * connect causing us to then discover them.
 *
 * The registered callback MUST NOT be called if both listening for advertisements and advertising are stopped.
 *
 * The native layer will make no attempt to filter out peerAvailabilityChanged callbacks. This means it is possible to
 * receive multiple announcements about the same peer in the same state.
 *
 * The native layer MUST NOT send peerAvailabilityChanged callbacks more frequently than every 200 ms. This is to
 * prevent starving out the node.js main thread. Therefore updates that become available before the next transmission
 * MUST be queued up in the native layer and then sent at once to node.js using the array capability of
 * peerAvailabilityChanged.
 *
 * @public
 * @function external:"Mobile('PeerAvailabilityChanged')".registerToNative
 * @param {peerAvailabilityChangedCallback} callback
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
  on: 1,
  /** The radio exists on the device but is turned off. */
  off: 2,
  /** The radio exists on the device and is on but for some reason the system won't let us use it. */
  unavailable: 3,
  /** We depend on this radio type for this platform type but it doesn't appear to exist on this device. */
  notHere: 4,
  /** Thali doesn't use this radio type on this platform and so makes no effort to determine its state. */
  doNotCare: 5
};

/**
 * This object defines the current state of the network
 *
 * @typedef {Object} NetworkChanged
 * @property {radioState} blueToothLowEnergy
 * @property {radioState} blueTooth
 * @property {radioState} wifi
 * @property {String} bssidName - If null this value indicates that either wifiRadioOn is not 'on' or that
 * the Wi-Fi isn't currently connected to an access point. If non-null then this is the BSSID of the access point
 * that Wi-Fi is connected to.
 * @property {Boolean} discoveryActive - True if discovery is running otherwise false. Note that this value can
 * change as a result of calling start and stop but also due to the user or other apps altering the system's
 * radio state.
 * @property {Boolean} advertisingActive - True if advertising is running otherwise false. Note that this value can
 * change as a result of calling start and stop but also due to the user or other apps altering the system's
 * radio state.
 */

/**
 * @external "Mobile('NetworkChanged')"
 */

/**
 * This is the callback used by {@link external:"Mobile('NetworkChanged')".registerToNative}
 *
 * @public
 * @callback networkChangedCallback
 * @property {NetworkChanged} networkChanged
 * @returns {null}
 */

/**
 * Any time the state of the network changes (meaning any of the values in the {@link NetworkChanged} object are
 * altered) any callbacks registered with this method will be called. Note that calls to this callback will start after
 * the first network changed event the first callback is registered.
 *
 * The callbacks MUST NOT be sent more frequently than every 100 ms. If multiple network changes occur during that period
 * then only the last update before the waiting period is up MUST be sent. This means that we do not guarantee that
 * all changes in the network's status will necessarily result in a networkChanged callback.
 *
 * @public
 * @function external:"Mobile('NetworkChanged')".registerToNative
 * @param {networkChangedCallback} callback
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
 * This event specifies that a non-TCP communication mechanism was used to successfully connect an incoming connection
 * from a remote peer but the system could not complete a TCP/IP handshake with the `portNumber` on 127.0.0.1 specified
 * in {@link external:"Mobile('StartUpdateAdvertisingAndListenForIncomingConnections')".callNative}.
 *
 * This event MUST NOT be sent more often than every 100 ms. This means that one cannot count the number of instances
 * of this event in order to count how many connections were missed.
 *
 * @public
 * @function external:"Mobile('IncomingConnectionToPortNumberFailed')".registerToNative
 * @param {incomingConnectionToPortNumberFailedCallback} callback
 * @returns {null}
 */

