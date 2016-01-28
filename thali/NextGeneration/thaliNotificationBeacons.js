'use strict';

var crypto = require('crypto');
var HKDF = require('./hkdf');

// Constants
var SHA256 = 'sha256';
var SECP256K1 = 'secp256k1';
/*
TODO: Revisit GCM when available in JXcore
http://code.runnable.com/VGaBmn68rzMa5p9K/aes-256-gcm-nodejs-encryption-for-node-js-and-hello-world
*/
var GCM = 'aes-128';

/*
Latest version of spec https://github.com/thaliproject/thali/blob/gh-pages/pages/documentation/PresenceProtocolForOpportunisticSynching.md
*/
function NotificationBeacons() {}

/**
 * This function will generate a buffer containing the notification preamble and
 * beacons for the given set of public keys using the supplied private key and
 * set to the specified seconds until expiration.
 * @param {buffer[]} publicKeysToNotify - An array of buffers holding ECDH
 * public keys.
 * @param {ECDH} ecdhForLocalDevice - A Crypto.ECDH object initialized with the
 * local device's public and private keys
 * @param {number} secondsUntilExpiration - The number of seconds into the
 * future after which the beacons should expire.
 * @returns {Buffer} - A buffer containing the serialized preamble and beacons
 */
NotificationBeacons.prototype.generatePreambleAndBeacons =
  function(publicKeysToNotify, ecdhForLocalDevice, secondsUntilExpiration) {
    var beacons = [];

    var ke = crypto.createECDH(SECP256K1);

    // Generate preamble
    var kePublic = ke.generateKeys();
    var expiration = new Buffer(8); // Ensure 64-bit integer buffer
    expiration.fill(0);             // Don't be stupid and not zero the buffer
    expiration.writeUInt32BE(secondsUntilExpiration >> 8, 0);     // Write the high order bits
    expiration.writeUInt32BE(secondsUntilExpiration & 0x00ff, 4); // Write the low order bits
    beacons.push(Buffer.concat(kePublic, expiration));

    // UnencryptedKeyId = SHA256(Kx.public().encode()).first(16)
    var unencryptedKeyId = crypto.createHash(SHA256);
    unencryptedKeyId.update(ecdhForLocalDevice.getPublicKey());
    unencryptedKeyId = unencryptedKeyId.digest().slice(0, 16);

    for (var i = 0, len = publicKeysToNotify.length; i < len; i++) {
      var pubKey = publicKeysToNotify[i];

      // Sxy = ECDH(Kx.private(), PubKy)
      var sxy = crypto.createECDH(SECP256K1);
      sxy.setPrivateKey(ecdhForLocalDevice.getPrivateKey());
      sxy = sxy.computeSecret(pubKey);

      // HKxy = HKDF(SHA256, Sxy, Expiration, 32)
      var hkxy = HKDF(SHA256, sxy, secondsUntilExpiration).derive('', 32);

      // BeaconHmac = HMAC(SHA256, HKxy, Expiration).first(16)
      var beaconHmac = crypto.createHmac('sha256', hkxy);
      beaconHmac.update(secondsUntilExpiration);
      beaconHmac = beaconHmac.digest().slice(0, 16);

      // Sey = ECDH(Ke.private(), PubKy)
      var sey = ke.computeSecret(pubKey);

      // KeyingMaterial = HKDF(SHA256, Sey, Expiration, 32)
      var keyingMaterial = HKDF(SHA256, sey, secondsUntilExpiration).derive('', 32);

      // IV = KeyingMaterial.slice(0,16)
      var iv = keyingMaterial.slice(0, 16);

      // HKey = KeyingMaterial.slice(16, 32)
      var hkey = keyingMaterial.slice(16, 32);

      // beacons.append(AESEncrypt(GCM, HKey, IV, 128, UnencryptedKeyId) + BeaconHmac)
      var aes = crypto.createCipheriv(GCM, hkey, iv);
      aes.udpate(unencryptedKeyId);
      aes = aes.digest();

      beacons.push(Buffer.concat(aes, beaconHmac));
    }

    return new Buffer(beacons);
};

/**
 * This callback is used to lookup if the public key hash retrieved from a notification beacon belongs to a peer
 * that the local peer wishes to talk to. If not the callback will return null. If so then the callback will return
 * the full public key for the remote peer. In other words, there is an explicit assumption that the caller has an
 * address book mapping hashes of public keys with the full public keys. The hashes are in the beacon and this
 * function is used to retrieve the full public key so that the beacon validation process can complete.
 * @callback addressBookCallback
 * @param {Buffer} unencryptedKeyId - This is a Buffer containing the unencryptedKeId
 * @returns {string} - The base64 encoded public key associated with the unecryptedKeyId or null if the remove peer is
 * not one the local peer recognizes or wishes to communicate with
 */

/**
 *
 * @param {Buffer} beaconStreamWithPreAmble - A buffer stream containing the preamble and beacons
 * @param {ECDH} ecdhForLocalDevice - A Crypto.ECDH object initialized with the local device'spublic and private keys
 * @param {addressBookCallback} addressBookCallback - A callback used by the function to determine if the identified
 * remote peer's public key hash represents a remote peer the local peer wishes to communicate with.
 * @returns {Buffer} - Null if none of the beacons could be validated as being targeted at the local peer or if
 * the beacon came from a remote peer the local peer does not wish to communicate with. Otherwise a Node.js Buffer
 * containing the unencryptedKeyId for the remote peer.
 */
NotificationBeacons.prototype.parseBeacons =
  function(beaconStreamWithPreAmble, ecdhForLocalDevice, addressBookCallback) {

    

    // Unlike the pseudo code this function assumes it will be passed the entire preamble and beacon stream. Therefore
    // the PubKe and the expiration can be parsed out of the beaconStreamWithPreAmble as defined in the spec.
};

module.exports = NotificationBeacons;
