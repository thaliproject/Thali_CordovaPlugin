'use strict';

var EventEmitter = require('events');

/** @module thaliNotificationClient */



function NotificationAction(peerIdentifier, connectionType, thaliPeerPool) {

}

NotificationAction.prototype.start = function () {

};

/**
 * If the action's state is enqueued then this call MUST result in it being
 * removed from the peer pool queue.
 *
 * If the action's state is waiting then the timer MUST be killed and no further
 * action taken.
 *
 * If the action's state is inProgress then any in flight HTTP requests MUST
 * be terminated and the peer pool's FinishedEnqueueCallback called.
 */
NotificationAction.prototype.kill = function () {

};

NotificationAction.prototype.getCurrentState = function () {

};

NotificationAction.prototype.getConnectionType = function() {

};

/**
 * Records information about how to connect to a peer over a particular
 * connectionType.
 *
 * @typedef {Object} PeerConnectionInformation
 * @property {string} hostAddress
 * @property {number} portNumber
 * @property {number} suggestedTCPTimeout
 */

// jscs:disable maximumLineLength
/**
 * A dictionary of different connectionTypes and their associated connection
 * information.
 *
 * @typedef {Object.<module:thaliMobile.connectionTypes, PeerConnectionInformation>} PeerConnectionDictionary
 */
// jscs:enable maximumLineLength

/**
 * Describes the state of a peer in the peer table.
 *
 * @typedef {Object} peerTableEntry
 * @property {PeerTable.peerState} peerState The state of the peer.
 * @property {PeerConnectionDictionary} peerConnectionDictionary A dictionary
 * of different connection types we know about for this peerIdentity
 * @property {NotificationAction} notificationAction If a notification action
 * has been created
 */

function PeerTable() {

}

/**
 * Enum to record the state of trying to get the notification beacons for the
 * associated peerIdentifier
 * @readonly
 * @enum {string}
 */
PeerTable.peerState = {
  /** The notification beacons for this peerID have been successfully
   * retrieved.
   */
  RESOLVED: 'resolved',
  /** A request to get the notification beacons for this peer is currently in
   * the peer pool queue.
   */
  ENQUEUED: 'enqueued',
  /** A request to get the notification beacons for this peer failed and we
   * are now waiting before enqueuing a new request.
   */
  WAITING: 'waiting',
  /** The queued work item has started and has not yet finished. */
  IN_PROGRESS: 'inProgress'
};

/**
 *
 * @param {string} peerIdentifier
 * @return {?peerTableEntry} Returns null if the peerIdentifier is not in the
 * table otherwise returns the peerTableEntry object.
 */
PeerTable.prototype.lookUpEntry = function (peerIdentifier) {
  return null;
};

/**
 * Adds an entry for the peerIdentifier if it does not exist. If it does exist
 * then either add a new peerConnectionInformation entry to the dictionary or
 * if there already is an existing entry with the same connectionType then
 * replace it with the values given in this call.
 *
 * If the peerIdentifier is null or not a string then return a "bad
 * peerIdentifier" error.
 *
 * If the peerConnectionType is not one of the defined enums then return a
 * "bad peerConnectionType" error.
 *
 * The peerConnectionInformation can be null. That means to remove the
 * specified peerConnectionType entry from the dictionary entry for the
 * identifier peerIdentifier. If there is no such peerIdentifier in the table
 * or if the peerIdentifier exists but its dictionary doesn't have an entry
 * matching the connectionType that is fine. The method is still considered
 * a success. If the peerIdentifier entry does exist and the dictionary does
 * have an entry for the specified connectionType then that entry MUST be
 * removed from the dictionary. If removing the connectionType from the
 * dictionary leaves no entries left in the dictionary then the entire
 * peerTableEntry MUST be removed from the table.
 *
 * When creating a new peerTableEntry the peerState and notificationAction
 * default to null.
 *
 * The table has a limited number of peerTableEntry values it can record. If
 * adding this entry would cause a new peerTableEntry to be created that would
 * then exceed the maximum count then an existing entry MUST be deleted before
 * adding this entry. In general entries MUST be deleted using a LIFO approach.
 *
 * @param {string} peerIdentifier
 * @param {module:thaliMobile.connectionTypes} peerConnectionType
 * @param {PeerConnectionInformation} peerConnectionInformation
 * @return {?Error} Returns null if add/update was accepted otherwise an error
 * will be returned.
 */
PeerTable.prototype.addUpdateEntry = function (peerIdentifier,
                                               peerConnectionType,
                                               peerConnectionInformation) {
  return null;
};

/**
 * Changes the state associated with the identified peer.
 *
 * If the specified peerIdentifier is not in the table then a "No such peer"
 * error MUST be returned.
 *
 * If the peerState is null or an illegal value for peerState than a "Bad
 * peer state" error MUST be returned.
 *
 * If the specified state matches the peer's current state that is not an error
 * and null MUST be returned otherwise the state MUST be updated to the new
 * value.
 *
 * @param {string} peerIdentifier
 * @param {PeerTable.peerState} peerState
 * @return {?Error} If the update was accepted then a null will be returned
 * otherwise an Error object will be returned.
 */
PeerTable.prototype.changePeerState = function(peerIdentifier, peerState) {
  return null;
};

