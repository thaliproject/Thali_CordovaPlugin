'use strict';

var PeerDictionary = require('./thaliPeerDictionary');
var ThaliMobile = require('../thaliMobile');
var ThaliNotificationAction = require('./thaliNotificationAction.js');
var NotificationBeacons = require('./thaliNotificationBeacons');
var PeerAction = require('../thaliPeerPool/thaliPeerAction.js');
var logger = require('../../thalilogger')('thaliNotificationClient');

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var util = require('util');

/** @module thaliNotificationClient */

/**
 * @classdesc Data of peerAdvertisesDataForUs event
 * @constructor
 * @param {buffer} keyId The buffer contains the ECDH public key for the
 * peer.
 * @param {string} pskIdentifyField
 * @param {buffer} psk This is the calculated pre-shared key that will be
 * needed to establish a TLS PSK connection.
 * @param {string} hostAddress The IP/DNS address of the peer
 * @param {number} portNumber The TCP/IP port at the hostAddress the peer
 * can be contacted on
 * @param {number} suggestedTCPTimeout Provides a hint to what time out to
 * put on the TCP connection. For some transports a handshake can take quite a
 * long time.
 * @param {module:thaliMobile.connectionTypes} connectionType The type of
 * connection that will be used when connecting to this peer.
 */
function PeerAdvertisesDataForUs (keyId, pskIdentifyField,
                                  psk, hostAddress, portNumber,
                                  suggestedTCPTimeout, connectionType) {
  this.keyId = keyId;
  this.pskIdentifyField = pskIdentifyField;
  this.psk = psk;
  this.hostAddress = hostAddress;
  this.portNumber = portNumber;
  this.suggestedTCPTimeout = suggestedTCPTimeout;
  this.connectionType = connectionType;
}
// jscs:disable maximumLineLength
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
 * @param {module:thaliPeerPoolInterface~ThaliPeerPoolInterface} thaliPeerPoolInterface
 * Requests to retrieve notification beacons are enqueued on this object in
 * order to make sure we don't overwhelm our bandwidth or native communication
 * capabilities.
 * @param {Crypto.ECDH} ecdhForLocalDevice A Crypto.ECDH object initialized
 * with the local device's public and private keys.
 * @fires module:thaliNotificationClient.event:peerAdvertisesDataForUs
 * @throws {Error} thaliPeerPoolInterface cannot be null
 * @throws {Error} ecdhForLocalDevice cannot be null
 */
// jscs:enable maximumLineLength
function ThaliNotificationClient(thaliPeerPoolInterface, ecdhForLocalDevice) {

  EventEmitter.call(this);
  assert(thaliPeerPoolInterface,
    ThaliNotificationClient.Errors.PEERPOOL_NOT_NULL);
  assert(ecdhForLocalDevice,
    ThaliNotificationClient.Errors.EDCH_FOR_LOCAL_DEVICE_NOT_NULL);

  this.peerDictionary = null;
  this._thaliPeerPoolInterface = thaliPeerPoolInterface;
  this._ecdhForLocalDevice = ecdhForLocalDevice;
  this._publicKeysToListen = [];
  this._publicKeysToListenHashes = [];

  var self = this;

  this._addressBookCallback = function (unencryptedKeyId) {
    for (var i = 0 ; i < self._publicKeysToListenHashes.length ; i++)
    {
      var pubKeyHash = self._publicKeysToListenHashes[i];
      if (unencryptedKeyId.compare(pubKeyHash) === 0) {
        return self._publicKeysToListen[i];
      }
    }
    return null;
  };
}

util.inherits(ThaliNotificationClient, EventEmitter);

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
 * @public
 * @param {Buffer[]} publicKeysToListen Used to decide what peer
 * notifications to pay attention to. This list consists of an array
 * of buffers that contain the serialization of the public ECDH keys of the
 * peers we are interested in syncing with.
 *
 * @throws {Error} Public keys to listen must be an array
 */
