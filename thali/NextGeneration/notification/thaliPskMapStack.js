'use strict';
var thaliConfig = require('../thaliConfig');
/**
 * @classdesc An class that stores PskMaps.
 *
 * @public
 * @constructor
 */
function ThaliPskMapStack() {
  this._stack = [];
}

/**
 * Stores the dictionary into the stack.
 *
 * @public
 * @param {module:thaliNotificationBeacons~beaconStreamAndSecretDictionary} entry
 */
ThaliPskMapStack.prototype.push = function (entry) {
  this.clean(true);
  var item = { keySecret: entry, expiration : Date.now() + 200};
  this._stack.push(item);
};

/**
 * Returns the secret key associated with the ID or null if there is no match.
 *
 * @public
 * @param {string} id
 * @returns {?Buffer} The secret key associated with the ID or null if there
 * is no match.
 */
ThaliPskMapStack.prototype.getSecret = function (id) {
  this.clean(false);
  for (var i = 0 ; i < this._stack.length ; i++) {
    var secret = this._stack[i][id].pskSecret;
    if (secret) {
      return secret;
    }
  }
  return null;
};

/**
 * Returns the public key associated with the ID or null if there is no match.
 *
 * @public
 * @param {string} id
 * @returns {?Buffer} The public key associated with the ID or null if there
 * is no match.
 */
ThaliPskMapStack.prototype.getPublic = function (id) {
  this.clean(false);
  for (var i = 0 ; i < this._stack.length ; i++) {
    var secret = this._stack[i][id].publicKey;
    if (secret) {
      return secret;
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
ThaliPskMapStack.prototype.clean = function (forceRemove) {

  var cleanFrom = 0;

  for (var i = this._stack.length-1 ; i >= 0 ; i--) {
    if ( this._stack[i].expiration > Date.now() ) {
      cleanFrom = i+1;
      break;
    }
  }

  if (cleanFrom < this._stack.length ) {
    this._stack.splice(cleanFrom, this._stack.length - cleanFrom);
    return;
  }

  if (forceRemove && this._stack.length >=
    thaliConfig.MAX_NOTIFICATIONSERVER_PSK_MAP_STACK_SIZE) {
    this._stack.pop();
  }
};

module.exports = ThaliPskMapStack;
