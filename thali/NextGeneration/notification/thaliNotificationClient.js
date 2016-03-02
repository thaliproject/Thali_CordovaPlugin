'use strict';

var PeerDictionary = require('./thaliPeerDictionary');
var ThaliMobile = require('../thaliMobile');
var ThaliNotificationAction = require('./thaliNotificationAction.js');
var ThaliPeerAction = require('../thaliPeerPool/thaliPeerAction.js');
var assert = require('assert');

/** @module thaliNotificationClient */

/**
 * @classdesc Creates a class that can register to receive the {@link
 * module:thaliMobile.event:peerAvailabilityChanged} event. It will listen for
 * the event and upon receiving it, will enqueue an action with the submitted
 * thaliPeerPoolInterface. Once called back by the pool then the callback will
 * issue a HTTP GET request to retrieve the notification beacons for the peer,
 * parse them, see if one matches and if so then fire a {@link
 * module:thaliNotificationClient.event:peerAdvertisesDataForUs}. Callers can
 * listen for the event by using the emitter member.
 *
 * @public
 * @constructor
 * @param {@link module:thaliPeerPoolInterface~ThaliPeerPoolInterface} thaliPeerPoolInterface
 * Requests to retrieve notification beacons are enqueued on this object in
 * order to make sure we don't overwhelm our bandwidth or native communication
 * capabilities.
 * @param {Crypto.ECDH} ecdhForLocalDevice A Crypto.ECDH object initialized
 * with the local device's public and private keys.
 * @fires module:thaliNotificationClient.event:peerAdvertisesDataForUs
 * @throws {Error} thaliPeerPoolInterface cannot be null
 * @throws {Error} ecdhForLocalDevice cannot be null
 *
 */
function ThaliNotificationClient(thaliPeerPoolInterface, ecdhForLocalDevice) {

  assert(thaliPeerPoolInterface !== null,
    'thaliPeerPoolInterface must not be null');
  assert(ecdhForLocalDevice !== null, 'ecdhForLocalDevice must not be null');

  this.peerDictionary = new PeerDictionary.PeerDictionary();
  this._thaliMobileListenerRegistered = false;
  this._prioritizedReplicationList = null;
  this._thaliPeerPoolInterface = thaliPeerPoolInterface;
  this._ecdhForLocalDevice = ecdhForLocalDevice;
}

/**
 * A dictionary used to track the state of peers we have received notifications
 * about from {@link module:thaliMobile}.
 *
 * @type {ThaliNotificationClient.PeerDictionary}
 */
ThaliNotificationClient.prototype.peerDictionary = null;

/**
 * This method will cause a listener to be registered on the global singleton
 * {@link module:thaliMobile} object for the {@link
 * module:thaliMobile.event:peerAvailabilityChanged} event.
 *
 * This method is not idempotent since it can be called multiple times with
 * different prioritization lists but repeated start calls MUST only update that
 * list and MUST NOT cause multiple listeners to be registered with thaliMobile.
 *

 * ## Handling Resolved events from notificationActions
 *
 * When creating a notificationAction a listener MUST be placed on that action
 * to listen for the
 * {@link module:thaliNotificationAction~ThaliNotificationAction.event:Resolved}
 * event.
 *
 * + BEACONS_RETRIEVED_AND_PARSED
 *  + Mark the entry in the dictionary as RESOLVED and fire
 *  {@link module:thaliNotificationClient.event:peerAdvertisesDataForUs}
 * + BEACONS_RETRIEVED_BUT_BAD
 *  + This indicates a malfunctioning peer. We need to assume they are bad all
 *  up and mark their entry as RESOLVED without taking any further action. This
 *  means we will ignore this peerIdentifier in the future.
 * + HTTP_BAD_RESPONSE
 *  + This tells us that the peer is there but not in good shape. But we will
 *  give them the benefit of the doubt. We will wait 100 ms if we are in the
 *  foreground and 500 ms if we are in the background (the later only applies
 *  to Android) and then create a new action (remember, prefer TCP_NATIVE) and
 *  then enqueue it. Make sure to set the dictionary entry's state to
 *  WAITING and when the timer is up and we enqueue to CONTROLLED_BY_POOL.
 * + NETWORK_problem
 *  + Treat the same as HTTP_BAD_RESPONSE
 * + KILLED
 *  + We MUST check the value of the notificationAction on the associated
 *  dictionary entry with the notificationAction that this handler was created
 *  on. If they are different then this means that this class was the one who
 *  called kill and so we can ignore this event. If they are the same then it
 *  means that the ThaliPeerPoolInterface called kill (due to resource
 *  exhaustion). Having the pool kill us is a pretty extreme event, it means
 *  we have so many peerIdentifiers that we blew up the pool. So at that point
 *  the best thing for us to do is to just delete the entire entry for this
 *  peerIdentifier and move on.
 *
 * @public
 * @param {Buffer[]} prioritizedReplicationList Used to decide what peer
 * notifications to pay attention to and when scheduling replications what
 * order to schedule them in (if possible). This list consists of an array
 * of buffers that contain the serialization of the public ECDH keys of the
 * peers we are interested in synching with.
 *
 * BUGBUG: Having to give a flat prioritizedReplicationList is obviously a
 * bad idea as it limits the effective size of that list to something we
 * are o.k. passing around. If we ever want a bigger list we need a lookup
 * object. But for now we decided to stick with simplicity.
 */
