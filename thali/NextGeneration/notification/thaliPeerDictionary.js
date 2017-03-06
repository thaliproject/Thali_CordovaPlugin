'use strict';

var assert = require('assert');
var objectAssign = require('object-assign');
var ThaliNotificationAction = require('./thaliNotificationAction.js');

/* eslint-disable max-len */

/**
 *
 * ### Changes to thaliNotificationAction.ActionResolution
 *
 * - [ ] Remove KILLED_SUPERSEDED and all related methods, calls on other
 *   objects.
 *
 * ### Changes to thaliNotificationClient._peerAvailabilityChanged
 *
 * - [ ] Call removeEntry rather than removeAllPeerEntries
 * - [ ] Call this.peerDictionary.getEntry(). If an entry exists and if badPeer
 *   is marked true then return without taking further action.
 *
 * ### changes to thaliNotificationClient._createNotificationAction
 *
 * - [ ] We MUST use addGeneration() on the entry from peerDictionary rather
 *   than manually setting values like notificationAction.
 *
 * ### Changes to thaliNotificationClient._onActionResolved
 *
 * - [ ] Make sure that regardless of the resolution we always call
 *   peerDictionary.removeGeneration so we clean up after ourselves. Once
 *   a generation's action gets to this point we don't need to track it in the
 *   dictionary anymore.
 * - [ ] We need to call getGenerationEntry at the top, not get
 * - [x] If we get BEACONS_RETRIEVED_AND_PARSED then remove the addUpdateEntry
 *   call. At the end remove the entry.
 * - [ ] Remove KILLED_SUPERSEDED
 * - [ ] If we get BEACONS_RETRIEVED_BUT_BAD or BAD_PEER then we need to call
 *   peerDictionary.getEntry() and set .badPeer to true and remove the entry.
 * - [ ] If we get HTTP_BAD_RESPONSE, NETWORK_PROBLEM or KILLED then we have to
 *   check to see if this._peerDictionary.getEntry's generationCounter is
 *   greater than the action.getPeerGeneration() value. If it is then just
 *   remove the entry and we are done. If it less than assert. If it is equal
 *   then we need to use the try logic. Note that the retry logic is now on the
 *   root entry where retryCounter and waitingTimeout are set. So we really
 *   don't need the addUpdateEntry. We can just use getEntry() and change the
 *   properties directly.
 *
 * @module thaliPeerDictionary
 */

/* eslint-enable max-len */

/**
 * @file
 *
 * Defines a dictionary for use by {@link module:thaliNotificationClient} that
 * makes sure we only track a fixed number of peers and will forget peers in
 * a defined order if we get too many of them.
 */

/**
 * @public
 * @typedef {Object} PeerEntry
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
 */

