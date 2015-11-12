"use strict";

var Promise = require("lie");
var thaliMobileNativeWrapper = require("thaliMobileNativeWrapper");
var thaliWifiInfrastructure = require("thaliWifiInfrastructure");

/** @module thaliMobile */

/**
 * @file
 *
 * This is a convenience class to wrap together {@link module:thaliMobileNativeWrapper} and
 * {@link module:thaliWifiInfrastructure} in order to create a unified interface and set of events. This object assumes
 * that if it is being used then it has exclusive rights to call {@link module:thaliMobileNativeWrapper},
 * {@link module:thaliMobileNative} and {@link module:thaliWifiInfrastructure}.
 */

/*
          METHODS
 */

/**
 * This object is our generic status wrapper that lets us return information about both WiFi and Native.
 *
 * @public
 * @typedef {Object} combinedResult
 * @property {Error|Null} wifiResult
 * @property {Error|Null} nativeResult
 */

/**
 * This method MUST be called before any other method here other than registering for events on the emitter. This
 * method will call start on both the native and wifi infrastructure code. Note that in the case of wifi this
 * call really does nothing but register the router object. In the case of native however there is some setup
 * work so an error is more meaningful. If an error is received from start on either wifi or native then
 * any subsequent method calls below but stop will not attempt to interact with the failed type. And yes, if both fail
 * then essentially all the methods but stop turn into NOOPs.
 *
 * This method also instructs the system to pay attention to network events. If one or both radio types is not
 * active but a network changed event indicates that the relevant radio type is now active and if we are still in the
 * start state then this code MUST try to call start on the newly activated radio stack.
 *
 * This method is not idempotent. If called two times in a row without an intervening stop a "Call Stop!" Error MUST
 * be returned.
 *
 * This method can be called after stop since this is a singleton object.
 *
 * @public
 * @param router This is an Express Router object (for example, express-pouchdb is a router object) that the
 * caller wants non-TCP and WiFi connections to be terminated with. This code will put that router at '/' so make sure
 * your paths are set up appropriately. If stop is called then the system will take down the server so it is no longer
 * available.
 * @returns {Promise<module:thaliMobile~combinedResult>}
 */
module.exports.start = function(router) {
  return Promise.resolve();
};

/**
 * This calls stop on both stacks even if start failed.
 *
 * Once called the object is in stop state.
 *
 * This method is idempotent and so MUST be able to be called multiple times in a row without changing state.
 *
 * @public
 * @returns {Promise<module:thaliMobile~combinedResult>}
 */
module.exports.stop = function() {
  return Promise.resolve();
};

/**
 * This method calls the underlying startListeningForAdvertisements on whichever radio stack is currently in start
 * state. Note
 * that once this method is called it is giving explicit permission to this code to call this method on a radio
 * stack that is currently disabled when the method is called but is later re-enabled due to a network changed
 * event. In other words if {@module:thaliMobile.start} is called and say WiFi doesn't work. Then this method
 * is called and so advertising is only started for the non-TCP transport. Then a network changed event happens
 * indicating that WiFi is available. Since we are still in start state this code will automatically call
 * {@link module:thaliWifiInfrastructure.start} and then will call
 * {@link module:thaliWiFiInfrastructure.startListeningForAdvertisements} because we haven't yet called
 * {@link module:thaliMobile.stopListeningForAdvertisements}. If any of the calls triggered by the network event fail
 * then the results MUST be logged.
 *
 * This method is idempotent so multiple consecutive calls without an intervening call to stop will not cause a state
 * change.
 *
 * This method MUST NOT be called if the object is not in start state or a "Call Start!" error MUST be returned.
 *
 * The combinedResult MUST return an error of "Not Active" for any radio type that we did not call
 * startListeningForAdvertisements on.
 *
 * @public
 * @returns {Promise<module:thaliMobile~combinedResult>}
 */
module.exports.startListeningForAdvertisements = function() {
  return Promise.resolve();
};

/**
 * This method calls the underlying stopListeningForAdvertisements on both types regardless of which is in start
 * state.
 *
 * This method is idempotent and MAY be called even if startListeningForAdvertisements has not been called.
 *
 * @public
 * @returns {Promise<module:thaliMobile~combinedResult>}
 */
module.exports.stopListeningForAdvertisements = function() {
  return Promise.resolve();
};

/**
 * This method calls the underlying startUpdateAdvertisingAndListenForIncomingConnections on whichever radio stack is
 * currently in start state. This method has the same behavior as
 * {@link module:thaliMobile.startListeningForAdvertisements}
 * in that if a radio type that was inactive should later become available and we are in start state then we will
 * try to call start and if that works and stopUpdateAdvertisingAndListenForIncomingConnections has not been called
 * then we will try to call startUpdateAdvertisingAndListenForIncomingConnections on the newly started stack. This
 * includes the requirement to log any failed attempts to call the various methods trigged by a network status change.
 *
 * Every call to this method is meant to change the current advertising flag to indicate that new data is available.
 *
 * @public
 * @returns {Promise<module:thaliMobile~combinedResult>}
 */
module.exports.startUpdateAdvertisingAndListenForIncomingConnections = function() {
  return Promise.resolve();
};

/**
 * This method calls the underlying stopAdvertisingAndListeningForIncomingConnections on both types regardless of
 * which is in start state.
 *
 * This method is idempotent and MAY be called even if startUpateAdvertisingAndListenForIncomingConnections has not
 * been called.
 *
 * @public
 * @returns {Promise<module:thaliMobile~combinedResult>}
 */
