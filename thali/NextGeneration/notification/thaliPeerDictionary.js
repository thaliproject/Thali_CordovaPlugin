'use strict';

var ThaliNotificationAction = require('./thaliNotificationAction.js');

/** @module thaliPeerDictionary */

/**
 * @file
 *
 * Defines a dictionary for use by {@link module:thaliNotificationClient} that
 * makes sure we only track a fixed number of peers and will forget peers in
 * a defined order if we get too many of them.
 */

/**
 * Enum to record the state of trying to get the notification beacons for the
 * associated peerIdentifier
 *
 * @public
 * @readonly
 * @enum {string}
 */
module.exports.peerState = {
  /** The notification beacons for this peerID have been successfully
   * retrieved.
   */
  RESOLVED: 'resolved',
  /** The notification action is under the control of the peer pool so we have
   * to check the notification action to find out its current state.
   */
  CONTROLLED_BY_POOL: 'controlledByPool',
  /** A request to get the notification beacons for this peer failed and we
   * are now waiting before enqueuing a new request.
   */
  WAITING: 'waiting'
};

/**
 * @classdesc Records information about how to connect to a peer
 * over a particular connectionType.
 *
 * @public
 * @constructor
 * @param {module:ThaliMobileNativeWrapper.connectionTypes} connectionType
 * @param {string} hostAddress
 * @param {number} portNumber
 * @param {number} suggestedTCPTimeout
 */
function PeerConnectionInformation(connectionType, hostAddress,
                                   portNumber, suggestedTCPTimeout) {
  this._connectionType = connectionType;
  this._hostAddress = hostAddress;
  this._portNumber = portNumber;
  this._suggestedTCPTimeout = suggestedTCPTimeout ||
    PeerConnectionInformation.DEFAULT_TCP_TIMEOUT;
}

/**
 * Returns peer's host address, either IP or DNS.
 *
 * @public
 * @return {string} peer's host address, either IP or DNS
 */
PeerConnectionInformation.prototype.getHostAddress = function () {
  return this._hostAddress;
};


/**
 * Returns port to use with the host address.
 *
 * @public
 * @return {number} port to use with the host address.
 */
PeerConnectionInformation.prototype.getPortNumber = function () {
  return this._portNumber;
};

/**
 * Returns TCP time out to use when establishing a TCP connection with the
 * peer.
 *
 * @public
 * @return {number} TCP time out
 */
PeerConnectionInformation.prototype.getSuggestedTCPTimeout = function () {
  return this._suggestedTCPTimeout;
};

/**
 * Returns the connection type that we use to communicate with the peer.
 *
 * @public
 * @return {module:ThaliMobileNativeWrapper.connectionTypes} TCP time out
 */
PeerConnectionInformation.prototype.getConnectionType = function () {
  return this._connectionType;
};

/**
 * This is default TCP timeout that is used if suggestedTCPTimeout is
 * not defined for the PeerConnectionInformation.
 * @type {number}
 * @readonly
 */
PeerConnectionInformation.DEFAULT_TCP_TIMEOUT = 2000;

module.exports.PeerConnectionInformation = PeerConnectionInformation;


// jscs:disable maximumLineLength
/**
 * @classdesc An entry to be put into the peerDictionary.
 *
 * @public
 * @param {module:thaliPeerDictionary.peerState} peerState The
 * state of the peer.
 * @param {module:thaliPeerDictionary~PeerConnectionInformation} peerConnection connection
 * information that use to connect to the peer.
 * @param {module:thaliNotificationAction~NotificationAction} notificationAction
 * @constructor
 */
// jscs:enable maximumLineLength
function NotificationPeerDictionaryEntry(peerState, notificationAction) {
  this.peerState = peerState;
  this.notificationAction = notificationAction;
  this.waitingTimeout = null;
  this.retryCounter = 0;
}

/**
 * The current state of the peer
 *
 * @public
 * @type {module:thaliPeerDictionary.peerState}
 */
NotificationPeerDictionaryEntry.prototype.peerState = null;

/**
 * The notification action (if any) associated with the peer.
 *
 * @public
 * @type {?module:thaliNotificationAction~NotificationAction}
 */
NotificationPeerDictionaryEntry.prototype.notificationAction = null;

/**
 * The waiting timeout object is used when the peer is in WAITING
 * state before enqueuing a new request.
 *
 * @public
 * @type {?timeoutObject}
 */
NotificationPeerDictionaryEntry.prototype.waitingTimeout = null;

/**
 * The retry number.
 *
 * @public
 * @type {number}
 */
NotificationPeerDictionaryEntry.prototype.retryCounter = null;

module.exports.NotificationPeerDictionaryEntry =
  NotificationPeerDictionaryEntry;

/**
 * @classdesc This class manages a dictionary of discovered peers. It manages
 * how many entries are in the dictionary so that we don't overflow memory.
 * Therefore once we reach a certain number of entries any new entries
 * will cause old entries to be removed.
 *
 * @public
 * @constructor
 */
