'use strict';

var crypto = require('crypto');

// Constants
var SHA256 = 'sha256';
var SECP256K1 = 'secp256k1';
var GCM = 'aes-256-gcm';

/*
Matt: Please make sure to see if you can find Srikanth's code in Node and of course you can look at the Java source code
and tests linked to in the spec, the latest version of which is at https://github.com/thaliproject/thali/blob/yaronyg-patch-4/presenceprotocolforopportunisticsynching.md
 */

function NotificationBeacons() {}

/**
 * This function will generate a buffer containing the notification preamble and beacons for the given set of
 * public keys using the supplied private key and set to the specified seconds until expiration.
 * @param {string[]} publicKeysToNotify - An array of strings holding base64 encoded ECDH public keys
 * @param {ECDH} ecdhForLocalDevice - A Crypto.ECDH object initialized with the local device's public and private keys
 * @param {number} secondsUntilExpiration - The number of seconds into the future after which the beacons should expire.
 * @returns {Buffer} - A buffer containing the serialized preamble and beacons
 */
NotificationBeacons.prototype.generatePreambleAndBeacons =
  function(publicKeysToNotify, ecdhForLocalDevice, secondsUntilExpiration) {
    // http://code.runnable.com/VGaBmn68rzMa5p9K/aes-256-gcm-nodejs-encryption-for-node-js-and-hello-world

    var beacons = [];

    var ke = crypto.createECDH(SECP256K1);
    var kePublic = ke.generateKeys();

    // TODO: Look at long.js https://www.npmjs.com/package/long

    var unencryptedKeyIdHash = crypto.createHash(SHA256);
    unencryptedKeyIdHash.update(ecdhForLocalDevice.getPublicKey());
    var unencryptedKeyId = unencryptedKeyIdHash.digest().slice(0, 16);

    for (var i = 0, len = publicKeysToNotify.length; i < len; i++) {
      // TODO: Make sure safe URL base64

      var pubKey = publicKeysToNotify[i];

      var sxyECDH = crypto.createECDH(SECP256K1);
      sxyECDH.setPrivateKey(ecdhForLocalDevice.getPrivateKey());
      var sxy = sxyECDH.computeSecret(new Buffer(pubKey));

      var hkxy = new Buffer(); // TODO use hkdf

      var beaconHmacx = crypto.createHmac('sha256', hkxy);
      beaconHmacx.update(secondsUntilExpiration);
      var beaconHmac = beaconHmacx.digest().slice(0, 16);

      var sey = ke.computeSecret(new Buffer(pubKey));
      var keyingMaterial = new Buffer(); // TODO: see HKDF again
      var iv = keyingMaterial.slice(0, 16);
      var hkey = keyingMaterial.slice(16, 32);

      var c = crypto.createCipheriv(GCM, 'a password');

      beacons.push(

      );

      /*
      Sey = ECDH(Ke.private(), PubKy)
      KeyingMaterial = HKDF(SHA256, Sey, Expiration, 32)
      IV = KeyingMaterial.slice(0,16)
      HKey = KeyingMaterial.slice(16, 32)
      beacons.append(AESEncrypt(GCM, HKey, IV, 128, UnencryptedKeyId) + BeaconHmac)
      */
    }

    return new Buffer(beacons);


    // This implements the generateBeacons function from the specs. I don't take the IV or Ke as arguments because
    // those can be generated inside the function.
    // Note that you will need to use crypto.ECDH to implement this functionality which was introduced in Node 0.12
    // and isn't in JXcore yet. So for now please just develop using Node 0.12 or Node 4 until we get this back ported
    // to JXcore. The complication with using Node 0.12 is that it won't have the custom extension we need to
    // crypto that JXcore provided to support HKDF. See http://jxcore.com/docs/crypto.html#cryptogeneratehkdfbytestogenerate-publickey-salt-digestbuffer
    // The work around is to use https://www.npmjs.com/package/node-hkdf but we *MUST* remove this quickly because
    // it doesn't have a published license.

};

/**
 * Generates a single beacon using the specified values.
 * @param {string} publicKey - This is a base64 encoded public key we need to create a beacon for
 * @param {ECDH} ecdhWithPrivateKey - A Crypto.ECDH object initialized with the local device's public and private keys
 * @param {Buffer} IV - The IV to use for this beacon (we use the same IV for all beacons)
 * @param {ECDH} Ke - A Crypto.ECDH object initialized with the public and private ephemeral key
 * @param {Buffer} expirationValue - The calculated expirationValue used the pre-amble that pairs with this beacon
 * @returns {Buffer} - A buffer containing the beacon
 */
function generateBeacon(publicKey, ecdhWithPrivateKey, IV, Ke, expirationValue) {

}

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
