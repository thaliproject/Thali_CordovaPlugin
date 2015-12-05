'use strict';

var Promise = require('lie');
var thaliMobileNativeWrapper = require('thaliMobileNativeWrapper');
var thaliWifiInfrastructure = require('ThaliWifiInfrastructure')();
var EventEmitter = require('events');

/** @module thaliMobile */

/**
 * @file
 *
 * This is a convenience class to wrap together {@link
 * module:thaliMobileNativeWrapper} and {@link module:ThaliWifiInfrastructure}
 * in order to create a unified interface and set of events. This object assumes
 * that if it is being used then it has exclusive rights to call {@link
 * module:thaliMobileNativeWrapper}, {@link module:thaliMobileNative} and {@link
 * module:ThaliWifiInfrastructure}.
 */

/*
          METHODS
 */

/**
 * This object is our generic status wrapper that lets us return information
 * about both WiFi and Native.
 *
 * @public
 * @typedef {Object} combinedResult
 * @property {?Error} wifiResult
 * @property {?Error} nativeResult
 */

/**
 * This method MUST be called before any other method here other than
 * registering for events on the emitter. This method will call start on both
 * the {@link module:thaliMobileNativeWrapper} singleton and on an instance of
 * {@link module:ThaliWifiInfrastructure} class. Note that in the case of wifi
 * this call really does nothing but register the router object. In the case of
 * native however there is some setup work so an error is more meaningful. If an
 * error is received from start on either wifi or native then any subsequent
 * method calls below but stop will not attempt to interact with the failed
 * type. And yes, if both fail then essentially all the methods but stop turn
 * into NOOPs.
 *
 * This method also instructs the system to pay attention to network events.
 * If one or both radio types is not active but a network changed event
 * indicates that the relevant radio type is now active and if we are still in
 * the start state then this code MUST try to call start on the newly activated
 * radio stack. At that point if the object is in the start state for discovery
 * or advertising then we MUST also try to call the relevant start methods there
 * as well.
 *
 * This method is not idempotent. If called two times in a row without an
 * intervening stop a "Call Stop!" Error MUST be returned.
 *
 * This method can be called after stop since this is a singleton object.
 *
 * @public
 * @param {Object} router This is an Express Router object (for example,
 * express-pouchdb is a router object) that the caller wants non-TCP and WiFi
 * connections to be terminated with. This code will put that router at '/' so
 * make sure your paths are set up appropriately. If stop is called then the
 * system will take down the server so it is no longer available.
 * @returns {Promise<module:thaliMobile~combinedResult>}
 */
// jscs:disable disallowUnusedParams
module.exports.start = function (router) {
  // jscs:enable disallowUnusedParams
  return Promise.resolve();
};

/**
 * This calls stop on both stacks even if start failed.
 *
 * Once called the object is in stop state.
 *
 * This method is idempotent and so MUST be able to be called multiple times
 * in a row without changing state.
 *
 * @public
 * @returns {Promise<module:thaliMobile~combinedResult>}
 */
module.exports.stop = function () {
  return Promise.resolve();
};

/**
 * This method calls the underlying startListeningForAdvertisements on
 * whichever radio stack is currently in start state. Note that once this method
 * is called it is giving explicit permission to this code to call this method
 * on a radio stack that is currently disabled when the method is called but is
 * later re-enabled due to a network changed event. In other words if {@link
// jscs:disable jsDoc
 * module:thaliMobile.start} is called and say WiFi doesn't work. Then this
// jscs:enable jsDoc
 * method is called and so advertising is only started for the non-TCP
 * transport. Then a network changed event happens indicating that WiFi is
 * available. Since we are still in start state this code will automatically
 * call {@link module:ThaliWifiInfrastructure~ThaliWifiInfrastructure#start} and
 * then will call {@link
 * module:ThaliWifiInfrastructure.startListeningForAdvertisements} because we
 * haven't yet called {@link module:thaliMobile.stopListeningForAdvertisements}.
 * If any of the calls triggered by the network event fail then the results MUST
 * be logged.
 *
 * This method is idempotent so multiple consecutive calls without an
 * intervening call to stop will not cause a state change.
 *
 * This method MUST NOT be called if the object is not in start state or a
 * "Call Start!" error MUST be returned.
 *
 * The combinedResult MUST return an error of "Not Active" for any radio type
 * that we did not call startListeningForAdvertisements on.
 *
 * @public
 * @returns {Promise<module:thaliMobile~combinedResult>}
 */
