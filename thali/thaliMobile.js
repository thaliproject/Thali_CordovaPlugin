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
 * ## Concurrent and Consecutive Calls to the same API
 *
 * Unless explicitly stated otherwise in a method's definition, all methods defined here are safe to call consecutively
 * but not concurrently.
 *
 * In other words:
 *
 * ```javascript
 * Mobile('StartListeningForAdvertisements').callNative(function() {});
 * Mobile('StartListeningForAdvertisements').callNative(function() {});
 * ```
 *
 * is an error because it has two calls to `StartListeningForAdvertisements` outstanding at the same time without waiting for the
 * callback.
 *
 * For methods that do not support concurrent calls the system MUST return a "No Concurrent Calls" error that signals
 * that the Mobile system is no longer in a safe state. At this point all the calling software can do is call all
 * the various "stop" methods in order to try and reset the system to a safe state.
 *
 * Where as:
 *
 * ```javascript
 * Mobile('StartListeningForAdvertisements').callNative(function(err) {
 *   if (err) {
 *     throw err;
 *   }
 *   Mobile('StartListeningForAdvertisements').callNative(function() {});
 * });
 * ```
 *
 * is explicitly allowed because while the calls to `StartListeningForAdvertisements` are consecutive they are not
 * concurrent.
 *
 * ## Conflicting calls
 *
 * All the start and stop method pairs MUST NOT be called concurrently. If they are called concurrently then the
 * calls SHOULD result in a "No Concurrent Calls" error that
 * signals that the Mobile system is no longer in a safe state. At this point all the calling software can do is call
 * all the various "stop" methods in order to try and reset the system to a safe state.
 *
 * All other methods MAY be called concurrently.
 *
 * For example:
 *
 * ```javascript
 * Mobile('StartListeningForAdvertisements').callNative(function() {});
 * Mobile('StopListeningForAdvertisements').callNative(function() {});
 * ```
 *
 * is illegal because these are a pair. E.g. they start and stop the same thing.
 *
 * But:
 *
 * ```javascript
 * Mobile('StartListeningForAdvertisements').callNative(function() {});
 * Mobile('StartListeningForIncomingConnections').callNative(10234, function() {});
 * ```
 *
 * is fine because they are not a pair.
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
 * @public
 * @function external:"Mobile('StartListeningForAdvertisements')".callNative
 * @param {ThaliMobileCallback} callBack
 * @returns {null}
 * @throws {Error} Callback error
 */

/**
 * @external "Mobile('StopListeningForAdvertisements')"
 */

/**
 * This method instructs the native layer to stop listening for discovery advertisements.
 *
 * @public
 * @function external:"Mobile('StopListeningForAdvertisements')".callNative
 * @param {ThaliMobileCallback} callBack
 * @returns {null}
 * @throws {Error} Callback error
 */

/**
 * @external "Mobile('StartListeningForIncomingConnections')"
 */

/**
 * This method instructs the native layer to accept incoming connections over the non-TCP/IP transport and to
 * bridge those connections to TCP/IP and then connect to the submitted portNumber on 127.0.0.1.
 *
 * When another device connects to this device over the non-TCP/IP based native technology the native layer will create
 * a local TCP/IP client who will connect to 127.0.0.1 using the supplied portNumber. This will make the remote device
 * look to the local Node.js code as if it were talking over TCP/IP. But this is just a bridge from the non-TCP/IP
 * native technology to TCP/IP.
 *
 * This method MAY be called consecutively but only with the same portNumber. If it is called consecutively with a
 * different portNumber then a "Cannot change portNumber without StopListeningForIncomingConnections call first" error
 * MUST be returned.
 *
 * @public
 * @function external:"Mobile('StartListeningForIncomingConnections')".callNative
 * @param {Number} portNumber - The port on 127.0.0.1 that any incoming connections over the native non-TCP/IP transport
 * should be bridged to.
 * @param {ThaliMobileCallback} callback
 * @returns {null}
 * @throws {Error} Callback error
 */

/**
 * @external "Mobile('StopListeningForIncomingConnections')"
 */

/**
 * This method instructs the native layer to stop accepting incoming connections over the non-TCP/IP transport and to
 * terminate any existing incoming connections established over the non-TCP/IP transport.
 *
 * @public
 * @function external:"Mobile('StopListeningForIncomingConnections')".callNative
 * @param {ThaliMobileCallback} callback
 * @returns {null}
 * @throws {Error} Callback error
 */