ThaliNotificationClient.prototype.start =
  function (publicKeysToListen) {

    var self = this;

    assert(Array.isArray(publicKeysToListen),
      ThaliNotificationClient.Errors.PUBLIC_KEYS_TO_LISTEN_NOT_ARRAY);

    if (publicKeysToListen) {
      this._publicKeysToListen = publicKeysToListen;
      this._publicKeysToListenHashes = [];

      publicKeysToListen.forEach(function (pubKy) {
        self._publicKeysToListenHashes.push(
          NotificationBeacons.createPublicKeyHash(pubKy));
      });
    } else {
      this._publicKeysToListen = [];
      this._publicKeysToListenHashes = [];
    }

    if (!this.peerDictionary) {
      this._running = true;
      ThaliMobile.emitter.on('peerAvailabilityChanged',
        this._peerAvailabilityChanged);
    }

    this.peerDictionary = new PeerDictionary.PeerDictionary();

  };

/**
 * This method will cause the ThaliNotificationClient to stop listening on
 * {@link module:thaliMobile.event:peerAvailabilityChanged} and
 * {@link module:thaliNotificationAction.eventEmitter:Resolved} events.
 * It will also remove all items from the dictionary and set it to null.
 * @public
 */
ThaliNotificationClient.prototype.stop = function () {

  if (this.peerDictionary) {
    ThaliMobile.emitter.removeListener('peerAvailabilityChanged',
      this._peerAvailabilityChanged);

    this.peerDictionary.removeAll();
    this.peerDictionary = null;
  }
};

/**
 * This function is handling
 * {@link module:thaliMobile.event:peerAvailabilityChanged}
 * events. It will update an existing entry in the peer dictionary or
 * create a new one.
 *
 * @private
 * @param {module:thaliMobile~discoveryAdvertisingStatus} peerStatus An
 * incoming peer variable.
 */
ThaliNotificationClient.prototype._peerAvailabilityChanged =
  function (peerStatus) {
    if (peerStatus.hostAddress && peerStatus.portNumber) {
      if (this.peerDictionary.exists(peerStatus.peerIdentifier)) {
        /* This peer is already in the dictionary */
        this._hostAddressPeerFound(peerStatus);
      } else {
        /* This peer is not in the dictionary */
        this._hostAddressPeerNotFound(peerStatus);
      }
    } else {
      if (this.peerDictionary.exists(peerStatus.peerIdentifier)) {
        /* This peer is in the dictionary */
        this._hostLostPeerFound(peerStatus);
      }
    }
  };

/**
 * This function adds a new entry into the dictionary and enqueues a new
 * action into the peer pool. It is called when we have received
 * peerAvailabilityChanged event for a new peer that doesn't have an entry
 * in the dictionary yet.
 *
 * The prerequisites are:
 * - The incoming peer has a hostAddress AND port number.
 * - The peer is not in the dictionary.
 *
 * @private
 * @param {module:thaliMobile~discoveryAdvertisingStatus} peerStatus
 * Updated peer status.
 */
ThaliNotificationClient.prototype._hostAddressPeerNotFound =
  function (peerStatus) {

    var peerConnectionInfo = new PeerDictionary.PeerConnectionInformation(
      peerStatus.hostAddress, peerStatus.portNumber,
      peerStatus.suggestedTCPTimeout);

    var peerConnectionDictionary =
      new PeerDictionary.PeerConnectionDictionary();

    peerConnectionDictionary.set(peerStatus.connectionType, peerConnectionInfo);

    var dictionaryEntry = new PeerDictionary.NotificationPeerDictionaryEntry(
      PeerDictionary.peerState.CONTROLLED_BY_POOL,
      peerConnectionDictionary,
      null);

    this._createAndEnqueueAction(dictionaryEntry,
      peerStatus.peerIdentifier, peerStatus.connectionType, peerConnectionInfo);

  };

/**
 * This function updates an existing entry in the dictionary.
 * It is called when when there is already an entry in the dictionary
 * that matches with the peer identification that we received with
 * {@link module:thaliMobile.event:peerAvailabilityChanged} event.
 *
 * The prerequisites are:
 * - Host address and port number are not null
 * - The peer is already in the dictionary.
 *
 * @private
 * @param {module:thaliMobile~discoveryAdvertisingStatus} peerStatus
 * Updated peer status.
 */
