'use strict';

/**
 * @classdesc An class that stores PskMaps.
 *
 * @public
 * @constructor
 */
function ThaliPskMapStack() {
  this._stack = [];
}

ThaliPskMapStack.prototype.push = function (entry) {
  this.clean();
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
  for (var i = 0 ; i < this._stack.length ; i++) {
    var secret = this._stack[i][id].publicKey;
    if (secret) {
      return secret;
    }
  }
  return null;
};

/* If we are asked to add a
* dictionary and if we are all full then we must check the expiration dates on
* all the dictionaries we have and remove any expired ones. If this doesn't
* create any room then we must delete the oldest dictionary.
*/
ThaliPskMapStack.prototype.clean = function () {

  var cleanFrom = this._stack.length;

  for (var i = 0 ; i < this._stack.length ; i++) {
    if ( this._stack[i].expiration < Date.now() ) {
      cleanFrom = i;
      break;
    }
  }
  if (cleanFrom < this._stack.length ) {
    this._stack.splice(cleanFrom, this._stack.length - cleanFrom - 1);
  }
};

module.exports = ThaliPskMapStack;