function PeerDictionary() {
  this._dictionary = {};
  this._entryCounter = 0;
}

/**
 * Maximum size of the dictionary
 *
 * @public
 * @readonly
 * @type {number}
 */
PeerDictionary.MAXSIZE = 100;

/**
 * Adds the entry if the peerId isn't yet in the table otherwise updates the
 * existing entry. If the new entry will increase the size of the dictionary
 * beyond the fixed maximum then the oldest resolved entry is removed.
 * If there are no remaining resolved entries to remove then the oldest
 * waiting entry is removed. If there are no remaining resolved entries to
 * remove then kill is called on the oldest CONTROLLED_BY_POOL entry
 * and it is removed.
 *
 * @public
 * @param {string} peerId
 * @param {module:thaliPeerDictionary~NotificationPeerDictionaryEntry} entry
 * Entry to be added.
  */
PeerDictionary.prototype.addUpdateEntry = function (peerId, entry) {
  if (this._dictionary[peerId]) {
    this._dictionary[peerId].entry = entry;
    this._dictionary[peerId].entryNumber = this._entryCounter++;
  } else {
    this._removeOldestIfOverflow();
    this._dictionary[peerId] = {
      'entry' : entry,
      'entryNumber' : this._entryCounter++
    };
  }
};

/**
 * Removes an entry which matches with the peerId.
 *
 * Errors:
 *
 * 'entry not found' - can't remove an entry because it is not
 * found.
 *
 * @public
 * @param {string} peerId
 */
PeerDictionary.prototype.remove = function (peerId) {
  var entry = this.get(peerId);
  if (!entry) {
    return;
  }
  entry.waitingTimeout && clearTimeout(entry.waitingTimeout);
  entry.notificationAction &&
    entry.notificationAction.eventEmitter.removeAllListeners(
    ThaliNotificationAction.Events.Resolved);
  entry.notificationAction && entry.notificationAction.kill();
  delete this._dictionary[peerId];
};

/**
 * Removes all entries from the dictionary.
 * @public
 */
PeerDictionary.prototype.removeAll = function () {
  var self = this;
  Object.keys(this._dictionary).forEach(function (key) {
    self.remove(key);
  });
};

/**
 * Checks if the entry exists in the dictionary.
 *
 * @public
 * @param {string} peerId
 * @returns {boolean} Returns true if the entry exists, false otherwise.
 */
PeerDictionary.prototype.exists = function (peerId) {
  return this._dictionary[peerId] !== undefined;
};

/**
 * Returns an entry from the dictionary which matches with the peerId.
 *
 * @public
 * @param {string} peerId ID of the entry that is returned.
 * @returns {module:thaliPeerDictionary~NotificationPeerDictionaryEntry}
 * Returns an entry that matches with the peerId. If the entry is not found
 * returns null.
 */
PeerDictionary.prototype.get = function (peerId) {
  var entryObject = this._dictionary[peerId];
  return entryObject ? entryObject.entry : null;
};

/**
 * Returns the size of the dictionary.
 *
 * @public
 * @returns {number} Size of the dictionary
 */
PeerDictionary.prototype.size = function () {
  return Object.keys(this._dictionary).length;
};

/**
 * If the dictionary is full this function removes an entry
 * in the following order. Removes the oldest resolved entry.
 * If there are no remaining resolved entries to remove then
 * the oldest waiting entry is removed. If there are no
 * remaining resolved entries to remove then kills the
 * oldest CONTROLLED_BY_POOL entry and removes it.
 *
 * @private
 */
PeerDictionary.prototype._removeOldestIfOverflow = function () {
  var self = this;

  if (this.size() < PeerDictionary.MAXSIZE) {
    return;
  }

  var search = function (state) {
    var smallestEntryNumber = self._entryCounter;
    var oldestPeerId = null;
    for (var key in self._dictionary) {
      if (self._dictionary[key].entryNumber < smallestEntryNumber &&
          self._dictionary[key].entry.peerState === state) {
        oldestPeerId = key;
        smallestEntryNumber = self._dictionary[key].entryNumber;
      }
    }
    return oldestPeerId;
  };

  // First search for the oldest RESOLVED entry
  var oldestPeerId = search(exports.peerState.RESOLVED);

  if (oldestPeerId) {
    self.remove(oldestPeerId);
    return;
  }

  // Next search for the oldest WAITING entry
  oldestPeerId = search(exports.peerState.WAITING);

  if (oldestPeerId) {
    self.remove(oldestPeerId);
    return;
  }

  // As a last search for the oldest CONTROLLED_BY_POOL entry
  oldestPeerId = search(exports.peerState.CONTROLLED_BY_POOL);

  if (oldestPeerId) {
    self.remove(oldestPeerId);
    return;
  }
};

module.exports.PeerDictionary = PeerDictionary;
