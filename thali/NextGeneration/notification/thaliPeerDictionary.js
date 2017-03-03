'use strict';

var assert = require('assert');
var objectAssign = require('object-assign');
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
 * @public
 * @typedef {Object} PeerDictionaryEntry
 * @property {boolean} badPeer Marks this peer as 'bad' one. Notification client
 * marks peer 'bad' when it sent invalid beacons that client couldn't parse.
 * @property {?timeoutObject} waitingTimeout The waiting timeout object is used
 * when the peer notification action is failed and it is waiting to be enqueued
 * again.
 * @property {number} retryCounter The retry number. Notification client
 * increments this after each retry and uses it to limit the total number of
 * action retries.
 * @property {number?} generationCounter The latest AND highest peer generation
 * number added to the dictionary.
 * @property {module:ThaliNotificationClient~ThaliNotificationAction} notificationAction
 * Notification action associated with this peer generation
 */

/**
 * Entry that contains data associated with specific generation of some peer
 *
 * @private
 * @typedef {Object} GenerationPeerEntry
 * @property {module:ThaliNotificationClient~ThaliNotificationAction} notificationAction
 * @property {number} entryNumber
 */

/**
 * @classdesc An internal representation of entry to be put into the
 * peerDictionary. Contains data associated with some peer
 *
 * @private
 * @constructor
 */
function PeerEntry() {
  // TODO: this class should not be exposed. All entries must be associated with
  // some peer dictionary because generations map uses entryCounter to set
  // entryNumber.

  /** @type {boolean} */
  this.badPeer = false;

  /** @type {?timeoutObject} */
  this.waitingTimeout = null;

  /** @type {number} */
  this.retryCounter = 0;

  /** @type {number?} */
  this.generationCounter = null;

  /**
   * Maps peer generations to the corresponding notification actions
   * @private
   * @type {Object.<string, GenerationPeerEntry>}
   */
  this.generations = Object.create(null);
}

/**
 * @public
 * @param {number} generation
 * @param {module:thaliNotificationClient~ThaliNotificationAction} notificationAction
 */
PeerEntry.prototype.addGeneration =
function (generation, notificationAction) {
  // TODO: notificationAction is already associated with the peer generation.
  // Maybe we should change "generations" to "actions" and store just actions?
  // addGeneration(generation, notificationAction) and
  // deleteGeneration(generation) will become addAction(notificationAction) and
  // deleteAction(notificationAction).
  assert(notificationAction.getPeerGeneration() === generation,
    'notification action belongs to the correct peer generation');
  assert(generation > this.generationCounter, 'generation increases');

  this.generations[generation] = {
    notificationAction: notificationAction
  };
};


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
  this._dictionary = Object.create(null);
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
 * @param {Object} peer
 * @param {string} peer.peerIdentifier
 * @param {number} peer.generation
 * @param {module:thaliPeerDictionary~PeerDictionaryEntry} entry
 * Entry to be added.
  */
PeerDictionary.prototype.addUpdateEntry = function (peer, entry) {
  var peerIdentifier = peer.peerIdentifier;
  assert(peerIdentifier, 'peer.peerIdentifier must be set');

  var generation = peer.generation;
  assert(typeof generation === 'number', 'peer.generation must be a number');

  var peerProperties = ['badPeer', 'waitingTimeout', 'retryCounter'];

  var peerEntryData = peek(entry, peerProperties);
  var notificationAction = entry.notificationAction;

  var peerEntry = this._dictionary[peerIdentifier];
  if (!peerEntry) {
    peerEntry = new PeerEntry();
    this._dictionary[peerIdentifier] = peerEntry;
  }
  objectAssign(peerEntry, peerEntryData);

  var generationEntry = peerEntry.generations[generation];
  if (generationEntry) {
    if (!notificationAction) {
      throw new Error('New peer entry must have notification action.');
    }
    generationEntry = {
      notificationAction: null,
      entryNumber: this._entryCounter++,
    };
    peerEntry.generations[generation] = generationEntry;
  }

  if (generationEntry.notificationAction) {
    generationEntry.notificationAction.kill();
  }


  var newPeerWillBeAdded = true;
  var peerEntries = this._dictionary[peerIdentifier];
  if (peerEntries) {
    var oldPeer = peerEntries[generation];
    if (oldPeer) {
      // peer will be updated.
      newPeerWillBeAdded = false;

      if (oldPeer.entry !== entry) {
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
    entry:          entry,
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
 * @returns {module:thaliPeerDictionary~PeerEntry}
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


  // TODO: review this order, e.g. we probably should remove entries without
  // generations first, also we should somehow handle 'bad' peers
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

function has(obj, prop) {
  return Object.prototype.hasOwnProperty.call(obj, prop);
}

function peek(obj, props) {
  var result = {}, prop;
  for (var i = 0; i < props.length; i++) {
    prop = props[i];
    if (has(obj, prop)) {
      result[prop] = obj[prop];
    }
  }
  return result;
}

module.exports.PeerDictionary = PeerDictionary;