/**
 * @public
 * @typedef {Object} GenerationEntry
 * @property {module:ThaliNotificationClient~ThaliNotificationAction} notificationAction
 * Notification action associated with this peer generation
 * @property {number} entryNumber
 */

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
 * Array of PeerEntry properties that can be changed via
 * {@link module:thaliPeerDictionary~PeerDictionary#addUpdatePeerEntry|addUpdatePeerEntry}
 *
 * @public
 * @default
 * @type {string[]}
 */
PeerDictionary.entryWritableProperties =
  ['badPeer', 'waitingTimeout', 'retryCounter'];


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
 * @param {string} peerIdentifier
 * @param {Object} [data]
 * @param {boolean} [data.badPeer]
 * @param {timers.Timer?} [data.waitingTimeout]
 * @param {number} [data.retryCounter]
 */
PeerDictionary.prototype.addUpdatePeerEntry = function (peerIdentifier, data) {
  assert(peerIdentifier, 'peerIdentifier exists');

  var peerEntry = this._dictionary[peerIdentifier];
  var entryExists = Boolean(peerEntry);
  if (!entryExists) {
    peerEntry = this._createPeerEntry();
    this._dictionary[peerIdentifier] = peerEntry;
  }


  if (data) {
    var entryData = peek(data, PeerDictionary.entryWritableProperties);
    if (peerEntry.waitingTimeout && entryData.waitingTimeout) {
      // clear old timeout before overwriting
      clearTimeout(peerEntry.waitingTimeout);
    }
    objectAssign(peerEntry, entryData);
  } else {
    // Sometimes we need to just create entry with default properties.
  }

  if (!entryExists) {
    this._removeOldestIfOverflow();
  }
};

PeerDictionary.prototype.addPeerAction = function (peer, notificationAction) {
  // Create peer entry if it does not exist yet
  this.addUpdatePeerEntry(peer.peerIdentifier);
  var peerEntry = this._dictionary[peer.peerIdentifier];

  if (peerEntry.waitingTimeout) {
    clearTimeout(peerEntry.waitingTimeout);
    peerEntry.waitingTimeout = null;
  }

  assert(notificationAction, 'notificationAction exists');
  assert.equal(notificationAction.getPeerGeneration(), peer.generation,
    'notifcationAction belongs to the peer');

  peerEntry.generations[peer.generation] =
    this._createGenerationEntry(notificationAction);

  // TODO: this won't work with retry actions
  assert(peer.generation > peerEntry.generationCounter,
    'generation MUST increase');
  peerEntry.generationCounter = peer.generation;
};

PeerDictionary.prototype._createPeerEntry = function () {
  return {
    badPeer: false,
    waitingTimeout: null,
    retryCounter: 0,
    generationCounter: null,
    generations: Object.create(null),
  };
};

PeerDictionary.prototype._createGenerationEntry =
  function (notificationAction) {
    this._entryCounter++;
    return {
      notificationAction: notificationAction,
      entryNumber: this._entryCounter,
    };
  };

/**
 * Removes a generation entry which matches with the peer.
 *
 * @public
 * @param {Object} peer
 * @param {string} peer.peerIdentifier
 * @param {number} peer.generation
 */
PeerDictionary.prototype.removePeerAction = function (peer) {
  assert(peer.peerIdentifier, 'peer.peerIdentifier must be set');
  assert.equals(typeof peer.generation, 'number',
    'peer.generation must be a number');

  var peerEntry = this._dictionary[peer.peerIdentifier];
  var generationEntry = peerEntry ?
    peerEntry.generations[peer.generation] :
    null;

  if (!generationEntry) {
    return;
  }

  var action = generationEntry.notificationAction;
  action.eventEmitter.removeAllListeners(
    ThaliNotificationAction.Events.Resolved
  );
  action.kill();
  delete peerEntry[peer.generation];
};

PeerDictionary.prototype.removePeerEntry = function (peerIdentifier) {
  var peerEntry = this._dictionary[peerIdentifier];
  if (!peerEntry) {
    return;
  }

  Object.keys(peerEntry.generations).forEach(function (generation) {
    this.removePeerAction({
      peerIdentifier: peerIdentifier,
      generation: Number(generation),
    });
  }, this);

  if (peerEntry.waitingTimeout) {
    clearTimeout(peerEntry.waitingTimeout);
  }

  delete this._dictionary[peerIdentifier];
};

/**
 * Removes all entries from the dictionary.
 * @public
 */
PeerDictionary.prototype.removeAll = function () {
  Object.keys(this._dictionary).forEach(function (peerIdentifier) {
    this.removePeerEntry(peerIdentifier);
  }, this);
};

/**
 * Returns a notification action that matches with the peerId.
 *
 * @public
 * @param {Object} peer
 * @param {string} peer.peerIdentifier
 * @param {number} peer.generation
 * @returns {module:thaliNotificationAction~ThaliNotificationAction?}
 * Returns a notification action that matches with the peerId. If the entry is
 * not found returns null.
 */
PeerDictionary.prototype.getPeerAction = function (peer) {
  assert(peer.peerIdentifier, 'peer.peerIdentifier must be set');
  assert(typeof peer.generation === 'number',
    'peer.generation must be a number');

  var peerEntry = this._dictionary[peer.peerIdentifier];
  var generationEntry = peerEntry ?
    peerEntry.generations[peer.generation] :
    null;

  return generationEntry ?
    generationEntry.notificationAction :
    null;
};

var peerPrivateProperties = ['generations'];
PeerDictionary.prototype.getPeerEntry = function (peerIdentifier) {
  assert(peerIdentifier, 'peerIdentifier exists');

  var peerEntry = this._dictionary[peerIdentifier];
  if (!peerEntry) {
    return null;
  }
  return omit(peerEntry, peerPrivateProperties);
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
    var actionsCount = Object.keys(dict[peerIdentifier].generations).length;
    // It is possible to have peer entry without any associated actions but it
    // should still count as at least one entry;
    return total + Math.min(actionsCount, 1);
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
  var result = {};
  var prop;
  for (var i = 0; i < props.length; i++) {
    prop = props[i];
    if (has(obj, prop)) {
      result[prop] = obj[prop];
    }
  }
  return result;
}

function omit(obj, props) {
  var result = {};
  var keys = Object.keys(obj);
  var key;

  for (var i = 0; i < keys.length; i++) {
    key = keys[i];
    if (props.indexOf(key) === -1) {
      result[key] = obj[key];
    }
  }
  return result;
}

module.exports.PeerDictionary = PeerDictionary;