ThaliNotificationClient.prototype.start =
  function (prioritizedReplicationList) {

    this._prioritizedReplicationList = prioritizedReplicationList;

    if (!this._thaliMobileListenerRegistered) {
      this._thaliMobileListenerRegistered = true;
      ThaliMobile.emitter.on('peerAvailabilityChanged',
        this._peerAvailabilityChanged);
    }
  };

/**
 * Will remove the listener registered on the global thaliMobile object, if
 * any. This method MUST be idempotent so calling it multiple times MUST only
 * cause a single call to removeListener on thaliMobile and only then if there
 * already was a call to addListener on this object.
 *
 * Removing the listener MUST not just stop listening for the event but MUST
 * also cause all non-resolved entries in the dictionary to either stop
 * waiting or if under control of the pool to be killed and then their entries
 * MUST be removed from the peer dictionary.
 *
 * @public
 */
ThaliNotificationClient.prototype.stop = function () {

  if (this._thaliMobileListenerRegistered) {
    this._thaliMobileListenerRegistered = false;
    ThaliMobile.emitter.removeListener('peerAvailabilityChanged',
      this._peerAvailabilityChanged);
  }
};


/**
 * The notification code is triggered via peerAvailabilityChanged events.
 * Goal is to find the notification beacons associated with each
 * peerIdentifier.
 *
 * @param {@link module:thaliMobile.event:peerAvailabilityChanged} peer An
 * incoming peer variable.
 *
 * @private
 */
ThaliNotificationClient.prototype._peerAvailabilityChanged = function (peer) {

  if (peer.hostAddress != null) {
    if (this.peerDictionary.exists(peer.peerIdentifier)) {
      /* This peer is already in the dictionary */
      this._hostAddressAndIdentifier(peer);
    } else {
      /* This peer is not in the dictionary */
      this._hostAddressAndNoIdentifier(peer);
    }
  } else {
    if (this.peerDictionary.exists(peer.peerIdentifier)) {
      /* This peer is in the dictionary */
      this._noHostAddressAndIdentifier(peer);
    }
  }
};

/**
 * Will be called when 'peer.hostAddress' is null and peer is already in the
 * dictionary.
 *    + If this peer has been marked as CONTROLLED_BY_POOL and the action's
 *      state is CREATED or if the peer's state is WAITING
 *      + First update the connection dictionary for the peer's entry with the
 *      new data. Then if the connectionType of the new event is TCP_NATIVE and
 *      if the connectionType of the existing action isn't that then kill the
 *      existing action using {@link
 *      module:thaliPeerPoolInterface~ThaliPeerPoolInterface#kill} and create a
 *      new action and enqueue it and update the entry. The point of this
 *      exercise is that we prefer native TCP transport to other options.
 *    + If this peer has been marked as CONTROLLED_BY_POOL and the action's
 *      state is STARTED
 *      //Why we kill it here?
 *      + If the connectionType of the event is different than the
 *      connectionType of the action then just update the
 *      peerConnectionDictionary and move on. If the connectionTypes are
 *      identical then kill the existing action as above. If the
 *      peerConnectionDictionary contains a TCP_NATIVE entry then create and
 *      enqueue an action for that. Otherwise take the entry that was just
 *      updated and create and enqueue that as an action.
 */
