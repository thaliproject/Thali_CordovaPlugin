"use strict";

var Promise = require("lie");

/** @module thaliWifiInfrastructure */

/**
 * @file
 *
 * This is the interface used to manage local discover of peers over a Wi-Fi Infrastructure mode access point.
 *
 * All the methods defined in this file are asynchronous. However any time a method is called the invocation will
 * immediately return but the request will actually be put on a queue and all incoming requests will be run out of that
 * queue. This means that if one calls two start methods then the first start method will execute, call back its promise
 * and only then will the second start method start running. This restriction is in place to simplify the state model
 * and reduce testing.
 *
 * All stop methods in this file are idempotent so they can be called multiple times in a row without causing
 * a state change.
 */


/**
 * This will start the local Wi-Fi Infrastructure Mode discovery mechanism (currently SSDP). Calling this method
 * will trigger {@link event:wifiPeerAvailabilityChanged} to fire.
 *
 * This method is idempotent so multiple consecutive calls without an intervening call to stop will not cause a state
 * change.
 *
 * | Error String | Description |
 * |--------------|-------------|
 * | No Wifi radio | This device doesn't support Wifi |
 * | Radio Turned Off | Wifi is turned off. |
 * | Unspecified Error with Radio infrastructure | Something went wrong trying to use WiFi. Check the logs. |
 *
 * @returns {Promise<null|Error>}
 */
module.exports.startListeningForAdvertisements = function() {
  return Promise.resolve();
};

/**
 * This will stop the local Wi-Fi Infrasructure Mode discovery mechanism (currently SSDP). Calling this method will
 * stop {@link event:wifiPeerAvailabilityChanged} from firing.
 *
 * | Error String | Description |
 * |--------------|-------------|
 * | Failed | Somehow the stop method couldn't do its job. Check the logs. |
 *
 * @returns {Promise<null|Error>}
 */
module.exports.stopListeningForAdvertisements = function() {
  return Promise.resolve();
};

/**
 * This method will start advertising the peer's presence over the local Wi-Fi Infrastructure Mode discovery
 * mechanism (currently SSDP). This method will also cause the Express app passed in to be hosted in a HTTP
 * server configured with the device's local IP. If the device switches access points (e.g. the BSSID changes) or
 * if WiFi is lost then the server will be shut down. It is up to the caller to catch the networkChanged event
 * and to call start again.
 *
 * Each time this method is called it will cause the local advertisement to change just enough to notify other peers
 * that this peer has new data to retrieve. No details will be provided about the peer on who the changes are for.
 * All that is provided is a flag just indicating that something has changed. It is up to other peer to connect
 * and retrieve details on what has changed if they are interested.
 *
 * By design this method is intended to be called multiple times without calling stop as each call causes the
 * currently notification flag to change. But this method MUST NOT be called with a different app than
 * previous calls unless there was an intervening call to stop. This restriction is just to reduce our test matrix and
 * because it does not interfere with any of our current supported scenarios. If this method is called consecutively
 * without an intervening stop using different portNumbers then the callback MUST return a "No Changing app
 * without a stop" error.
 *
 * | Error String | Description |
 * |--------------|-------------|
 * | Bad Router | router is null or otherwise wasn't accepted by Express |
 * | No Changing router without a stop | See previous paragraph. |
 * | No Wifi radio | This device doesn't support Wifi |
 * | Radio Turned Off | Wifi is turned off. |
 * | Unspecified Error with Radio infrastructure | Something went wrong trying to use WiFi. Check the logs. |
 *
 * @param {Object} router This is an Express Router object (for example, express-pouchdb is a router object) that the
 * caller wants to advertise over Wi-Fi. The system will start a new server instance with this router at '/' so make
 * sure your paths are set appropriately. The server will be hosted on an external address using whatever port is
 * available. The selected port will be returned in the promise.
 * @returns {Promise<number|Error>} If successful then the promise will return the portNumber where the router object
 * has been attached on the external address. If failed then an Error object with one of the above strings will be
 * returned.
 */
module.exports.startUpdateAdvertisingAndListenForIncomingConnections = function(router) {
  return Promise.resolve();
};

/**
 * This method MUST stop advertising the peer's presence over the local Wi-Fi Infrastructure Mode discovery mechanism
 * (currently SSDP). This method MUST also stop the HTTP server started by the start method.
 *
 * So long as the device isn't advertising the peer and the server is stopped (even if the system was always in that
 * state) then this method MUST succeed.
 *
 * | Error String | Description |
 * |--------------|-------------|
 * | Failed | Somehow the stop method couldn't do its job. Check the logs. |
 *
 * @returns {Promise<null|Error>}
 */
module.exports.stopAdvertisingAndListeningForIncomingConnections = function() {
  return Promise.resolve();
};

/**
 * This event specifies that a peer was discovered over Wi-Fi Infrastructure. Please keep in mind that IP
 * address bindings can change randomly amongst peers and of course peers can disappear. So this should be
 * considered more of a hint than anything else.
 *
 * @event wifiPeerAvailabilityChanged
 * @public
 * @property {string} hostAddress This can be either an IP address or a DNS address encoded as a string
 * @property {number} portNumber The port on the hostAddress to use to connect to the peer
 */

/**
 * For the definition of this event please see
 * {@link module:thaliMobileNativeWrapper~discoveryAdvertisingStateUpdateEvent}.
 *
 * The WiFi layer MUST NOT emit this event unless we are running on Linux, OS/X or Windows. In the case that we are
 * running on those platforms then If we are running on those platforms then blueToothLowEnergy and blueTooth MUST
 * both return radioState set to `doNotCare`. Also note that these platforms don't generally support a push based
 * way to detect WiFi state (at least not without writing native code). So for now we can use polling and something
 * like [network-scanner](https://www.npmjs.com/package/network-scanner) to give us some sense of the system's state.
 *
 * @public
 * @event networkChanged
 * @type {Object}
 * @property {module:thaliMobileNative~NetworkChanged} networkChangedValue
 *
 */

/**
 * For the definition of this event please see
 * {@link module:thaliMobileNativeWrapper~discoveryAdvertisingStateUpdateEvent}
 *
 * This version applies to WiFi rather than the non-TCP transport.
 *
 * @public
 * @event discoveryAdvertisingStateUpdateWifiEvent
 * @type {object}
 * @property {module:thaliMobileNative~discoveryAdvertisingStateUpdate} discoveryAdvertisingStateUpdateValue
 */

/**
 * Use this emitter to subscribe to events.
 *
 * @public
 * @fires event:wifiPeerAvailabilityChanged
 * @fires event:networkChanged
 * @fires discoveryAdvertisingStateUpdateWifiEvent
 */
module.exports.emitter = new EventEmitter();
