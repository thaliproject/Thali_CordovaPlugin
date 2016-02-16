'use strict';

/** @module thaliNotificationBeacons */

/*
Latest version of spec https://github.com/thaliproject/thali/blob/gh-pages/pages/documentation/PresenceProtocolForOpportunisticSynching.md
*/
var crypto = require('crypto');
var Long = require('long');
var HKDF = require('./hkdf');
var Promise = require('lie');

// Constants
var SHA256 = 'sha256';
var SECP256K1 = 'secp256k1';
var ONE_DAY = 86400000;

/*
TODO: Revisit GCM when available in JXcore
http://code.runnable.com/VGaBmn68rzMa5p9K/aes-256-gcm-nodejs-encryption-for-node-js-and-hello-world
*/
var GCM = 'aes128';

/**
 * Creates a hash of a public key.
 * @param {buffer} ecdhPublicKey The buffer representing the ECDH's public key.
 * @returns {buffer}
 */
function createPublicKeyHash (ecdhPublicKey) {
  return crypto.createHash(SHA256)
    .update(ecdhPublicKey)
    .digest()
    .slice(0, 16);
}

module.exports.createPublicKeyHash = createPublicKeyHash;

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
 * @returns {?Buffer} - A buffer containing the serialized preamble and beacons
 * or null if there are no beacons to generate
 */
function generatePreambleAndBeacons (publicKeysToNotify,
                                     ecdhForLocalDevice,
                                     secondsUntilExpiration) {
  if (publicKeysToNotify == null) {
    throw new Error('publicKeysToNotify cannot be null');
  }

  if (ecdhForLocalDevice == null) {
    throw new Error('ecdhForLocalDevice cannot be null');
  }

  var now = Date.now();
  if (secondsUntilExpiration < now ||
      secondsUntilExpiration > now + ONE_DAY) {
    throw new Error('secondsUntilExpiration out of range.');
  }

  if (publicKeysToNotify.length === 0) { return null; }

  var beacons = [];

  var ke = crypto.createECDH(SECP256K1);

  // Generate preamble
  var pubKe = ke.generateKeys();
  var expirationLong = Long.fromNumber(secondsUntilExpiration);
  var expirationBuffer = new Buffer(8);
  expirationBuffer.writeInt32BE(expirationLong.high, 0);
  expirationBuffer.writeInt32BE(expirationLong.low, 4);

  beacons.push(Buffer.concat([pubKe, expirationBuffer]));

  // UnencryptedKeyId = SHA256(Kx.public().encode()).first(16)
  var unencryptedKeyId =
    createPublicKeyHash(ecdhForLocalDevice.getPublicKey());

  publicKeysToNotify.forEach(function (pubKy) {
    // Sxy = ECDH(Kx.private(), PubKy)
    var sxy = ecdhForLocalDevice.computeSecret(pubKy);

    // HKxy = HKDF(SHA256, Sxy, Expiration, 32)
    var hkxy = HKDF(SHA256, sxy, expirationBuffer).derive('', 32);

    // BeaconHmac = HMAC(SHA256, HKxy, Expiration).first(16)
    var beaconHmac = crypto.createHmac(SHA256, hkxy)
      .update(expirationBuffer)
      .digest()
      .slice(0, 16);

    // Sey = ECDH(Ke.private(), PubKy)
    var sey = ke.computeSecret(pubKy);

    // KeyingMaterial = HKDF(SHA256, Sey, Expiration, 32)
    var keyingMaterial = HKDF(SHA256, sey, expirationBuffer).derive('', 32);

    // IV = KeyingMaterial.slice(0,16)
    var iv = keyingMaterial.slice(0, 16);

    // HKey = KeyingMaterial.slice(16, 32)
    var hkey = keyingMaterial.slice(16, 32);

    // beacons.append(AESEncrypt(GCM, HKey, IV, 128, UnencryptedKeyId) +
    // BeaconHmac)
    var aes = crypto.createCipheriv(GCM, hkey, iv);

    beacons.push(Buffer.concat([
      Buffer.concat([aes.update(unencryptedKeyId), aes.final()]),
      beaconHmac
    ]));
  });

  return Buffer.concat(beacons);
}

module.exports.generatePreambleAndBeacons = generatePreambleAndBeacons;

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
 * unencryptedKeId
 * @returns {?Buffer} - The base64 encoded public key associated with the
 * unecryptedKeyId or null if the remove peer is not one the local peer
 * recognizes or wishes to communicate with
 */

