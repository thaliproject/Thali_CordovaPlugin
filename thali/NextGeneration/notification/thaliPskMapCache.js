'use strict';
var thaliConfig = require('../thaliConfig');

/** @module thaliPskMapCache */

/**
 * @classdesc An class that stores PskMaps. When new entries are added into the
 * cache object or existing entries are fetched from it we always check if
 * there are expired items. If expired items are found they will be removed.
 *
 * @public
 * @constructor
 * @param {number} millisecondsUntilExpiration The number of milliseconds into
 * the future after which the dictionary should expire.
 */
function ThaliPskMapCache(millisecondsUntilExpiration) {
  this._queue = [];
  this._millisecondsUntilExpiration = millisecondsUntilExpiration;
}

// jscs:disable maximumLineLength
/**
 * Stores the dictionary into the cache. And removes expired items.
 *
 * @public
 * @param {module:thaliNotificationBeacons~beaconStreamAndSecretDictionary} dictionary
 */
// jscs:enable maximumLineLength
ThaliPskMapCache.prototype.push = function (dictionary) {
  this.clean(true);
  var item = { keySecret: dictionary, expiration : Date.now() +
    this._millisecondsUntilExpiration - 200};
  this._queue.push(item);
};

/**
 * Returns the secret key associated with the ID or null if there is no match.
 * And removes expired items.
 *
 * @public
 * @param {string} id
 * @returns {?Buffer} The secret key associated with the ID or null if there
 * is no match.
 */
ThaliPskMapCache.prototype.getSecret = function (id) {
  this.clean(false);
  for (var i = this._queue.length - 1 ; i >= 0 ; i--) {
    if (this._queue[i].keySecret[id] &&
      this._queue[i].keySecret[id].pskSecret) {
      return this._queue[i].keySecret[id].pskSecret;
    }
  }
  return null;
};

/**
 * Returns the public key associated with the ID or null if there is no match.
 * And removes expired items.
 *
 * @public
 * @param {string} id
 * @returns {?Buffer} The public key associated with the ID or null if there
 * is no match.
 */
ThaliPskMapCache.prototype.getPublic = function (id) {
  this.clean(false);
  for (var i = this._queue.length - 1 ; i >= 0 ; i--) {
    if (this._queue[i].keySecret[id] &&
      this._queue[i].keySecret[id].publicKey) {
      return this._queue[i].keySecret[id].publicKey;
    }
  }
  return null;
};

/**
 * Cleans expired items from the dictionary.
 *
 * @public
 * @param {?boolean} forceRemove Forces to remove at least one item from the
 * dictionary, if it is full.
 */
ThaliPskMapCache.prototype.clean = function (forceRemove) {
  var clearCount = 0;
  var now = Date.now();

  for ( var i = 0 ; i < this._queue.length ; i++) {
    if (this._queue[i].expiration < now ) {
      clearCount = i+1;
    } else {
      break;
    }
  }

  if (clearCount > 0 ) {
    this._queue.splice(0, clearCount);
    return;
  }

  if (forceRemove && this._queue.length >=
    thaliConfig.MAX_NOTIFICATIONSERVER_PSK_MAP_CACHE_SIZE) {
    this._queue.shift();
  }
};

module.exports = ThaliPskMapCache;
