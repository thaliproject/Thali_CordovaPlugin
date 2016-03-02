'use strict';

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
 * Records information about how to connect to a peer over a particular
 * connectionType.
 *
 * @public
 * @constructor
 * @param {string} hostAddress
 * @param {number} portNumber
 * @param {number} suggestedTCPTimeout
 */
function PeerConnectionInformation (hostAddress, portNumber,
                                    suggestedTCPTimeout) {
  this._hostAddress = hostAddress;
  this._portNumber = portNumber;
  this._suggestedTCPTimeout = suggestedTCPTimeout;
}

/**
 * Peer's host address, either IP or DNS
 *
 * @private
 * @type {string}
 */
PeerConnectionInformation.prototype._hostAddress = null;

/**
 * Returns peer's host address, either IP or DNS
 *
 * @public
 * @return {string} peer's host address, either IP or DNS
 */
PeerConnectionInformation.prototype.getHostAddress = function () {
  return this._hostAddress;
};

/**
 * The port to use with the supplied host address
 *
 * @private
 * @type {number}
 */
PeerConnectionInformation.prototype._portNumber = null;

/**
 * Returns port to use with the host address
 *
 * @public
 * @return {number} port to use with the host address
 */
PeerConnectionInformation.prototype.getPortNumber = function () {
  return this._portNumber;
};

/**
 * The TCP time out to use when establishing a TCP connection with the peer.
 *
 * @private
 * @type {number}
 */
PeerConnectionInformation.prototype._suggestedTCPTimeout = null;

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

module.exports.PeerConnectionInformation = PeerConnectionInformation;

// jscs:disable maximumLineLength
/**
 * A dictionary of different connectionTypes and their associated connection
 * information.
 *
 * @typedef {Object.<module:thaliMobile.connectionTypes, module:thaliPeerDictionary~PeerConnectionInformation>} PeerConnectionDictionary
 */
// jscs:enable maximumLineLength


/**
 * An entry to be put into the peerDictionary.
 *
 * @public
 * @param {module:thaliPeerDictionary.peerState} peerState The
 * state of the peer.
 * @param {module:thaliPeerDictionary~PeerConnectionDictionary} peerConnectionDictionary A dictionary
 * of different connection types we know about for this peerIdentity
 * @param {module:thaliNotificationAction~NotificationAction} notificationAction
 * @constructor
 */
function NotificationPeerDictionaryEntry (peerState, peerConnectionDictionary,
                              notificationAction) {
  this.peerState = peerState;
  this.peerConnectionDictionary = peerConnectionDictionary;
  this.notificationAction = notificationAction;
}


/**
 * The current state of the peer
 *
 * @private
 * @type {module:thaliPeerDictionary.peerState}
 */
NotificationPeerDictionaryEntry.prototype.peerState = null;

/**
 * The current peer connection dictionary
 *
 * @private
 * @type {module:thaliPeerDictionary~PeerConnectionDictionary}
 */
NotificationPeerDictionaryEntry.prototype.peerConnectionDictionary = null;

/**
 * The notification action (if any) associated with the peer.
 *
 * @type {?module:thaliNotificationAction~NotificationAction}
 */
NotificationPeerDictionaryEntry.prototype.notificationAction = null;

module.exports.NotificationPeerDictionaryEntry =
  NotificationPeerDictionaryEntry;

/**
 * A dictionary used to manage information discovered about peers. It's only
 * difference from a typical dictionary is that we have to manage how many
 * entries are in the dictionary so that we don't overflow memory. Therefore
 * once we reach a certain number of entries any new entries will require old
 * entries to be removed.
 * @public
 * @constructor
 */
function PeerDictionary() {
  this._dictionary = [];
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
 * beyond the fixed maximum then the oldest resolved entry MUST be removed.
 * If there are no remaining resolved entries to remove then the oldest
 * waiting entry MUST be removed (and the associated timer killed). If there
 * are no remaining resolved entries to remove then kill MUST be called on the
 * oldest CONTROLLED_BY_POOL entry and it MUST be removed.
 *
 * @public
 * @param {string} peerId
 * @param {module:thaliPeerDictionary~NotificationPeerDictionaryEntry} peerTableEntry
 * @returns {?error} Null if all went well otherwise an error.
 */
PeerDictionary.prototype.addUpdateEntry = function (peerId, peerTableEntry) {

  if (this._dictionary[peerId] === undefined) {
    this._removeOldest();
    this._dictionary[peerId] = {'entry' : peerTableEntry ,
                                'entryCounter' : this._entryCounter++};
  } else {
    this._dictionary[peerId].entry = peerTableEntry;
  }
};

/**
 * Removes an entry which matches with peerId.
 * @public
 * @param {string} peerId
 */
PeerDictionary.prototype.remove = function (peerId) {
  if (this._dictionary[peerId] !== undefined) {
    delete this._dictionary[peerId];
  }
};

/**
 * Checks if the entry exists in the dictionary.
 * @public
 * @param {string} peerId
 * @returns {boolean} Returns true if the item exists, false otherwise.
 * returns an error object.
 */
PeerDictionary.prototype.exists = function (peerId) {
  if (this._dictionary[peerId] === undefined) {
    return false;
  } else {
    return true;
  }
};

/**
 * Returns the selected entry from the dictionary
 * @public
 * @param {string} peerId
 * @returns {module:thaliPeerDictionary~NotificationPeerDictionaryEntry}
 * Returns an entry that matches with the peerId. If the entry is not found
 * returns null.
 */
PeerDictionary.prototype.get = function (peerId) {
  if (this._dictionary[peerId] === undefined) {
    return null;
  } else {
    return this._dictionary[peerId].entry;
  }
};

/**
 * Deletes the selected entry from the dictionary
 * @public
 * @param {string} peerId
 */
PeerDictionary.prototype.delete = function (peerId) {
  if (this._dictionary[peerId] !== undefined) {
    delete this._dictionary[peerId];
  }
};

/**
 * Returns the size of the dictionary
 * @public
 * @returns {number} Size of the dictionary
 */
PeerDictionary.prototype.size = function () {
  return Object.keys(this._dictionary).length;
};

/**
 * If the dictionary is empty removes an entry in following order.
 * Removes the oldest resolved entry. If there are no remaining resolved
 * entries to remove then the oldest waiting entry is removed. If there
 * are no remaining resolved entries to remove then kills the
 * oldest CONTROLLED_BY_POOL entry and removes it.
 *
 * @private
 */
PeerDictionary.prototype._removeOldest = function () {
  var self = this;
  if (this.size() >= PeerDictionary.MAXSIZE) {

    var search = function (state) {
      var smallestEntryCounterVal = Number.MAX_VALUE;
      var oldestPeerId = null;
      for (var key in self._dictionary) {
        if (self._dictionary[key].entryCounter < smallestEntryCounterVal &&
            self._dictionary[key].entry.peerState === state) {
          oldestPeerId = key;
          smallestEntryCounterVal = self._dictionary[key].entryCounter;
        }
      }
      return oldestPeerId;
    };

    var oldestPeerId = search(exports.peerState.RESOLVED);

    if (oldestPeerId) {
      delete self._dictionary[String(oldestPeerId)];
      return;
    }

    oldestPeerId = search(exports.peerState.WAITING);

    if (oldestPeerId) {
      delete self._dictionary[String(oldestPeerId)];
      return;
    }

    oldestPeerId = search(exports.peerState.CONTROLLED_BY_POOL);

    if (oldestPeerId) {
      delete self._dictionary[String(oldestPeerId)];
      return;
    }
  }
};

module.exports.PeerDictionary = PeerDictionary;