/**
 * Takes a full beacon stream, with preamble, as input and tries to find and
 * return the first beacon that matches the current user's identity.
 *
 * @param {Buffer} beaconStreamWithPreAmble - A buffer stream containing the
 * preamble and beacons
 * @param {ECDH} ecdhForLocalDevice - A Crypto.ECDH object initialized with the
 * local device'spublic and private keys
 * @param {addressBookCallback} addressBookCallback - A callback used by the
 * function to determine if the identified remote peer's public key hash
 * represents a remote peer the local peer wishes to communicate with.
 * @returns {?Buffer} - Null if none of the beacons could be validated as being
 * targeted at the local peer or if the beacon came from a remote peer the local
 * peer does not wish to communicate with. Otherwise a Node.js Buffer containing
 * the unencryptedKeyId for the remote peer.
 */
function parseBeacons (beaconStreamWithPreAmble, ecdhForLocalDevice,
                       addressBookCallback) {
  if (beaconStreamWithPreAmble == null) {
    return null;
  }

  var bufferSize = 48, len = beaconStreamWithPreAmble.length;

  // Ensure that is an ECDH secp256k1 public key
  var pubKe = beaconStreamWithPreAmble.slice(0, 65);
  if (pubKe.length !== 65) {
    throw new Error(
      'Preamble public key must be from ECDH secp256k1'
    );
  }

  // Ensure that expiration is 64-bit integer
  var expiration = beaconStreamWithPreAmble.slice(65, 65 + 8);
  if (expiration.length !== 8) {
    throw new Error('Preamble expiration must be a 64 bit integer');
  }

  // Ensure within range
  var expirationLong = Long.fromBits(
    expiration.readInt32BE(4),
    expiration.readInt32BE(0)).toNumber();
  var now = Date.now();
  if (expirationLong < now || expirationLong > now + ONE_DAY) {
    throw new Error('Expiration out of range');
  }

  for (var i = 73; i < len; i += bufferSize) {
    // encryptedBeaconKeyId = beaconStream.read(48)
    var encryptedBeaconKeyId =
      beaconStreamWithPreAmble.slice(i, i + bufferSize);
    if (encryptedBeaconKeyId.length !== bufferSize) {
      throw new Error('Malformed encrypted beacon key ID');
    }

    // Sey = ECDH(Ky.private, PubKe)
    var sey = ecdhForLocalDevice.computeSecret(pubKe);

    // KeyingMaterial = HKDF(SHA256, Sey, Expiration, 32)
    var keyingMaterial = HKDF(SHA256, sey, expiration).derive('', 32);

    // IV = KeyingMaterial.slice(0,16)
    var iv = keyingMaterial.slice(0, 16);

    // HKey = KeyingMaterial.slice(16, 32)
    var hkey = keyingMaterial.slice(16, 32);

    // UnencryptedKeyId = AESDecrypt(GCM, HKey, IV, 128,
    // encryptedBeaconKeyId.slice(0, 32))
    var unencryptedKeyId;
    try {
      unencryptedKeyId = crypto.createDecipheriv(GCM, hkey, iv);
      unencryptedKeyId =
        Buffer.concat(
          [unencryptedKeyId.update(encryptedBeaconKeyId.slice(0, 32)),
            unencryptedKeyId.final()]);
    } catch (e) {
      // GCM mac check failed
      continue;
    }
    // PubKx = addressBook.get(UnencryptedKeyId)
    var pubKx = addressBookCallback(unencryptedKeyId);

    if (!pubKx) {
      // Device that claims to have sent the announcement is not recognized
      // Once we find a matching beacon we stop, even if the sender is
      // unrecognized

      // Until we add in GCM support the previous comment isn't true. For
      // now if we don't have a match it could be because the sender is
      // not trusted by us or it could be because the token wasn't for us
      // and we decrypted gibberish.
      continue;
    }

    // BeaconHmac = encryptedBeaconKeyId.slice(32, 48)
    var beaconHmac = encryptedBeaconKeyId.slice(32, 48);

    // Sxy = ECDH(Ky.private(), PubKx)
    var sxy = ecdhForLocalDevice.computeSecret(pubKx);

    // HKxy = HKDF(SHA256, Sxy, Expiration, 32)
    var hkxy = HKDF(SHA256, sxy, expiration).derive('', 32);

    // BeaconHmac.equals(HMAC(SHA256, HKxy, Expiration).first(16)
    var otherBeaconHmac = crypto.createHmac('sha256', hkxy)
      .update(expiration)
      .digest()
      .slice(0, 16);

    // Since JXcore does not support equals
    // if (beaconHmac.equals(otherBeaconHmac)) {
    if (beaconHmac.toString('binary') ===
        otherBeaconHmac.toString('binary')) {
      return unencryptedKeyId;
    }
  }

  return null;
}