module.exports.startListeningForAdvertisements = function () {
  return Promise.resolve();
};

/**
 * This method calls the underlying stopListeningForAdvertisements on both
 * types regardless of which is in start state.
 *
 * This method is idempotent and MAY be called even if
 * startListeningForAdvertisements has not been called.
 *
 * @public
 * @returns {Promise<module:thaliMobile~combinedResult>}
 */
module.exports.stopListeningForAdvertisements = function () {
  return Promise.resolve();
};

/**
 * This method calls the underlying
 * startUpdateAdvertisingAndListenForIncomingConnections on whichever radio
 * stack is currently in start state. This method has the same behavior as
 * {@link module:thaliMobile.startListeningForAdvertisements} in that if a radio
 * type that was inactive should later become available and we are in start
 * state then we will try to call start and if that works and
 * stopUpdateAdvertisingAndListenForIncomingConnections has not been called then
 * we will try to call startUpdateAdvertisingAndListenForIncomingConnections on
 * the newly started stack. This includes the requirement to log any failed
 * attempts to call the various methods triggered by a network status change.
 *
 * Every call to this method is meant to change the current advertising flag
 * to indicate that new data is available.
 *
 * @public
 * @returns {Promise<module:thaliMobile~combinedResult>}
 */
module.exports.startUpdateAdvertisingAndListenForIncomingConnections =
    function () {
  return Promise.resolve();
};

/**
 * This method calls the underlying
 * stopAdvertisingAndListeningForIncomingConnections on both types regardless of
 * which is in start state.
 *
 * This method is idempotent and MAY be called even if
 * startUpateAdvertisingAndListenForIncomingConnections has not been called.
 *
 * @public
 * @returns {Promise<module:thaliMobile~combinedResult>}
 */
module.exports.stopAdvertisingAndListeningForIncomingConnections = function () {
  return Promise.resolve();
};

/*
        EVENTS
 */


/**
 * Enum to define the types of connections
 *
 * @readonly
 * @enum {string}
 */
module.exports.connectionTypes = {
  MULTI_PEER_CONNECTIVITY_FRAMEWORK: 'MPCF',
  BLUE_TOOTH: 'AndroidBlueTooth',
  TCP_NATIVE: 'tcp'
};


