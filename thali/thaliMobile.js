/**
 * @file This file is really just a mockup describing the available Mobile bindings that Thali provides for JXcore's
 * native call interface. The actual API calls will "just be there" since they are added to the global environment
 * via JXcore's native binding mechanism.
 *
 * The primary use of these apis is to enable us to leverage native non-TCP/IP transports like Bluetooth and
 * Multipeer Connectivity Framework and bridge them to local TCP/IP. It also provides us information from the native
 * platform such as information about network connectivity.
 *
 * Note that callbacks rather than promises are specified below because that is required by the JXcore native API.
 *
 * ## Request processing model
 *
 * All methods defined in this file with the exception of `Connect` MUST put all incoming requests from node.js into
 * a single FIFO queue. Each request MUST be processed to completion in the order received before the next request
 * is processed. The purpose of this requirement is to simplify our processing model by not having to deal with
 * parallel requests outside of `Connect` and so simplify both our production code and our test model.
 *
 * __Open Issue:__ We trivially can implement this requirement at the Node.js layer, do we want to wrap the Mobile
 * APIs in order to do this?
 *
 * ## Idempotent calls
 *
 * All stop methods are idempotent. So multiple calls will not result in a state change.
 *
 * All stop methods are always safe to call even if their start paired method has not yet been called. The default
 * start state is "stop" so calling a stop method before calling its start method pair just means to stay in the
 * stop state.
 *
 * ## Callback Errors
 *
 * All the methods require a callback argument. This argument MUST NOT be null and MUST be set to a function. If either
 * of these checks fail than an Error object MUST be thrown with a message value of "Callback not set".
 *
 * ## Initial system state
 * When a Thali app starts up and before any of the APIs defined here are called the initial state of the system MUST
 * be:
 * - No listening for discovery announcements using the native facilities
 * - No listening for incoming connections using the native facilities
 * - No advertising information using the native facilities
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
 * This method instructs the native layer to discover what other devices are within range using whatever non-TCP/IP
 * native technologies are available. When a device is discovered its information will be published as an
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
 * @throws {Error} Callback error
 * @fires networkChanged
 */

/**
 * @external "Mobile('StopListeningForAdvertisements')"
 */

/**
 * This method instructs the native layer to stop listening for discovery advertisements. Note that so long as
 * discovery isn't occurring (because, for example, the radio needed isn't on) this method will return success.
 *
 * | Error String | Description |
 * |--------------|-------------|
 * | Stop Failed | Somehow the stop method couldn't do its job. Check the logs. |
 *
 * @public
 * @function external:"Mobile('StopListeningForAdvertisements')".callNative
 * @param {ThaliMobileCallback} callBack
 * @returns {null}
 * @throws {Error} Callback error
 * @fires networkChanged
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
 * @throws {Error} Callback error
 * @fires incomingConnectionToPortNumberFailed
 */

/**
 * @external "Mobile('StopAdvertisingAndListenForIncomingConnections')"
 */

/**
 * This method tells the native layer to stop advertising the presence of the peer, stop accepting incoming
 * connections over the non-TCP/IP transport and to disconnect all existing non-TCP/IP transport connections.
 *
 * Note that so long as advertising has stopped and there are no incoming connections or the ability to accept them
 * then this method will return success. So, for example, if advertising was never started then this method will
 * return success.
 *
 * | Error String | Description |
 * |--------------|-------------|
 * | Stop Failed | Somehow the stop method couldn't do its job. Check the logs. |
 *
 * @public
 * @function external:"Mobile('StopAdvertisingAndListenForIncomingConnections')".callNative
 * @param {ThaliMobileCallback} callback
 * @returns {null}
 * @throws {Error} Callback error
 * @fires networkChanged
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
 * @throws {Error} Callback error
 */

/**
 * This object defines peerAvailabilityChanged information about a single peer.
 *
 * @typedef {Object} peer
 * @property {String} peerIdentifier An opaque value that identifies a non-TCP/IP transport handle for the discovered
 * peer. Because of how non-TCP/IP transports work it is completely possible for the same remote peer to have many
 * different peerIdentifiers assigned to them. So the only purpose of this value is to use it in a connect call.
 * @property {Boolean} peerAvailable If true this indicates that the peer is available for connectivity. If false
 * it means that the peer can no longer be connected to. A false value for a given peerIdentifier MUST only be sent
 * if a true value was sent first. Note that for too many reasons to count it's perfectly possible to never get
 * a false for peerAvailable. So one cannot depend on this flag for functionality like showing who is currently
 * around. The only way to be sure another peer is actually around is to be actively exchanging data with them.
 */

/**
 * This event is fired when a peer is discovered. Note that there are at least two ways in which this event can be
 * fired. One way is as a result of receiving an advertisement after a call to
 * {@link external:"Mobile('StartListeningForAdvertisements')".callNative} starts the system listening to advertising.
 *
 * However another way in which this event can be called is if, after a call to
 * {@link external:"Mobile('StartUpdateAdvertisingAndListenForIncomingConnections')".callNative}, an incoming connection
 * is received and it is determined that the connecting peer's information hasn't previously been discovered either
 * because of a radio issue or because we are not listening for advertisements.
 *
 * In other words, one can get peerAvailabilityChanged events when not listening for advertisements.
 *
 * __Open Issue:__ The fact that you can get peerAvailabilityChanged events even when not listening for advertisements
 * is surprising but it doesn't seem fatal. Still, do we want to prevent it? We could even do that at the node.js
 * layer (e.g. when we get the event don't forward it if we aren't listening for advertisements).
 *
 * @event peerAvailabilityChanged
 * @type {object}
 * @property {peer[]} peers
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
  /** Thali doesn't use this radio type on this platform. The radio might exist on the platform but we don't use it so
   * we don't return information on its state. */
  unused: 4
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
 * Any time the state of the network changes (meaning any of the values in the {@link NetworkChanged} object are
 * altered) a networkChanged event will be fired.
 *
 * @event networkChanged
 * @type {object}
 * @property {NetworkChanged} networkChanged
 */

/**
 * This event specifies that a non-TCP communication mechanism was used to successfully connect an incoming connection
 * from a remote peer but that when the system tried to forward the incoming data over the TCP/IP bridge to
 * the `portNumber` specified in
 * {@link external:"Mobile('StartUpdateAdvertisingAndListenForIncomingConnections')".callNative} it was not possible
 * to establish a link.
 *
 * @event incomingConnectionToPortNumberFailed
 * @type {object}
 * @property {Number} portNumber The 127.0.0.1 port that the TCP/IP bridge tried to connect to.
 */