// jscs:disable maximumLineLength
ThaliNotificationClient.prototype._hostAddressPeerFound = function (peerStatus) {

  var peerEntry = this.peerDictionary.get(peerStatus.peerIdentifier);

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
      peerStatus.hostAddress, peerStatus.portNumber,
      peerStatus.suggestedTCPTimeout);

    peerEntry.peerConnectionDictionary.set(peerStatus.connectionType,
      newPeerConnectionInfo);

    if (peerStatus.connectionType === ThaliMobile.connectionTypes.TCP_NATIVE &&
        peerEntry.notificationAction.getConnectionType() !==
        ThaliMobile.connectionTypes.TCP_NATIVE) {

      // If the connectionType of the new event is TCP_NATIVE and existing
      // action isn't that, we kill the existing action and create a new
      // action. We prefer native TCP transport to other options.
      this._killAndUnsubscribe(peerEntry.notificationAction);

      this._createAndEnqueueAction(
        peerEntry, peerStatus.peerIdentifier,
        peerStatus.connectionType, newPeerConnectionInfo);
    }

    // As a final thing update the dictionary
    return this.peerDictionary.addUpdateEntry(
      peerStatus.peerIdentifier, peerEntry);
  }

  // Checks if this peer has been marked as CONTROLLED_BY_POOL and
  // the action's state is STARTED
  if (peerEntry.peerState === PeerDictionary.peerState.CONTROLLED_BY_POOL &&
      peerEntry.notificationAction.getActionState() ===
      PeerAction.actionState.STARTED) {

    if (peerStatus.connectionType !==
        peerEntry.notificationAction.getConnectionType() ) {

      // If the connectionType of the event is different than the
      // connectionType of the ongoing action then just update the
      // peerConnectionDictionary.

      var updatedPeerConnectionInfo =
        new PeerDictionary.PeerConnectionInformation(
          peerStatus.hostAddress, peerStatus.portNumber,
          peerStatus.suggestedTCPTimeout);

      peerEntry.peerConnectionDictionary.set(peerStatus.connectionType,
        updatedPeerConnectionInfo);

      this.peerDictionary.addUpdateEntry(peerStatus.peerIdentifier, peerEntry);
    }

    if (peerStatus.connectionType !==
      peerEntry.notificationAction.getConnectionType()) {

      // If the connectionTypes are same then kill the existing action
      this._killAndUnsubscribe(peerEntry.notificationAction);

      var tcpConn = peerEntry.peerConnectionDictionary.get(
        ThaliMobile.connectionTypes.TCP_NATIVE);

      if (tcpConn !== null) {

        // If the peerConnectionDictionary contains a TCP_NATIVE entry then
        // create and enqueue an action for that.

        this._createAndEnqueueAction(
          peerEntry, peerStatus.peerIdentifier,
          ThaliMobile.connectionTypes.TCP_NATIVE, tcpConn);

      } else {
        // takes the entry that was just updated and create and enqueue
        // that as an action.
        var updatedConnInfo =
          peerEntry.peerConnectionDictionary.get(peerStatus.connectionType);

        this._createAndEnqueueAction(
          peerEntry, peerStatus.peerIdentifier,
          peerStatus.connectionType, updatedConnInfo);
      }
    }
  }
};
// jscs:enable maximumLineLength
/**
 * This function will remove an existing connection type from the {@link
 * module:thaliMobile.event:PeerConnectionDictionary} when the
 * peerStatus doesn't have host name or port number. If the dictionary doesn't
 * have any other connection types left then the peer will be removed.
 *
 * The prerequisites are:
 * 1. the incoming peer has no hostAddress and
 * 2. there is a record for the 'peer.peerIdentifier' already.
 *
 * @private
 * @param {module:thaliMobile~discoveryAdvertisingStatus} peerStatus
 * An incoming peer variable.
 */