/**
 * It is the job of this module to provide the most reliable guesses (and that
 * is what they are) as to when a peer is and is not available. The module MUST
 * err on the side of saying that a peer is available over saying they are not
 * available.
 *
 * The module MUST guarantee to its listeners (unlike {@link
 * module:thaliMobileNative}) that once it has fired a peerAvailabilityChanged
 * event for a specific peerIdentifier + connectionType combination that it will
 * not fire another peerAvailabilityChanged event for that peerIdentifier +
 * connectionType combination unless the combination has a new hostAddress or
 * portNumber.
 *
 * Note that this code explicitly does not do any kind of duplicate detection
 * for the same peerIdentifier across different connectionTypes. This is because
 * we want to surface to the caller all the ways a particular peer is available.
 *
 * This means that if this code receives multiple redundant notifications from
 * the various sources it is listening to about the same peerIdentifier and
 * connectionType combination then it must silently discard the duplicates.
 *
 * ## Android + BLE + Bluetooth
 *
 * When dealing with announcing that a peer has disappeared it is up to this
 * code to apply relevant heuristics. For example, in the case of Android it is
 * possible for a Thali app to go into the background. When this happens we
 * lower the power of the BLE status announcements but we don't change the
 * Bluetooth power. This means that a peer can seem to disappear when in fact
 * they are still in range of Bluetooth. This behavior is necessary to preserve
 * battery. This complicates things because the Android BLE stack never actually
 * says a peer is gone. Rather it sends a steady stream of announcements that
 * the peer is available and then stops when it doesn't see the peer anymore. So
 * this code has to notice those announcements and decide at what point after
 * they have stopped to declare the peer gone. In general we should experiment
 * with values like 30 seconds before deciding that a peer is gone. But why not
 * even longer?
 *
 * __Open Issue:__ How long should we wait after we don't hear any updates on
 * a peer being available over Android before we declare them gone?
 *
 * __Open Issue:__ A really obvious optimization would be to hook this code
 * into the {@link module:TCPServersManager} so it could see if we have a
 * Bluetooth or MPCF connection running with a particular peer. If we do then
 * obviously we wouldn't want to declare them gone even if we don't see them on
 * BLE or if MPCF told us they were gone.
 *
 * ## iOS + MPCF
 *
 * In the case of the MPCF the native layer has an explicit lostPeer message.
 * But we aren't completely sure if it's totally reliable. So we either can
 * immediately declare the peer gone when we get lostPeer or we can take note of
 * the lostPeer message and then wait a bit before declaring the peer gone. Note
 * that we would only see this at the Node.js layer via a {@link
 * module:thaliMobileNativeWrapper~nonTCPPeerAvailabilityChanged} event.
 *
 * __Open Issue:__ How does MPCF deal with peers who have gone out of range?
 * Do they regularly send foundPeer messages or do they send one foundPeer
 * message and go quiet until they send a lostPeer message after a bit?
 *
 * __Open Issue:__ How reliable is the lostPeer message from MPCF? I believe
 * we have had a suspicion that even if we get a lostPeer we might still be able
 * to open a connection to that peer successfully (this would make sense if
 * discovery is over Bluetooth and data transfer over Wifi). But we need to now
 * make this concrete since we have to decide if we are going to put this
 * suspicion into our code.
 *
 * ## Wifi
 *
 * In the case of Wifi SSDP supports sending both announcements of
 * availability as well as announcements that one is going off line. If we
 * receive an announcement that a peer is going away then we can trust that
 * since it means the peer is deactivating its SSDP stack. But we can't rely on
 * receiving such an announcement since obviously if a peer just walks away
 * nothing will be said. So we MUST set a timer after receiving a SSDP
 * announcement for a peer (we will receive this via a {@link
 * module:ThaliWifiInfrastructure~wifiPeerAvailabilityChanged} event) and if we
 * don't hear an announcement that they are gone then we MUST automatically
 * generate such an announcement ourselves.
 *
 * ## General guidelines on handling nonTCPPeerAvailabilityChanged and
 * wifiPeerAvailabilityChanged events
 *
 * If we receive a {@link
 * module:thaliMobileNativeWrapper~nonTCPPeerAvailabilityChanged} event then all
 * we have to do is return the arguments below as taken from the event with the
 * exception of setting hostAddress to 127.0.0.1 unless the peer is not
 * available in which case we should set both hostAddress and portNumber to
 * null.
 *
 * If we receive a {@link
 * module:ThaliWifiInfrastructure~wifiPeerAvailabilityChanged} event then all we
 * have to do is return the arguments below as taken from the event with the
 * exception of setting something reasonable for the suggestedTCPTimeout.
 *
 * @public
 * @event module:thaliMobile.event:peerAvailabilityChanged
 * @type {Object}
 * @property {string} peerIdentifier This is exclusively used to detect if
 * this is a repeat announcement or if a peer has gone to correlate it to the
 * announcement of the peer's presence. But this value is not used to establish
 * a connection to the peer, the hostAddress and portNumber handle that.
 * @property {string} hostAddress The IP/DNS address to connect to or null if
 * this is an announcement that the peer is no longer available.
 * @property {number} portNumber The port to connect to on the given
 * hostAddress or null if this is an announcement that the peer is no longer
 * available.
 * @property {number} suggestedTCPTimeout Provides a hint to what time out to
 * put on the TCP connection. For some transports a handshake can take quite a
 * long time.
 * @property {connectionTypes} connectionType Defines the kind of connection
 * that the request will eventually go over. This information is needed so that
 * we can better manage how we use the different transport types available to
 * us.
 */

// jscs:disable disallowUnusedParams
thaliMobileNativeWrapper.on('nonTCPPeerAvailabilityChangedEvent',
    function (peer)
    {
      // jscs:enable disallowUnusedParams
      // Do stuff
    });

thaliWifiInfrastructure.on('wifiPeerAvailabilityChanged',
// jscs:disable disallowUnusedParams
    function (hostAddress, portNumber) {
  // jscs:enable disallowUnusedParams
  // Do stuff
});

