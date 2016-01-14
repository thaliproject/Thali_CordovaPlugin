"use strict";

/** @module thaliNotificationBeacons */

/*
Matt: Please make sure to see if you can find Srikanth's code in Node and of
course you can look at the Java source code and tests linked to in the spec, the
latest version of which is at
https://github.com/thaliproject/thali/blob/yaronyg-patch-4/presenceprotocolforop
portunisticsynching.md
 */

/**
 * This function will generate a buffer containing the notification preamble and
 * beacons for the given set of public keys using the supplied private key and
 * set to the specified seconds until expiration.
 * @param {string[]} publicKeysToNotify - An array of strings holding base64 url
 * safe encoded ECDH public keys
 * @param {ECDH} ecdhForLocalDevice - A Crypto.ECDH object initialized with the
 * local device's public and private keys
 * @param {number} secondsUntilExpiration - The number of seconds into the
 * future after which the beacons should expire.
 * @returns {Buffer} - A buffer containing the serialized preamble and beacons
 */
module.exports.generatePreambleAndBeacons = function (publicKeysToNotify,
                                                      ecdhForLocalDevice,
                                                      secondsUntilExpiration) {
  // This implements the generateBeacons function from the specs. I don't take
  // the IV or Ke as arguments because those can be generated inside the
  // function. Note that you will need to use crypto.ECDH to implement this
  // functionality which was introduced in Node 0.12 and isn't in JXcore yet. So
  // for now please just develop using Node 0.12 or Node 4 until we get this
  // back ported to JXcore. The complication with using Node 0.12 is that it
  // won't have the custom extension we need to crypto that JXcore provided to
  // support HKDF. See
  // http://jxcore.com/docs/crypto.html#cryptogeneratehkdfbytestogenerate-public
  // ke y-salt-digestbuffer The work around is to use
  // https://www.npmjs.com/package/node-hkdf but we *MUST* remove this quickly
  // because it doesn't have a published license.
  return new Buffer();
};

/**
 * Generates a single beacon using the specified values.
 * @param {string} publicKey - This is a base64 url safe encoded public key we
 * need to create a beacon for
 * @param {ECDH} ecdhWithPrivateKey - A Crypto.ECDH object initialized with the
 * local device's public and private keys
 * @param {Buffer} IV - The IV to use for this beacon (we use the same IV for
 * all beacons)
 * @param {ECDH} Ke - A Crypto.ECDH object initialized with the public and
 * private ephemeral key
 * @param {Buffer} expirationValue - The calculated expirationValue used the
 * pre-amble that pairs with this beacon
 * @returns {Buffer} - A buffer containing the beacon
 */
function generateBeacon(publicKey, ecdhWithPrivateKey, IV, Ke, expirationValue)
{
  return new Buffer();
}

/**
 * This callback is used to lookup if the public key hash retrieved from a
 * notification beacon belongs to a peer that the local peer wishes to talk to.
 * If not the callback will return null. If so then the callback will return the
 * full public key for the remote peer. In other words, there is an explicit
 * assumption that the caller has an address book mapping hashes of public keys
 * with the full public keys. The hashes are in the beacon and this function is
 * used to retrieve the full public key so that the beacon validation process
 * can complete.
 * @callback addressBookCallback
 * @param {Buffer} unencryptedKeyId - This is a Buffer containing the
 * unencryptedKeId.
 * @returns {string} - The base64 url safe encoded public key associated with
 * the unecryptedKeyId or null if the remote peer is not one the local peer
 * recognizes or wishes to communicate with.
 */

/**
 * Response object describing a successfully parsed beacon.
 *
 * The definition of pskIdentifyField and psk are as given
 * [here](https://github.com/thaliproject/thali/blob/gh-pages/pages/documentation/PresenceProtocolForOpportunisticSynching.md#processing-the-pre-amble-and-beacons).
 *
 * @public
 * @constructor
 * @param {buffer} keyId The buffer contains the HKey as defined
 * [here](https://github.com/thaliproject/thali/blob/gh-pages/pages/documentatio
 * n/PresenceProtocolForOpportunisticSynching.md#processing-the-pre-amble-and-be
 * acons).
 * @param {string} pskIdentifyField This is the value to put in the PSK identity
 * field of the ClientKeyExchange message when establishing a TLS connection
 * using PSK. This value is generated
 * @param {buffer} psk This is the calculated pre-shared key that will be needed
 * to establish a TLS PSK connection.
 */

function ParseBeaconsResponse(keyId, pskIdentifyField, psk) {
  this.keyId = keyId;
  this.pskIdentifyField = pskIdentifyField;
  this.psk = psk;
}

/**
 * @private
 * @type {buffer}
 */
ParseBeaconsResponse.prototype.keyId = null;

ParseBeaconsResponse.prototype.getKeyId = function () {
  return this.keyId;
};

/**
 * @private
 * @type {string}
 */
ParseBeaconsResponse.prototype.pskIdentifyField = null;

ParseBeaconsResponse.prototype.getPskIdentifyField = function () {
  return this.pskIdentifyField;
};

/**
 * @private
 * @type {buffer}
 */
ParseBeaconsResponse.prototype.psk = null;

ParseBeaconsResponse.prototype.getPsk = function () {
  return this.psk;
};

module.exports.ParseBeaconsResponse = ParseBeaconsResponse;

/**
 *
 * @public
 * @param {Buffer} beaconStreamWithPreAmble - A buffer stream containing the
 * preamble and beacons
 * @param {Crypto.ECDH} ecdhForLocalDevice - A Crypto.ECDH object initialized
 * with the local device's public and private keys
 * @param {addressBookCallback} addressBookCallback - A callback used by the
 * function to determine if the identified remote peer's public key hash
 * represents a remote peer the local peer wishes to communicate with.
 * @returns {module:thaliNotificationBeacons~ParseBeaconsResponse} - Null if
 * none of the beacons could be validated as being targeted at the local peer or
 * if the beacon came from a remote peer the local peer does not wish to
 * communicate with. Otherwise a {@type ParseBeaconsResponse}.
 */
module.exports.parseBeacons = function (beaconStreamWithPreAmble,
                                        ecdhForLocalDevice,
                                        addressBookCallback) {
  // Unlike the pseudo code this function assumes it will be passed the entire
  // preamble and beacon stream. Therefore the PubKe and the expiration can be
  // parsed out of the beaconStreamWithPreAmble as defined in the spec.
  return null;
};
