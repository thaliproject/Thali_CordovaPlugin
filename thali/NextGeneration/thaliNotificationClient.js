'use strict';

var EventEmitter = require('events');

/** @module thaliNotificationClient */

/**
 * Creates a class that can register to receive the {@link
 * module:thaliMobile.event:peerAvailabilityChanged} event. It will listen for
 * the event and upon receiving it will enqueue an action with the
 * submitted thaliPeerPool. Once called back by the pool then the callback will
 * issue a HTTP GET request to retrieve the notification beacons for the peer,
 * parse them, see if one matches and if so then fire a {@link
 * module:thaliNotificationClient.event:peerAdvertisesDataForUs}. Callers can
 * listen for the event by using the emitter member.
 *
 * @public
 * @constructor
 * @param {module:thaliPeerPoolInterface~ThaliPeerPoolInterface} thaliPeerPool
 * Requests to retrieve notification beacons are enqueued on this object in
 * order to make sure we don't overwhelm our bandwidth or native communication
 * capabilities.
 * @param {Crypto.ECDH} ecdhForLocalDevice A Crypto.ECDH object initialized
 * with the local device's public and private keys.
 * @param {addressBookCallback} addressBookCallback An object used to validate
 * which peers we are interested in talking to.
 */
// jscs:disable disallowUnusedParams
function ThaliNotificationClient(thaliPeerPool, ecdhForLocalDevice,
                                 addressBookCallback) {
  // jscs:enable disallowUnusedParams
}


/**
 * This method will cause a listener to be registered on the global singleton
 * {@link module:thaliMobile} object for the {@link
 * module:thaliMobile~peerAvailabilityChanged} event.
 *
 * This method MUST be idempotent so calling it twice in a row MUST NOT cause
 * multiple listeners to be registered with thaliMobile.
 *
 * ## Handling peerAvailabilityChanged events with hostAddress != null
 *
 * If a peerAvailabilityChanged event with hostAddress != null is received
 * with a peerIdentifier we have not made a note about (see the rest of this
 * paragraph) then the code MUST call enqueue on the thaliPeerPool object with
 * the peerIdentifier and connectionType submitted in the event. The actionType
 * MUST be set to {@link
 * module:thaliNotificationClient~ThaliNotificationClient.ActionType}. The
 * {@link module:ThaliPeerPoolInterface~EnqueueCallback} MUST
 *
 *
 * issue a HTTP GET
 * request to http://[hostAddress]:[portNumber]/NotificationBeacons. Make sure
 * to set the TCP/IP timeout using suggestedTCPTimeout. If the address
 * resolution fails or the connection is lost before the request/response pair
 * can be successfully exchanged then we MUST retry at least 3 times, waiting
 * 500 ms between each retry before giving up. If a non-200 HTTP response is
 * received then the client MUST immediately give up and not retry. If a 200
 * response is received then the beacon MUST be processed as given below.
 *
 * Anytime a HTTP request to a specific peerIdentifier is outstanding as
 * well as during the waiting period between retries a note MUST be made of
 * the peerIdentifier. Once the retries are exhausted or a response is
 * received then the note MUST be removed. If a 200 response is received then
 * the peerIdentifier MUST be recorded per the limits given below.
 *
 * If a peerAvailabilityChanged event is received with a peerIdentifier
 * value that we have a note about per the previous paragraph (e.g. we are
 * making a HTTP request to it, waiting for a retry period before making
 * another request or we have successfully communicated with it) then we MUST
 * ignore the event and do nothing.
 *
 * ## Handling peerAvailabilityChanged events with hostAddress == null
 *
 * If a peerAvailabilityChanged event with hostAddress == null is received
 * then we MUST ignore it. The reason is that discovery can sometimes be wrong
 * and a peer may still be around who we think isn't so retries (if that is
 * the state we are in) still make sense. Otherwise the absence of the peer is
 * no big deal since at worst we are remembering a peerIdentifier we might not
 * need to remember but we'll eventually garbage collect it and anyway
 * remembering the peerIdentifier for longer is a feature since the peer might
 * actually still be around or could come back.
 *
 * ## Processing beacons
 *
 * When we get beacon response we MUST submit the beacon stream along
 * ecdhForLocalDevice and addressBookCallback to the {@link
  * module:thaliNotificationBeacons.parseBeacons} method on an instance of
 * {@link module:thaliNotificationBeacons} that we have created locally. If we
 * get back null then we take no additional action (although we still need to
 * remember the peerIdentifier per the previously specified behavior).
 *
 * If we get a proper {@link
  * module:thaliNotificationBeacons.ParseBeaconsResponse} then we MUST issue an
 * {@event peerAdvertisesDataForUs} filling it in using the data from the
 * ParseBeaconsResponse as well as from the original peerAvailabilityChanged
 * event.
 *
 * ## Rate Limiters
 *
 *   * Limit how many simultaneous HTTP request we have outstanding Limit how
 * many queued discoveries we have Limit how big the successful peerIdentifier
 * cache can get
 *
 * @public
 */
ThaliNotificationClient.prototype.addListener = function () {

};

/**
 * Will remove the listener registered on the global thaliMobile object, if
 * any. This method MUST be idempotent so calling it multiple times MUST only
 * cause a single call to removeListener on thaliMobile and only then if there
 * already was a call to addListener on this object.
 *
 * Note that removing the listener will not affect any actions that have already
 * been registered with the submitted peer pool. They will execute whenever
 * they are picked by the peer pool to run.
 *
 * @public
 */
ThaliNotificationClient.prototype.removeListener = function () {

};

/**
 * Use to subscribe for discovery events.
 *
 * @public
 * @fires module:thaliNotificationClient.event:peerAdvertisesDataForUs
 */
ThaliNotificationClient.prototype.emitter = new EventEmitter();

/**
 * This is the action type that will be used by instances of this class when
 * registering with {@link
 * module:thaliPeerPoolInterface~ThaliPeerPoolInterface}.
 * @type {string}
 * @readonly
 */
ThaliNotificationClient.ActionType = 'GetRequestBeacon';

/**
 * Fired whenever we discover a peer who is looking for us.
 *
 * @public
 * @event module:thaliNotificationClient.event:peerAdvertisesDataForUs
 * @type {Object}
 * @property {buffer} keyId The buffer contains the HKey as defined
 * [here](https://github.com/thaliproject/thali/blob/gh-pages/pages/documentation/PresenceProtocolForOpportunisticSynching.md#processing-the-pre-amble-and-beacons).
 * @property {string} pskIdentifyField This is the value to put in the PSK
 * identity field of the ClientKeyExchange message when establishing a TLS
 * connection using PSK. This value is generated
 * @property {buffer} psk This is the calculated pre-shared key that will be
 * needed to establish a TLS PSK connection.
 * @property {string} hostAddress The IP/DNS address of the peer
 * @property {number} portNumber The TCP/IP port at the hostAddress the peer
 * can be contacted on
 * @property {number} suggestedTCPTimeout Provides a hint to what time out to
 * put on the TCP connection. For some transports a handshake can take quite a
 * long time.
 */

module.exports = ThaliNotificationClient;