ThaliNotificationClient.prototype._hostAddressAndIdentifier = function (peer) {

  var peerEntry = this.peerDictionary.get(peer.peerIdentifier);

  // Checks if this peer has been marked as CONTROLLED_BY_POOL and the action's
  // state is CREATED or if the peer's state is WAITING

  if (peerEntry.peerState ===
      ThaliPeerDictionary.peerState.CONTROLLED_BY_POOL &&
      peerEntry.notificationAction.actionType ===
      ThaliPeerAction.actionState.CREATED ||
      peerEntry.peerState === PeerDictionary.peerState.WAITING) {

    var newPeerConnectionInfo = new PeerDictionary.PeerConnectionInformation(
      peer.hostAddress, peer.portNumber, 10); // Timeout?

    peerEntry.peerConnectionDictionary[peer.connectionType] =
      newPeerConnectionInfo;

    this.peerDictionary.addUpdateEntry(peer.peerIdentifier, peerEntry);

    if (peer.connectionType === ThaliMobile.connectionTypes.TCP_NATIVE &&
        peerEntry.notificationAction.connectionType !==
        ThaliMobile.connectionTypes.TCP_NATIVE) {

      // When the connectionType of the new event is TCP_NATIVE and existing
      // action isn't that, we kill the existing action and create a new
      // action. We prefer native TCP transport to other options.

      peerEntry.notificationAction.kill();

      var action = new ThaliNotificationAction(
                        peer.peerIdentifier, peer.connectionType,
                        this._ecdhForLocalDevice, function () {});

      this._thaliPeerPoolInterface.enqueue(action);
      peerEntry.notificationAction = action;
      this.peerDictionary.addUpdateEntry(peer.peerIdentifier, peerEntry);
    }
    return;
  }

  // Checks if If this peer has been marked as CONTROLLED_BY_POOL and
  // the action's state is STARTED
  if (peerEntry.peerState ===
      PeerDictionary.peerState.CONTROLLED_BY_POOL &&
      peerEntry.notificationAction.actionType ===
      ThaliPeerAction.actionState.STARTED) {

    if (peer.connectionType !== peerEntry.notificationAction.connectionType ) {

      // When the connectionType of the event is different than the connectionType
      // of the action then just update the peerConnectionDictionary.

      var updatePeerConnectionInfo =
        new PeerDictionary.PeerConnectionInformation(
          peer.hostAddress, peer.portNumber, 10); // Timeout?

      peerEntry.peerConnectionDictionary[peer.connectionType] =
        updatePeerConnectionInfo;

      this.peerDictionary.addUpdateEntry(peer.peerIdentifier, peerEntry);
    } else {

      // when the connectionTypes are identical then kill the existing action

      peerEntry.notificationAction.kill();

      if (peerEntry.peerConnectionDictionary[ThaliMobile.connectionTypes.TCP_NATIVE] !== null) {

        // When the peerConnectionDictionary contains a TCP_NATIVE entry then
        // create and enqueue an action for that.

        var actionWithTCP = new ThaliNotificationAction(
              peer.peerIdentifier, ThaliMobile.connectionTypes.TCP_NATIVE,
              this._ecdhForLocalDevice, function () {});

        this._thaliPeerPoolInterface.enqueue(actionWithTCP);
        peerEntry.notificationAction = actionWithTCP;
        this.peerDictionary.addUpdateEntry(peer.peerIdentifier, peerEntry);

      } else {
        // not implemented yet.Otherwise take the entry that was just updated and create and
        // enqueue that as an action.
      }
    }
  }
};