/**
 * Fired whenever our state changes.
 *
 * @public
 * @typedef {Object} discoveryAdvertisingStatus
 * @property {boolean} discoveryActive If true indicates that our goal is to
 * have discovery active on all available radios.
 * @property {boolean} advertisingActive If true indicates that our goal is to
 * have advertising active on all available radios.
 * @property {boolean} nonTCPDiscoveryActive Indicates if discovery is active
 * on the non-TCP transport
 * @property {boolean} nonTCPAdvertisingActive Indicates if advertising is
 * active on the non-TCP transport
 * @property {boolean} wifiDiscoveryActive Indicates if discovery is active on
 * WiFi
 * @property {boolean} wifiAdvertisingActive Indicates if advertising is
 * active on WiFi
 */

/**
 * If we receive a {@link
 * module:thaliMobileNativeWrapper~discoveryAdvertisingStateUpdateNonTCPEvent}
 * there are a couple of possibilities:
 * - This just confirms whatever command we fired, we started advertising and
 * it is confirming that. We should only pass on this event the first time it
 * comes through. If we get multiple events with the same state and they all
 * match our current state then they should be suppressed.
 * - We thought something was started but now we are getting a notice that it
 * is stopped. In that case we need to internally record that discovery or
 * advertising is no longer started and fire this event to update.
 * - We thought something was stopped but now we are getting a notice that
 * they are started. This can happen because our network change event code
 * detected that a radio that was off is now on and we are trying to start
 * things. In that case we should mark the discovery or advertising as started
 * and fire this event.
 *
 * If we receive a {@link
 * module:ThaliWifiInfrastructure~discoveryAdvertisingStateUpdateWiFiEvent} then
 * the logic is effectively the same as above.
 *
 * A scary edge case is that we want discovery or advertising off and suddenly
 * the spontaneously turn on. This shouldn't happen (famous last words) so we'll
 * ignore it for the moment.
 *
 * @public
 * @event module:thaliMobile.event:discoveryAdvertisingStateUpdate
 * @type {Object}
 * @property {module:thaliMobile~discoveryAdvertisingStatus}
 * discoveryAdvertisingStatus
 */


thaliMobileNativeWrapper.on('discoveryAdvertisingStateUpdateNonTCPEvent',
// jscs:disable disallowUnusedParams
    function (discoveryAdvertisingStateUpdateValue) {
  // jscs:enable disallowUnusedParams
  // Do stuff
});

thaliWifiInfrastructure.on('discoveryAdvertisingStateUpdateWifiEvent',
// jscs:disable disallowUnusedParams
    function (discoveryAdvertisingStateUpdateValue) {
  // jscs:enable disallowUnusedParams
  // Do stuff
});

/**
 * Unless something went horribly wrong only one of thaliMobileNativeWrapper
 * or ThaliWifiInfrastructure should be enabled for this event at a time. We can
 * just pass the event value alone.
 *
 * @public
 * @event module:thaliMobile.event:networkChanged
 * @type {Object}
 * @property {module:thaliMobileNative~NetworkChanged} networkChangedValue
 */

thaliMobileNativeWrapper.on('networkChangedNonTCP',
// jscs:disable disallowUnusedParams
    function (networkChangedValue) {
  // jscs:enable disallowUnusedParams
  // Do stuff
});

thaliWifiInfrastructure.on('networkChangedWifi',
// jscs:disable disallowUnusedParams
    function (networkChangedValue) {
  // jscs:enable disallowUnusedParams
  // Do stuff
});

/**
 * If we receive a {@link
 * module:thaliMobileNativeWrapper~incomingConnectionToPortNumberFailed} and we
 * are in stop state then it means that we had a race condition where someone
 * tried to connect to the server just as we were killing it. If we get this in
 * the start state after having turned on advertising then it means that our
 * server has failed. The best we can do is try to close the server and open it
 * again.
 */
thaliMobileNativeWrapper.on('incomingConnectionToPortNumberFailed',
// jscs:disable disallowUnusedParams
    function (portNumber) {
  // jscs:enable disallowUnusedParams
  // Do stuff
});

/**
 * Use this emitter to subscribe to events
 *
 * @public
 * @fires module:thaliMobile.event:peerAvailabilityChanged
 * @fires module:thaliMobile.event:discoveryAdvertisingStateUpdate
 * @fires module:thaliMobile.event:networkChanged
 */
module.exports.emitter = new EventEmitter();
