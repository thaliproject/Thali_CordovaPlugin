'use strict';

var assert = require('assert');
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
 * @classdesc An entry to be put into the peerDictionary.
 *
 * @public
 * @constructor
 */
function NotificationPeerDictionaryEntry() {
  this.notificationAction = null;
  this.waitingTimeout = null;
  this.retryCounter = 0;
}

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
 * @param {Object} newPeer
 * @param {string} newPeer.peerIdentifier
 * @param {number} newPeer.generation
 * @param {module:thaliPeerDictionary~NotificationPeerDictionaryEntry} newEntry
 * Entry to be added.
  */
PeerDictionary.prototype.addUpdateEntry =
  function (newPeer, newEntry) {
    var peerIdentifier = newPeer.peerIdentifier;
    assert(peerIdentifier, 'peer.peerIdentifier must be set');

    var generation = newPeer.generation;
    assert(typeof generation === 'number', 'peer.generation must be a number');

    var newPeerWillBeAdded = true;
    var peerEntries = this._dictionary[peerIdentifier];
    if (peerEntries) {
      var oldPeer = peerEntries[generation];
      if (oldPeer) {
        // peer will be updated.
        newPeerWillBeAdded = false;

        if (oldPeer.entry !== newEntry) {
          this._removeEntry(oldPeer.entry);
        }
      }
    }

    if (newPeerWillBeAdded) {
      this._removeOldestIfOverflow();
    }

    var peerEntries = this._dictionary[peerIdentifier];
    if (!peerEntries) {
      peerEntries = this._dictionary[peerIdentifier] = {};
    }
    peerEntries[generation] = {
      peerIdentifier: peerIdentifier,
      generation:     generation,
      entry:          newEntry,
      entryNumber:    this._entryCounter++
    };
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
 * @param {Object} peer
 * @param {string} peer.peerIdentifier
 * @param {number} peer.generation
 */
PeerDictionary.prototype.remove = function (peer) {
  assert(peer.peerIdentifier, 'peer.peerIdentifier must be set');
  assert(typeof peer.generation === 'number',
    'peer.generation must be a number');

  var entry = this.get(peer);
  if (!entry) {
    return;
  }
  this._removeEntry(entry);

  var peerEntries = this._dictionary[peer.peerIdentifier];
  delete peerEntries[peer.generation];
  if (Object.keys(peerEntries).length === 0) {
    delete this._dictionary[peer.peerIdentifier];
  }
};

PeerDictionary.prototype._removeEntry = function (entry) {
  if (entry.waitingTimeout) {
    clearTimeout(entry.waitingTimeout);
  }
  if (entry.notificationAction) {
    entry.notificationAction.eventEmitter.removeAllListeners(
      ThaliNotificationAction.Events.Resolved
    );
    entry.notificationAction.kill();
  }
};

PeerDictionary.prototype.removeAllPeerEntries = function (peerIdentifier) {
  var peerEntries = this._dictionary[peerIdentifier];
  if (!peerEntries) {
    return;
  }
  Object.keys(peerEntries).forEach(function (generation) {
    this.remove({
      peerIdentifier: peerIdentifier,
      generation: Number(generation),
    });
  }, this);
};

/**
 * Removes all entries from the dictionary.
 * @public
 */
PeerDictionary.prototype.removeAll = function () {
  var self = this;
  Object.keys(this._dictionary).forEach(function (peerIdentifier) {
    self.removeAllPeerEntries(peerIdentifier);
  });
};

/**
 * Checks if the entry exists in the dictionary.
 *
 * @public
 * @param {Object} peer
 * @param {string} peer.peerIdentifier
 * @param {number} peer.generation
 * @returns {boolean} Returns true if the entry exists, false otherwise.
 */
PeerDictionary.prototype.exists = function (peer) {
  assert(peer.peerIdentifier, 'peer.peerIdentifier must be set');
  assert(typeof peer.generation === 'number',
    'peer.generation must be a number');

  var peerEntries = this._dictionary[peer.peerIdentifier];
  return (
    peerEntries !== undefined &&
    peerEntries[peer.generation] !== undefined
  );
};

/**
 * Returns an entry from the dictionary which matches with the peerId.
 *
 * @public
 * @param {Object} peer
 * @param {string} peer.peerIdentifier
 * @param {number} peer.generation
 * @returns {module:thaliPeerDictionary~NotificationPeerDictionaryEntry}
 * Returns an entry that matches with the peerId. If the entry is not found
 * returns null.
 */
PeerDictionary.prototype.get = function (peer) {
  assert(peer.peerIdentifier, 'peer.peerIdentifier must be set');
  assert(typeof peer.generation === 'number',
    'peer.generation must be a number');

  var peerEntries = this._dictionary[peer.peerIdentifier];
  var entryObject = peerEntries ? peerEntries[peer.generation] : null;
  return entryObject ? entryObject.entry : null;
};

/**
 * Returns the size of the dictionary.
 *
 * @public
 * @returns {number} Size of the dictionary
 */
PeerDictionary.prototype.size = function () {
  var dict = this._dictionary;
  return Object.keys(dict).reduce(function (total, peerIdentifier) {
    return total + Object.keys(dict[peerIdentifier]).length;
  }, 0);
};

PeerDictionary.prototype._values = function () {
  var dict = this._dictionary;
  return Object.keys(dict).reduce(function (result, peerIdentifier) {
    var peerEntries = dict[peerIdentifier];
    var entryObjects = Object.keys(peerEntries).map(function (generation) {
      return peerEntries[generation];
    });
    return result.concat(entryObjects);
  }, []);
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

  var search = function (filterFn) {
    var smallestEntryNumber = self._entryCounter;
    var oldestEntryObject = null;

    self._values().filter(function (entryObject) {
      return filterFn(entryObject.entry);
    }).forEach(function (entryObject) {
      if (entryObject.entryNumber < smallestEntryNumber) {
        oldestEntryObject = entryObject;
        smallestEntryNumber = entryObject.entryNumber;
      }
    });

    if (!oldestEntryObject) {
      return null;
    }

    return {
      peerIdentifier: oldestEntryObject.peerIdentifier,
      generation: oldestEntryObject.generation
    };
  };

  var oldestPeer =
    // First search for the oldest failed entry (with retry timeout)
    search(function (entry) {
      return entry.waitingTimeout !== null;
    }) ||
    // then search all other entries
    search(function (entry) {
      return entry.waitingTimeout === null;
    });

  // if it does not exists then either MAXSIZE is 0 or there is something wrong
  // with entryNumber field
  assert(oldestPeer, 'oldest peer should exists');
  this.remove(oldestPeer);
};

module.exports.PeerDictionary = PeerDictionary;