module.exports.parseBeacons = parseBeacons;

/**
 * Encodes the public key and associated PSK secret.
 *
 * @public
 * @typedef {Object} keyAndSecret
 * @property {buffer} publicKey
 * @property {buffer} pskSecret
 */

/**
 * A dictionary whose key is the identity string sent over TLS and whose
 * value is a keyAndSecret specifying what publicKey this identity is associated
 * with and what secret it needs to provide.
 *
 * @public
 * @typedef {Object.<string, keyAndSecret>} pskMap
 */

/**
 * This function takes a ist of public keys and the device's ECDH private key
 * along with a beacon stream with preamble that was generated using those
 * public keys. The function requires that the beacon values in the beacon
 * stream MUST be in the same order as the keys listed in the publicKeysToNotify
 * array.
 *
 * The code will then generate Sxy as given in http://thaliproject.org/PresenceProtocolBindings/#transferring-from-notification-beacon-to-tls
 * and then feed that to HKDF using the the PSKIdentity value which is defined
 * in the above as the pre-amble plus the individual beacon value for the
 * associated public key. This means we have to parse the beacon stream to
 * pull out the preamble along with the specific associated beacon and then
 * combine them together into a single buffer that is then base64'd using
 * the URL safe base64 scheme. This is then fed to HKDF as defined in the
 * link above which produces the value that will be used as the secret.
 *
 * This function will then wrap up all of this into a dictionary whose key
 * is the base64 url safe'd pre-amble + beacon value and who value is the
 * secret along with the associated publicKey.
 *
 * @param {buffer[]} publicKeysToNotify - An array of buffers holding ECDH
 * public keys.
 * @param {ECDH} ecdhForLocalDevice - A Crypto.ECDH object initialized with the
 * local device's public and private keys
 * @param {Buffer} beaconStreamWithPreAmble - A buffer stream containing the
 * preamble and beacons
 * @returns {Promise<Object.<string,keyAndSecret>|Error>}
 */
function generatePskSecrets(publicKeysToNotify,
                            ecdhForLocalDevice,
                            beaconStreamWithPreAmble) {
  return Promise.resolve();
}

module.exports.generatePskSecrets = generatePskSecrets;

/**
 * @typedef {Object} beaconStreamAndSecretDictionary
 * @property {buffer} beaconStreamWithPreAmble
 * @property {keyAndSecret} keyAndSecret
 */

/**
 * This is a unified function that will generate the beacon stream and
 * preamble as well as the secret dictionary needed to validate TLS PSK
 * connections generated as a consequence of the advertised beacon stream.
 *
 * @param {buffer[]} publicKeysToNotify - An array of buffers holding ECDH
 * public keys.
 * @param {ECDH} ecdhForLocalDevice - A Crypto.ECDH object initialized with the
 * local device's public and private keys
 * @param {number} secondsUntilExpiration - The number of seconds into the
 * future after which the beacons should expire.
 * @returns {?beaconStreamAndSecretDictionary}
 */
function generateBeaconStreamAndSecrets(publicKeysToNotify,
                                        ecdhForLocalDevice,
                                        secondsUntilExpiration) {
  var beaconStreamWithPreAmble =
    generatePreambleAndBeacons(publicKeysToNotify, ecdhForLocalDevice,
                               secondsUntilExpiration);

  if (!beaconStreamWithPreAmble) {
    return Promise.resolve(null);
  }

  return generatePskSecrets(publicKeysToNotify, ecdhForLocalDevice,
                            beaconStreamWithPreAmble)
    .then(function (secretDictionary) {
      return {
        beaconStreamWithPreAmble: beaconStreamWithPreAmble,
        keyAndSecret : secretDictionary
      };
    });
}

module.exports.generateBeaconStreamAndSecrets = generateBeaconStreamAndSecrets;