/**
 * Updates the notification action associated with a peer.
 *
 * If the specified peerIdentifier is not in the table then a "No such peer"
 * error MUST be returned.
 *
 * If the specified notificationAction is either not null or of the
 * type notificationAction then an error of "Bad notificationAction" MUST be
 * returned.
 *
 * Otherwise the associated notificationAction MUST be updated as specified.
 *
 * @param {string} peerIdentifier
 * @param {NotificationAction} notificationAction
 * @returns {?Error} If the update was accepted than a null will be returned
 * otherwise an Error object will be returned.
 */
PeerTable.prototype.changePeerNotificationAction = function (
  peerIdentifier,
  notificationAction) {
  return null;
};

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
 * ### Handling peerAvailabilityChanged Events
 *
 * The notification code is triggered via peerAvailabilityChanged events. In
 * handling these events remember that our goal is to find the notification
 * beacons associated with each peerIdentifier. Once we have retrieved the
 * beacons for a specific peerIdentifier we don't ever need to deal with that
 * specific peerIdentifier again. If the peer behind the identifier changes
 * their beacons then we will get a new peerIdentifier.
 *
 * + If hostAddress != null
 *  + If this peer is not in the table
 *    + Add the peerIdentifier to the peer table with an entry for their
 *    connection information. Create a callback worker to get the notification
 *    beacons for the specified peerIdentifier.
 *  + If this peer is in the table
 *    + If this peer has been marked as resolved
 *      + Ignore the event
 *    + If this peer has been marked as enqueued or waiting
 *      + Call addUpdateEntry. Then check to see if the connectionType of the
 *      new event is TCP_NATIVE and if the connectionType of the
 *      notificationAction is something else. We always prefer Wifi when
 *      possible to any of the native transports. So in this case call kill
 *      on the notificationAction and then create a new notificationAction
 *      using Wifi.
 *    + If this peer has been marked as inProgress
 *      + Call addUpdateEntry.
 *    + If peer's state is null
 *      + This indicates an internal failure. It should be impossible for us to
 *      reach this point in the code have a null state value in the table.
 *      Record an error in the log and throw, something horrible has happened.
 * + If hostAddress == null
 *   + If this peer is not in the table
 *     + This is technically possible in a number of cases. If this happens
 *     then just ignore the event.
 *   + If this peer is in the table
 *     + If this peer has been marked as resolved
 *       + Ignore the event.
 *     + If this peer has been marked as enqueued or waiting
 *       + Call kill on the connectionType. Call addUpdateEntry. Then check to
 *       see if there is a table entry for the peerIdentifier. If not then
 *       exit. If so then create a notificationAction.
 *     + If this peer has been marked as inProgress
 *       + Strictly speaking this is an error. Ideally thaliMobile should know
 *       if we have a live connection to a peer. But for now call kill on the
 *       notificationAction and call addUpdateEntry.
 *     + If peer's state is null
 *       + See similar entry above, this is bad.
 *
 * ### Defining a callback worker for the peer pool
 *
 *
 * Upon
 * receiving an event we MUST check if we have knowledge of the identified peer.
 * This code MUST have the equivalent of a table that is indexed by
 * peerIdentifier and records all the different connection types it has been
 * notified that the peer is available over. This means that if we see the same
 * peerIdentifier over say both MPCF and Wifi then we MUST assume that the same
 * underlying peer is being pointed to. We MUST record all the various ways
 * we have seen to reach a particular peer.
 *
 *
 *
 * ## Handling peerAvailabilityChanged events with hostAddress != null
 *
 * If a peerAvailabilityChanged event with hostAddress != null is received
 * with a peerIdentifier we have not made a note about (see the rest of this
 * description for what we mean by making a note) then the code MUST call
 * enqueue on the thaliPeerPool object with the peerIdentifier and
 * connectionType submitted in the event. The actionType MUST be set to {@link
 * module:thaliNotificationClient~ThaliNotificationClient.ActionType}. The
 * {@link module:ThaliPeerPoolInterface~EnqueueCallback} MUST, when called,
 * issue a HTTP GET request to
 * http://[hostAddress]:[portNumber]/NotificationBeacons. Make sure to set the
 * TCP/IP timeout using suggestedTCPTimeout. If the address resolution fails or
 * the connection is lost before the request/response pair can be successfully
 * exchanged then we MUST keep retrying every 500 ms between each retry until we
 * either run out of retry space or we are told that the peer is no longer
 * available. Note that each retry happens by submitting a new request to the
 * peer pool enqueue method. If a non-200 HTTP response is received then the
 * client MUST immediately give up and not retry. If a 200 response is received
 * then the beacon MUST be processed as given below.
 *
 * Anytime a HTTP request to a specific peerIdentifier is outstanding as well
 * as during the waiting period between retries a note MUST be made of the
 * peerIdentifier. Once we have exhausted space on the retry list, have received
 * an event that the peer is no longer available or a response is received then
 * the note MUST be removed. If a 200 response is received then the
 * peerIdentifier MUST be recorded per the limits given below.
 *
 * If a peerAvailabilityChanged event is received with a peerIdentifier
 * value that we have a note about per the previous paragraph (e.g. we are
 * making a HTTP request to it, waiting for a retry period before making
 * another request or we have successfully communicated with it) and if the new
 * then we MUST
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
 *   * Limit how many simultaneous HTTP request we have outstanding
 *   Limit how
 * many queued discoveries we have
 * Limit how big the successful peerIdentifier
 * cache can get
 * Limit how many requests we can have in retry
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
