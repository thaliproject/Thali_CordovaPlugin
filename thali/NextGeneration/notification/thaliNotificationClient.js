'use strict';

var PeerDictionary = require('./thaliPeerDictionary');
var ThaliMobile = require('../thaliMobile');
var ThaliNotificationAction = require('./thaliNotificationAction.js');
var PeerAction = require('../thaliPeerPool/thaliPeerAction.js');
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
 * @param {addressBookCallback} addressBookCallback A callback used to validate
 * which peers we are interested in talking to.
 * @fires module:thaliNotificationClient.event:peerAdvertisesDataForUs
 * @throws {Error} thaliPeerPoolInterface cannot be null
 * @throws {Error} ecdhForLocalDevice cannot be null
 * @throws {Error} addressBookCallback cannot be null
 */
function ThaliNotificationClient(thaliPeerPoolInterface, ecdhForLocalDevice,
                                 addressBookCallback ) {

  assert(thaliPeerPoolInterface,
    ThaliNotificationClient.Errors.PEERPOOL_NOT_NULL);
  assert(ecdhForLocalDevice,
    ThaliNotificationClient.Errors.EDCH_FOR_LOCAL_DEVICE_NOT_NULL);
  assert(addressBookCallback,
    ThaliNotificationClient.Errors.ADDRESS_BOOK_CALLBACK_NOT_NULL);

  this.peerDictionary = new PeerDictionary.PeerDictionary();
  this._thaliMobileListenerRegistered = false;
  this._thaliPeerPoolInterface = thaliPeerPoolInterface;
  this._ecdhForLocalDevice = ecdhForLocalDevice;
  this._addressBookCallback = addressBookCallback;

  this._prioritizedReplicationList = null;
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
 * Stops listening incoming events and emitting them. Also removes all
 * non-resolved entries from the dictionary.
 * @public
 */
ThaliNotificationClient.prototype.stop = function () {

  if (this._thaliMobileListenerRegistered) {
    this._thaliMobileListenerRegistered = false;

    ThaliMobile.emitter.removeListener('peerAvailabilityChanged',
      this._peerAvailabilityChanged);

    this.peerDictionary.removeAll();
  }
};

/**
 * Peer object
 *
 * @public
 * @typedef {Object} Peer
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

/**
 * The notification code is triggered via peerAvailabilityChanged events.
 * Goal is to find the notification beacons associated with each
 * peerIdentifier.
 *
 * @param {Peer} peer An incoming peer variable.
 *
 * @private
 */
ThaliNotificationClient.prototype._peerAvailabilityChanged = function (peer) {

  if (peer.hostAddress) {
    if (this.peerDictionary.exists(peer.peerIdentifier)) {
      /* This peer is already in the dictionary */
      this._hostAddressAndIdentifier(peer);
    } else {
      /* This peer is not in the dictionary */
      this._hostAddressNoIdentifier(peer);
    }
  } else {
    if (this.peerDictionary.exists(peer.peerIdentifier)) {
      /* This peer is in the dictionary */
      this._noHostIdentifierExists(peer);
    }
  }
};

/**
 * Called when
 * 1. peer's hostAddress is not null
 * 2. the peer is already in the dictionary.
 * @private
 * @param {Peer} peer An incoming peer variable.
 */
ThaliNotificationClient.prototype._hostAddressAndIdentifier = function (peer) {

  var peerEntry = this.peerDictionary.get(peer.peerIdentifier);

  if (peerEntry.peerState === PeerDictionary.peerState.RESOLVED){
    // If this peer has been marked as RESOLVED, Ignore the event
    return;
  }

  // Checks if this peer has been marked as CONTROLLED_BY_POOL and the action's
  // state is CREATED or if the peer's state is WAITING

  if (peerEntry.peerState === PeerDictionary.peerState.CONTROLLED_BY_POOL &&
      peerEntry.notificationAction.getActionState() ===
      PeerAction.actionState.CREATED ||
      peerEntry.peerState === PeerDictionary.peerState.WAITING) {

    var newPeerConnectionInfo = new PeerDictionary.PeerConnectionInformation(
      peer.hostAddress, peer.portNumber, peer.suggestedTCPTimeout);

    peerEntry.peerConnectionDictionary.set(peer.connectionType,
      newPeerConnectionInfo);

    if (peer.connectionType === ThaliMobile.connectionTypes.TCP_NATIVE &&
        peerEntry.notificationAction.getConnectionType() !==
        ThaliMobile.connectionTypes.TCP_NATIVE) {

      // When the connectionType of the new event is TCP_NATIVE and existing
      // action isn't that, we kill the existing action and create a new
      // action. We prefer native TCP transport to other options.

      peerEntry.notificationAction.kill();

      this._createAndEnqueueAction(
        peerEntry, peer.peerIdentifier,
        peer.connectionType, newPeerConnectionInfo);
    }

    // As a final thing update the dictionary
    return this.peerDictionary.addUpdateEntry(peer.peerIdentifier, peerEntry);
  }

  // Checks if this peer has been marked as CONTROLLED_BY_POOL and
  // the action's state is STARTED
  if (peerEntry.peerState === PeerDictionary.peerState.CONTROLLED_BY_POOL &&
      peerEntry.notificationAction.getActionState() ===
      PeerAction.actionState.STARTED) {

    if (peer.connectionType !==
        peerEntry.notificationAction.getConnectionType() ) {

      // When the connectionType of the event is different than the
      // connectionType of the ongoing action then just update the
      // peerConnectionDictionary.

      var updatedPeerConnectionInfo =
        new PeerDictionary.PeerConnectionInformation(
          peer.hostAddress, peer.portNumber, peer.suggestedTCPTimeout);

      peerEntry.peerConnectionDictionary.set(peer.connectionType,
        updatedPeerConnectionInfo);
    }

    if (peer.connectionType !==
      peerEntry.notificationAction.getConnectionType() ) {

      // when the connectionTypes are same then kill the existing action
      peerEntry.notificationAction.kill();

      var tcpConn = peerEntry.peerConnectionDictionary.get(
        ThaliMobile.connectionTypes.TCP_NATIVE);

      if (tcpConn !== null) {

        // If the peerConnectionDictionary contains a TCP_NATIVE entry then
        // create and enqueue an action for that.

        this._createAndEnqueueAction(
          peerEntry, peer.peerIdentifier,
          ThaliMobile.connectionTypes.TCP_NATIVE, tcpConn);

      } else {
        // takes the entry that was just updated and create and enqueues
        // that as an action.
        var updatedConnInfo =
          peerEntry.peerConnectionDictionary.get(peer.connectionType);

        this._createAndEnqueueAction(
          peerEntry, peer.peerIdentifier,
          peer.connectionType, updatedConnInfo);
      }
    }
    this.peerDictionary.addUpdateEntry(peer.peerIdentifier, peerEntry);
  }
};

/**
 * This function will be called when
 * 1. the incoming peer has no hostAddress and
 * 2. there is a record for the 'peer.peerIdentifier' already.
 * @private
 * @param {Peer} peer An incoming peer variable.
 */
ThaliNotificationClient.prototype._noHostIdentifierExists = function (peer) {

  var peerEntry = this.peerDictionary.get(peer.peerIdentifier);

  if (peerEntry.peerState === PeerDictionary.peerState.RESOLVED || !peerEntry) {
    // Ignore the event, if the peer is RESOLVED or it is not in the table
    return;
  }

  if (peer.peerState === PeerDictionary.peerState.CONTROLLED_BY_POOL &&
      peerEntry.notificationAction.getActionState() ===
      PeerAction.actionState.STARTED ||
      peerEntry.notificationAction.getActionState() ===
      PeerAction.actionState.CREATED ||
      peer.peerState === PeerDictionary.peerState.WAITING) {

    peerEntry.notificationAction.kill();
    peerEntry.peerConnectionDictionary.remove(peer.connectionType);

    if (peerEntry.peerConnectionDictionary.size() > 0) {

      var prefType =
        peerEntry.peerConnectionDictionary.getPreferredConnectionType();

      var prefConn = peerEntry.peerConnectionDictionary.get(prefType);

      this._createAndEnqueueAction(
        peerEntry, peer.peerIdentifier, prefType, prefConn);

    } else {
      this.peerDictionary.remove(peer.peerIdentifier);
    }
  }
};

/**
 * This function registers listener to action
 * @private
 * @param {string} peerIdentifier
 * @param {module:thaliPeerAction~PeerAction} action Action to register
 */
ThaliNotificationClient.prototype._createAndEnqueueAction =
  function (peerEntry, identifier, connectionType, connection) {

    var action = new ThaliNotificationAction(
      identifier, connectionType,
      this._ecdhForLocalDevice, this._addressBookCallback,
      connection);

    var resolved = function (self) {
      return function (par) {
        console.log(par);
      };
    };

    action.eventEmitter.on(ThaliNotificationAction.Events.Resolved,
      resolved(this));

    peerEntry.notificationAction = action;
    this._thaliPeerPoolInterface.enqueue(action);
    this.peerDictionary.addUpdateEntry(identifier, peerEntry);
  };


/**
 * This function will be called when
 * 1. The incoming peer has a hostAddress AND
 * 2. The peer is not in the dictionary.

 * @private
 * @param {Peer} peer An incoming peer variable.
 */
ThaliNotificationClient.prototype._hostAddressNoIdentifier =
  function (peer) {

    var peerConnectionInfo = new PeerDictionary.PeerConnectionInformation(
      peer.hostAddress, peer.portNumber, peer.suggestedTCPTimeout);

    var peerConnectionDictionary =
      new PeerDictionary.PeerConnectionDictionary();

    peerConnectionDictionary.set(peer.connectionType, peerConnectionInfo);

    var dictionaryEntry = new PeerDictionary.NotificationPeerDictionaryEntry(
      PeerDictionary.peerState.CONTROLLED_BY_POOL,
      peerConnectionDictionary,
      null);

    this._createAndEnqueueAction(dictionaryEntry,
      peer.peerIdentifier, peer.connectionType, peerConnectionInfo);

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

ThaliNotificationClient.Errors = {
  PEERPOOL_NOT_NULL : 'thaliPeerPoolInterface must not be null',
  EDCH_FOR_LOCAL_DEVICE_NOT_NULL : 'ecdhForLocalDevice must not be null',
  ADDRESS_BOOK_CALLBACK_NOT_NULL : 'addressBookCallback must not be null'
};

module.exports = ThaliNotificationClient;