ThaliNotificationClient.prototype._hostLostPeerFound = function (peerStatus) {
  var peerEntry = this.peerDictionary.get(peerStatus.peerIdentifier);

  if (peerEntry.peerState === PeerDictionary.peerState.RESOLVED) {
    // Ignore the event, if the peerState is RESOLVED
    return;
  }

  if (peerEntry.peerState === PeerDictionary.peerState.CONTROLLED_BY_POOL &&
      peerEntry.notificationAction.getActionState() ===
      PeerAction.actionState.STARTED ||
      peerEntry.notificationAction.getActionState() ===
      PeerAction.actionState.CREATED ||
      peerEntry.peerState === PeerDictionary.peerState.WAITING) {

    this._killAndUnsubscribe(peerEntry.notificationAction);
    peerEntry.peerConnectionDictionary.remove(peerStatus.connectionType);

    if (peerEntry.peerConnectionDictionary.size() > 0) {

      var prefType =
        peerEntry.peerConnectionDictionary.getPreferredConnectionType();

      var prefConn = peerEntry.peerConnectionDictionary.get(prefType);

      this._createAndEnqueueAction(
        peerEntry, peerStatus.peerIdentifier, prefType, prefConn);

    } else {
      this.peerDictionary.remove(peerStatus.peerIdentifier);
    }
  }
};

/**
 * Stops listening action's events and kills it.
 *
 * @private
 * @param {module:thaliNotificationAction~ThaliNotificationAction} action
 */
ThaliNotificationClient.prototype._killAndUnsubscribe = function (action) {
  action.eventEmitter.removeAllListeners(
    ThaliNotificationAction.Events.Resolved);
  action.kill();
};

/**
 * This function creates a new action, registers to listen its resolution,
 * and enqueues the action to the peer pool.
 *
 * @private
 * @param {module:thaliPeerDictionary~NotificationPeerDictionaryEntry} peerEntry
 * @param {string} identifier Peer identification
 * @param {module:thaliMobile~connectionTypes} connectionType The Connection
 * type that is used to register action with.
 * @param {module:thaliPeerDictionary~PeerConnectionInformation} connection
 * The connection parameter contains all connection related parameters like
 * host address.
 */
ThaliNotificationClient.prototype._createAndEnqueueAction =
  function (peerEntry, identifier, connectionType, connection) {

    var action = new ThaliNotificationAction(
      identifier, connectionType,
      this._ecdhForLocalDevice, this._addressBookCallback,
      connection);

    action.eventEmitter.on(ThaliNotificationAction.Events.Resolved,
      this._resolved.bind(this));

    peerEntry.notificationAction = action;

    try {
      this._thaliPeerPoolInterface.enqueue(action);
      this.peerDictionary.addUpdateEntry(identifier, peerEntry);

    } catch (err) {
      logger.warn('_createAndEnqueueAction: failed to enqueue item: %s', err);
    }
  };

/**
 * This function handles resolved events coming from actions.
 *
 * @private
 * @param {string} peerId Identifies the peer this action belongs to.
 * @param {module:thaliNotificationAction.ActionResolution} resolution
 * The result of the actions.
 * @param {?module:thaliNotificationBeacons~parseBeaconsResponse} beaconDetails
 * Null if none of the beacons could be validated as being targeted
 * at the local peer or if the beacon came from a remote peer the
 * local peer does not wish to communicate with. If not null then a
 * beacon has been identified to be targeted at the local peer.
 */