/**
* This function will be called when the incoming peer has no hostAddress and
*  there is a record for the 'peer.peerIdentifier' already.
*   + If this peer is not in the table
*     + This is technically possible in a number of cases. If this happens
*     then just ignore the event.
*   + If this peer is in the table
*     + If this peer has been marked as resolved
*       + Ignore the event.
*     + If this peer has been marked as CONTROLLED_BY_POOL and the action's
*     state is QUEUED or if the peer's state is WAITING or if this peer has
*     been marked as CONTROLLED_BY_POOL and the action's state is STARTED
*       + Call kill on the action via {@link
*       module:thaliPeerPoolInterface~ThaliPeerPoolInterface#kill} and remove
*       the associated entry in peerConnectionDictionary. If this leaves no
*       entries in peerConnectionDictionary then remove this table entry in
*       total from the dictionary. If there is still an entry left then create
*       a notificationAction for it and enqueue it.
*/
ThaliNotificationClient.prototype._noHostAddressAndIdentifier = function (peer) {
  var peerEntry = this.peerDictionary.get(peer.peerIdentifier);

  if (peer.peerState ===
      PeerDictionary.peerState.CONTROLLED_BY_POOL &&
      peerEntry.notificationAction.actionType ===
      ThaliPeerAction.actionState.STARTED ||
      peerEntry.notificationAction.actionType ===
      ThaliPeerAction.actionState.CREATED ||
      peer.peerState === PeerDictionary.peerState.WAITING) {

    peerEntry.notificationAction.kill();
    delete peerEntry.peerConnectionDictionary[peer.connectionType];

    if (peerEntry.peerConnectionDictionary.lenght > 0) {

      var action = new ThaliNotificationAction(
                        peer.peerIdentifier, peer.connectionType,
                        this._ecdhForLocalDevice, function () {});

      this._thaliPeerPoolInterface.enqueue(action);
      this.peerDictionary.addUpdateEntry(peer.peerIdentifier, peerEntry);

    } else {
      this.peerDictionary.delete(peer.peerIdentifier);
    }
  }
};

/**
*  This function will be called when the incoming peer has a hostAddress and
*  the peer is not in the dictionary.
*  Create a {@link module:thaliNotificationAction~ThaliNotificationAction}
*  and then call enqueue on the submitted {@link
*  module:thaliPeerPoolInterface~ThaliPeerPoolInterface} object and then
*  create a new PeerDictionaryEntry object with the peerState set to
*  enqueued, the peerConnectionDictionary set to a single entry matching the
*  data in the peerAvailabilityChanged event and the notificationAction set
*  to the previously created notificationAction object.
*/
ThaliNotificationClient.prototype._hostAddressAndNoIdentifier =
  function (peer) {

    var peerConnectionInfo = new ThaliPeerDictionary.PeerConnectionInformation(
      peer.hostAddress, peer.portNumber, 10); // Timeout?

    var peerConnectionDictionary = [];
    peerConnectionDictionary[peer.connectionType] = peerConnectionInfo;

    var action = new ThaliNotificationAction(
                      peer.peerIdentifier,
                      peer.connectionType,
                      this._ecdhForLocalDevice, function () {});

    var dictionaryEntry = new ThaliPeerDictionary.NotificationPeerDictionaryEntry(
                                ThaliPeerDictionary.peerState.WAITING,
                                peerConnectionDictionary,
                                action);

    this.peerDictionary.addUpdateEntry(peer.peerIdentifier, dictionaryEntry);
    this._thaliPeerPoolInterface.enqueue(action);
  };











/**
 * This is the action type that will be used by instances of this class when
 * registering with {@link
 * module:thaliPeerPoolInterface~ThaliPeerPoolInterface}.
 * @type {string}
 * @readonly
 */
ThaliNotificationClient.ACTION_TYPE = 'GetRequestBeacon';

/**
 * Fired whenever we discover a peer who is looking for us.
 *
 * @public
 * @event module:thaliNotificationClient.event:peerAdvertisesDataForUs
 * @type {Object}
 * @property {buffer} keyId The buffer contains the ECDH public key for the
 * peer.
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
 * @property {module:thaliMobile.connectionTypes} connectionType The type of
 * connection that will be used when connecting to this peer.
 */

module.exports = ThaliNotificationClient;