module.exports.stopAdvertisingAndListeningForIncomingConnections = function() {
  return Promise.resolve();
};

/*
        EVENTS
 */

/**
 * If we receive a {@link module:thaliMobileNativeWrapper~nonTCPPeerAvailabilityChanged} event then all we have to do is
 * return the arguments below as taken from the event with the exception of setting hostAddress to 127.0.0.1 unless
 * the peer is not available in which case we should set both hostAddress and portNumber to null.
 *
 * If we receive a {@link module:thaliWiFiInfrastructure~wifiPeerAvailabilityChanged} event then all we have to do is
 * return the arguments below as taken from the event with the exception of setting something reasonable for the
 * suggestedTCPTimeout.
 *
 * @public
 * @event peerAvailabilityChanged
 * @type {object}
 * @property {string} peerIdentifier This is exclusively used to detect if this is a repeat announcement or if a peer
 * has gone to correlate it to the announcement of the peer's presence. But this value is not used to establish a
 * connection to the peer, the hostAddress and portNumber handle that.
 * @property {string} hostAddress The IP/DNS address to connect to or null if this is an announcement that the peer
 * is no longer available.
 * @property {number} portNumber The port to connect to on the given hostAddress or null if this is an announcement
 * that the peer is no longer available.
 * @property {number} suggestedTCPTimeout Provides a hint to what time out to put on the TCP connection. For some
 * transports a handshake can take quite a long time.
 */

thaliMobileNativeWrapper.on("nonTCPPeerAvailabilityChangedEvent", function(peer) {
  // Do stuff
});

thaliWifiInfrastructure.on("wifiPeerAvailabilityChanged", function(hostAddress, portNumber) {
  // Do stuff
});

/**
 * Fired whenever our state changes.
 *
 * @public
 * @typedef {Object} discoveryAdvertisingStatus
 * @property {boolean} discoveryActive If true indicates that our goal is to have discovery active on all available
 * radios.
 * @property {boolean} advertisingActive If true indicates that our goal is to have advertising active on all available
 * radios.
 * @property {boolean} nonTCPDiscoveryActive Indicates if discovery is active on the non-TCP transport
 * @property {boolean} nonTCPAdvertisingActive Indicates if advertising is active on the non-TCP transport
 * @property {boolean} wifiDiscoveryActive Indicates if discovery is active on WiFi
 * @property {boolean} wifiAdvertisingActive Indicates if advertising is active on WiFi
 */

/**
 * If we receive a {@link module:thaliMobileNativeWrapper~discoveryAdvertisingStateUpdateNonTcpEvent} there are a couple
 * of possibilities:
 * - This just confirms whatever command we fired, we started advertising and it is confirming that. We should only pass
 * on this event the first time it comes through. If we get multiple events with the same state and they all match our
 * current state then they should be suppressed.
 * - We thought something was started but now we are getting a notice that it is stopped. In that case we need to
 * internally record that discovery or advertising is no longer started and fire this event to update.
 * - We thought something was stopped but now we are getting a notice that they are started. This can happen because our
 * network change event code detected that a radio that was off is now on and we are trying to start things. In that
 * case we should mark the discovery or advertising as started and fire this event.
 *
 * If we receive a {@link module:thaliWiFiInfrastructure~discoveryAdvertisingStateUpdateWiFiEvent} then the logic is
 * effectively the same as above.
 *
 * A scary edge case is that we want discovery or advertising off and suddenly the spontaneously turn on. This shouldn't
 * happen (famous last words) so we'll ignore it for the moment.
 *
 * @public
 * @event discoveryAdvertisingStateUpdate
 * @type {Object}
 * @property {module:thaliMobile~discoveryAdvertisingStatus} discoveryAdvertisingStatus
 */


thaliMobileNativeWrapper.on("discoveryAdvertisingStateUpdateNonTcpEvent", function(discoveryAdvertisingStateUpdateValue) {
  // Do stuff
});

thaliWifiInfrastructure.on("discoveryAdvertisingStateUpdateWifiEvent", function(discoveryAdvertisingStateUpdateValue) {
  // Do stuff
});

/**
 * Unless something went horribly wrong only one of thaliMobileNativeWrapper or thaliWifiInfrastructure should be
 * enabled for this event at a time. We can just pass the event value alone.
 *
 * @public
 * @event networkChanged
 * @type {Object}
 * @property {module:thaliMobileNative~NetworkChanged} networkChangedValue
 */

thaliMobileNativeWrapper.on("networkChangedNonTcp", function(networkChangedValue) {
  // Do stuff
});

thaliWifiInfrastructure.on("networkChangedWifi", function(networkChangedValue) {
  // Do stuff
});

/**
 * If we receive a {@link module:thaliMobileNativeWrapper~incomingConnectionToPortNumberFailed} and we are in stop
 * state then it means that we had a race condition where someone tried to connect to the server just as we were
 * killing it. If we get this in the start state after having turned on advertising then it means that our server
 * has failed. The best we can do is try to close the server and open it again.
 */

thaliMobileNativeWrapper.on("incomingConnectionToPortNumberFailed", function(portNumber) {
  // Do stuff
});

/**
 * Use this emitter to subscribe to events
 *
 * @public
 * @fires event:peerAvailabilityChanged
 * @fires event:discoveryAdvertisingStateUpdate
 * @fires event:networkChanged
 */
module.exports.emitter = new EventEmitter();