ThaliNotificationClient.prototype._resolved =
  function (peerId, resolution, beaconDetails) {

    if (!this.peerDictionary) {
      // Ignores the event if the peerDictionary is null
      // This happens when the stop is called.
      return;
    }
    var entry = this.peerDictionary.get(peerId);

    if (!entry) {
      // Ignore the event if the entry doesn't exists.
      return;
    }

    if (resolution ===
      ThaliNotificationAction.ActionResolution.BEACONS_RETRIEVED_AND_PARSED) {

      var connInfo = entry.notificationAction.getConnectionInformation();
      entry.peerState = PeerDictionary.peerState.RESOLVED;
      this.peerDictionary.addUpdateEntry(entry);

      // todo: this event needs to be updated
      var peerAdvertises = new PeerAdvertisesDataForUs(
        beaconDetails.unencryptedKeyId,
        'pskIdentifyField',
        [1, 2, 3],
        connInfo.getHostAddress(),
        connInfo.getPortNumber(),
        connInfo.getSuggestedTCPTimeout(),
        entry.notificationAction.getConnectionType()
      );

      this.emit(ThaliNotificationClient.Events.PeerAdvertisesDataForUs,
        peerAdvertises);

    } else if (resolution ===
      ThaliNotificationAction.ActionResolution.BEACONS_RETRIEVED_BUT_BAD) {

      // This indicates a malfunctioning peer. We need to assume they are bad
      // all up and mark their entry as RESOLVED without taking any further
      // action. This means we will ignore this peerIdentifier
      // in the future.
      entry.peerState = PeerDictionary.peerState.RESOLVED;
      this.peerDictionary.addUpdateEntry(entry);

    } else if (resolution ===
      ThaliNotificationAction.ActionResolution.HTTP_BAD_RESPONSE ||
      resolution ===
      ThaliNotificationAction.ActionResolution.NETWORK_PROBLEM) {

      // This tells us that the peer is there but not in good shape. But we
      // will give them the benefit of the doubt. We will retry after the delay
      // specified in the RETRY_TIMEOUTS array.
      var timeOutHandler = function (peerId) {
        entry = this.peerDictionary.get(peerId);
        if (entry && entry.peerState === PeerDictionary.peerState.WAITING) {
          var prefType =
            entry.peerConnectionDictionary.getPreferredConnectionType();
          var prefConn = entry.peerConnectionDictionary.get(prefType);
          this._createAndEnqueueAction(
            entry, peerId, prefType, prefConn);
        } else {
          assert(false, 'unknown state should be WAITING');
        }
      };
      var maxRetries = ThaliNotificationClient.RETRY_TIMEOUTS.length;
      if (entry.retryCounter < maxRetries) {
        entry.peerState = PeerDictionary.peerState.WAITING;

        entry.waitingTimeout = setTimeout(
          timeOutHandler.bind(this, peerId),
          ThaliNotificationClient.RETRY_TIMEOUTS[entry.retryCounter++]);

        entry.notificationAction = null;
        this.peerDictionary.addUpdateEntry(entry);
      } else {
        // Gives up after all the timeouts from the RETRY_TIMEOUTS array
        // has been spent.
        entry.peerState = PeerDictionary.peerState.RESOLVED;
        this.peerDictionary.addUpdateEntry(entry);
      }

    } else if (resolution ===
      ThaliNotificationAction.ActionResolution.KILLED) {
      // ThaliPeerPoolInterface called kill (due to resource exhaustion).
      // Having the pool kill us is a pretty extreme event, it means we
      // have so many peerIdentifiers that we blew up the pool. So at
      // that point the best thing for us to do is to just delete the
      // entire entry for this
      this.peerDictionary.remove(peerId);
    }
  };

/**
 * We use following timeouts to retry when the action fails with network
 * error.
 *
 * @public
 * @type {number[]}
 */
ThaliNotificationClient.RETRY_TIMEOUTS =
  [100, 300, 600, 1200, 2400 , 4800, 9600];

/**
 * Fired whenever we discover a peer who is looking for us.
 *
 * @public
 * @event module:thaliNotificationClient.event:peerAdvertisesDataForUs
 * @type {PeerAdvertisesDataForUs}
 */
ThaliNotificationClient.Events = {
  PeerAdvertisesDataForUs: 'peerAdvertisesDataForUs'
};

ThaliNotificationClient.Errors = {
  PEERPOOL_NOT_NULL : 'thaliPeerPoolInterface must not be null',
  EDCH_FOR_LOCAL_DEVICE_NOT_NULL : 'ecdhForLocalDevice must not be null',
  PUBLIC_KEYS_TO_LISTEN_NOT_ARRAY: 'Public keys to listen must be an array'
};

module.exports = ThaliNotificationClient;