/**
 * @external "Mobile('StartUpdateAdvertising')"
 */

/**
 * Thali currently handles discovery by announcing over the discovery channel that the Thali peer has had a
 * state change without providing any additional information, such as who the peer is or who the state changes
 * are relevant to. The remote peers, when they get the state change notification, will have to connect to this
 * peer in order to retrieve information about the state change.
 *
 * Therefor the purpose of this method is just to raise the "state changed" flag. Each time it is called a new
 * event will be generated that will tell listeners that the system has changed state since the last call. Therefore
 * this method is not idempotent since each call causes a state change.
 *
 * Once an advertisement is sent out as a result of calling this method typically any new peers who come in range
 * will be able to retrieve the existing advertisement. So this is not a one time event but rather more of a case
 * of publishing an ongoing advertisement regarding the peer's state.
 *
 * @public
 * @function external:"Mobile('StartUpdateAdvertising')".callNative
 * @param {ThaliMobileCallback} callback
 * @returns {null}
 * @throws {Error} Callback error
 */

/**
 * @external "Mobile('StopAdvertising')"
 */

/**
 * This method tells the native layer to stop advertising the presence of the peer.
 *
 * @public
 * @function external:"Mobile('StopAdvertising')".callNative
 * @param {ThaliMobileCallback} callback
 * @returns {null}
 * @throws {Error} Callback error
 */

/**
 * This is the callback used by {@link external:"Mobile('Connect')".callNative}.
 *
 * Unrecognized peer ID
 * Max connections reached
 * Connection could not be established
 *
 * @public
 * @callback ConnectCallback
 * @param {error} err - If null then the call the callback was submitted to was successful. If not null then it will be
 * an Error object that will define what went wrong.
 * @param {Number} portNumber - If err is null then portNumber will be set to the port with which the local Thali
 * application can create a 127.0.0.1 link to in order to talk to the peer identified in the
 * {@link external:"Mobile('Connect')".callNative call this callback was sent in response to.
 * @returns {null} - No response is expected.
 */

/**
 * @external "Mobile('Connect')"
 */

/**
 * This method tells the native layer to establish a non-TCP/IP connection to the identified peer and to then create
 * a TCP/IP bridge on top of that connection which can be accessed locally by opening a TCP/IP connection to the
 * port returned in the callback.
 *
 * If this method is called consecutively with the same peerIdentifier then if a connection already exists its port
 * MUST be returned otherwise a new connection MUST be created.
 *
 * The port created by a Connect call MUST only accept a single TCP/IP connection at a time. Any subsequent TCP/IP
 * connections to the 127.0.0.1 port MUST be rejected.
 *
 * It is implementation dependent if the non-TCP/IP connection that the 127.0.0.1 port will be bound to is created
 * before the callback is called or only when the port is called.
 *
 * If any of the situations listed below occur then the non-TCP/IP connection MUST be fully closed, the existing
 * connection to the 127.0.0.1 port (if any) MUST be closed and the port MUST be released:
 *
 *  - The TCP/IP connection to the 127.0.0.1 port is closed or half closed
 *  - No connection is made to the 127.0.0.1 port within a fixed period of time, typically 10 seconds
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
 * This method MAY be called concurrently. If the same peerIdentifier is used in multiple concurrent calls then
 * each MUST receive whatever port is bound to the identifier peerIdentifier.
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
 * if a true value was sent first.
 */

/**
 * This event is fired when a peer is discovered. Note that there are at least two ways in which this event can be
 * fired. One way is as a result of receiving an advertisement after a call to
 * {@link external:"Mobile('StartListeningForAdvertisements')".callNative} starts the system listening to advertising.
 *
 * However another way in which this event can be called is if, after a call to
 * {@link external:"Mobile('StartListeningForIncomingConnections')".callNative}, an incoming connection is received
 * and it is determined that the connecting peer's information hasn't previously been discovered either because of
 * a radio issue or because we are not listening for advertisements.
 *
 * @event peerAvailabilityChanged
 * @type {object}
 * @property {peer[]} peers
 */

/**
 *
 * wifi - available
 * wifi type -
 * bluetooth
 * ble
 *
 *
 * @event networkChanged
 * @type {object}
 * @property
 *
 */
