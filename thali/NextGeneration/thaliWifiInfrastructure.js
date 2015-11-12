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
 * This method MUST be called before any other method here other than registering for events on the emitter. This
 * method will cause us to do nothing. It's just here to mirror how {@link module:thaliMobileNativeWrapper} works.
 *
 * If the start fails then the object is not in start state.
 *
 * This method is not idempotent (even though it could be). If called two times in a row without an intervening stop a
 * "Call Stop!" Error MUST be returned.
 *
 * This method can be called after stop since this is a singleton object.
 *
 * @param {Object} router This is an Express Router object (for example, express-pouchdb is a router object) that the
 * caller wants the WiFi connections to be terminated with. This code will put that router at '/' so make sure your
 * paths are set up appropriately.
 * @returns {Promise<null|Error>}
 */
module.exports.start = function(router) {
  return Promise.resolve();
};

/**
 * This method will call all the stop methods and stop the TCP server hosting the router.
 *
 * Once called the object is in the stop state.
 *
 * This method is idempotent and so MUST be able to be called multiple timex in a row without changing state.
 *
 * @returns {Promise<null|Error>}
 */
module.exports.stop = function() {
  return Promise.resolve();
};

/**
 * This will start the local Wi-Fi Infrastructure Mode discovery mechanism (currently SSDP). Calling this method
 * will trigger {@link event:wifiPeerAvailabilityChanged} to fire. This method only causes SSDP queries to be fired
 * and cause us to listen to other service's SSDP:alive and SSDP:byebye messages. It doesn't advertise the service
 * itself.
 *
 * This method is idempotent so multiple consecutive calls without an intervening call to stop will not cause a state
 * change.
 *
 * | Error String | Description |
 * |--------------|-------------|
 * | No Wifi radio | This device doesn't support Wifi |
 * | Radio Turned Off | Wifi is turned off. |
 * | Unspecified Error with Radio infrastructure | Something went wrong trying to use WiFi. Check the logs. |
 * | Call Start! | The object is not in start state. |
 *
 * @returns {Promise<null|Error>}
 */
module.exports.startListeningForAdvertisements = function() {
  return Promise.resolve();
};

/**
 * This will stop the local Wi-Fi Infrastructure Mode discovery mechanism (currently SSDP). Calling this method will
 * stop {@link event:wifiPeerAvailabilityChanged} from firing. That is, we will not issue any further SSDP queries
 * nor will we listen for other service's SSDP:alive or SSDP:byebye messages.
 *
 * Note that this method does not affect any existing TCP connections. Not that we could really do anything with them
 * since they are handled directly by Node, not us.
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
 * __OPEN ISSUE:__ If we have a properly configured multiple AP network then all the APs will have different BSSID
 * values but identical SSID values and the device should be able to keep the same IP. In that case do we want to
 * specify that if the BSSID changes but the SSID does not then we shouldn't shut down the server?
 *
 * Each time this method is called it will cause the local advertisement to change just enough to notify other peers
 * that this peer has new data to retrieve. No details will be provided about the peer on who the changes are for.
 * All that is provided is a flag just indicating that something has changed. It is up to other peer to connect
 * and retrieve details on what has changed if they are interested.
 *
 * By design this method is intended to be called multiple times without calling stop as each call causes the
 * currently notification flag to change.
 *
 * | Error String | Description |
 * |--------------|-------------|
 * | Bad Router | router is null or otherwise wasn't accepted by Express |
 * | No Wifi radio | This device doesn't support Wifi |
 * | Radio Turned Off | Wifi is turned off. |
 * | Unspecified Error with Radio infrastructure | Something went wrong trying to use WiFi. Check the logs. |
 * | Call Start! | The object is not in start state. |
 *
 * @returns {Promise<null|Error>}
 */
module.exports.startUpdateAdvertisingAndListenForIncomingConnections = function() {
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
 * considered more of a hint than anything else. If the peer has gone (e.g. ssdp:byebye) then both hostAddress and
 * portNumber MUST be set to null.
 *
 * __Open Issue:__ There is a pretty obvious security hole here that a bad actor could advertise a bunch of IP or
 * DNS addresses of some innocent target on a local network in order to trigger a connection storm. Given the various
 * limitations in place it's unclear how effective this would really be. There are things we can to ameliorate the
 * attack including only accepting IP address that match the local network mask and also rate limiting how
 * quickly we are willing to connect to discovered peers.
 *
 * @event wifiPeerAvailabilityChanged
 * @public
 * @property {string} peerIdentifier This is the USN value
 * @property {string} hostAddress This can be either an IP address or a DNS address encoded as a string
 * @property {number} portNumber The port on the hostAddress to use to connect to the peer
 */

/**
 * For the definition of this event please see
 * {@link module:thaliMobileNativeWrapper~discoveryAdvertisingStateUpdateEvent}
 *
 * This version applies to WiFi rather than the non-TCP transport. Note that we MUST fire this event ourselves whenever
 * we call start/stop discovery/advertising. We also have to listen to
 * {@link module:thaliMobileNativeWrapper.nonTCPPeerAvailabilityChangedEvent} when we are on mobile and our own
 * networkChanged event when we are on other platforms and if WiFi is turned off then we have to switch our internal
 * state for any discovery/advertising that was started to stopped and fire this event.
 *
 * @public
 * @event discoveryAdvertisingStateUpdateWifiEvent
 * @type {object}
 * @property {module:thaliMobileNative~discoveryAdvertisingStateUpdate} discoveryAdvertisingStateUpdateValue
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
 * @event networkChangedWifi
 * @type {Object}
 * @property {module:thaliMobileNative~NetworkChanged} networkChangedValue
 *
 */

/**
 * Use this emitter to subscribe to events.
 *
 * @public
 * @fires event:wifiPeerAvailabilityChanged
 * @fires event:networkChangedWifi
 * @fires discoveryAdvertisingStateUpdateWifiEvent
 */
module.exports.emitter = new EventEmitter();
