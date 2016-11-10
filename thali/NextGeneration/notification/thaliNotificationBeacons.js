'use strict';

/** @module thaliNotificationBeacons */

/*
Latest version of spec https://github.com/thaliproject/thali/blob/gh-pages/pages/documentation/PresenceProtocolForOpportunisticSynching.md
*/
var crypto = require('crypto');
var Long = require('long');
var HKDF = require('./../security/hkdf');
var urlSafeBase64 = require('urlsafe-base64');
var assert = require('assert');
var thaliConfig = require('../thaliConfig');

// Constants
module.exports.SHA256 = 'sha256';
module.exports.ONE_DAY = 1000 * 60 * 60 * 24;

/*
TODO: Revisit GCM when available in JXcore - https://github.com/thaliproject/Thali_CordovaPlugin/issues/492
http://code.runnable.com/VGaBmn68rzMa5p9K/aes-256-gcm-nodejs-encryption-for-node-js-and-hello-world
*/
module.exports.GCM = 'aes128';

/**
 * We fuzz the expiration we output to obscure the exact clock time on the
 * device. Currently we do this by generating a random value between 0 and
 * 255 and adding to the expiration. We picked 255 because it was easy to
 * get a single byte of cryptographically secure output and turn that into
 * an unsigned int.
 * @type {number}
 * @constant
 */
module.exports.EXPIRATION_FUZZ_MAX_VALUE = 255;

/**
 * Size in bytes of an AES 128 key
 * @type {number}
 * @constant
 */
module.exports.AES_128_KEY_SIZE = 16;

/**
 * Size in bytes of an AES 256 key
 * @type {number}
 * @constant
 */
module.exports.AES_256_KEY_SIZE = 32;

/**
 * Size in bytes for a SHA256 HMAC
 * @type {number}
 * @constant
 */
module.exports.SHA256_HMAC_KEY_SIZE = 32;

/**
 * Size in bytes we use when we truncate SHA 256 Hashes
 * @type {number}
 * @constant
 */
module.exports.TRUNCATED_HASH_SIZE = 16;

/**
 * Size of a long integer in bytes
 * @type {number}
 * @constant
 */
module.exports.LONG_SIZE = 8;

/**
 * Size in bytes that a ECDH public key using our curve takes up when
 * outputted in a beacon string.
 * @type {number}
 * @constant
 */
module.exports.PUBLIC_KEY_SIZE = 65;

/**
 * Size in bytes that our expiration value (an unsigned long) uses when
 * outputted in a beacon string.
 * @type {number}
 * @constant
 */
module.exports.EXPIRATION_SIZE = 8;

/**
 * Size of the BeaconFlag and BeaconHmac in bytes, together they form a single
 * beacon value in a beacon string.
 *
 * @type {number}
 * @constant
 */
module.exports.BEACON_SIZE = 48;

/**
 * Size of the BeaconFlag in bytes in a beacon in a beacon string.
 *
 * @type {number}
 * @constant
 */
module.exports.ENCRYPTED_KEY_ID_SIZE = 32;

/**
 * Size of the BeaconHmac in bytes when serialized in a beacon in a beacon
 * string.
 * @type {number}
 * @constant
 */
module.exports.BEACON_HMAC_SIZE = 16;

/**
 * Creates a 16 byte hash of a public key.
 *
 * We choose 16 bytes as large enough to prevent accidentally collisions but
 * small enough not to eat up excess space in a beacon.
 *
 * @param {Buffer} ecdhPublicKey The buffer representing the ECDH's public key.
 * @returns {Buffer}
 */
function createPublicKeyHash (ecdhPublicKey) {
  return crypto.createHash(module.exports.SHA256)
    .update(ecdhPublicKey)
    .digest()
    .slice(0, 16);
}

module.exports.createPublicKeyHash = createPublicKeyHash;

/**
 * This function will generate a buffer containing the notification preamble and
 * beacons for the given set of public keys using the supplied private key and
 * set to the specified seconds until expiration.
 * @param {Buffer[]} publicKeysToNotify - An array of buffers holding ECDH
 * public keys.
 * @param {ECDH} ecdhForLocalDevice - A Crypto.ECDH object initialized with the
 * local device's public and private keys
 * @param {number} millisecondsUntilExpiration - The number of milliseconds into
 * the future after which the beacons should expire. Note that this value will
 * be fuzzed as previously described.
 * @returns {?Buffer} - A buffer containing the serialized preamble and beacons
 * or null if there are no beacons to generate
 */
function generatePreambleAndBeacons (publicKeysToNotify,
                                     ecdhForLocalDevice,
                                     millisecondsUntilExpiration) {
  if (publicKeysToNotify == null) {
    throw new Error('publicKeysToNotify cannot be null');
  }

  if (ecdhForLocalDevice == null) {
    throw new Error('ecdhForLocalDevice cannot be null');
  }

  if (millisecondsUntilExpiration <= 0 ||
      millisecondsUntilExpiration > module.exports.ONE_DAY) {
    throw new Error('millisecondsUntilExpiration must be > 0 & < ' +
      module.exports.ONE_DAY);
  }

  if (publicKeysToNotify.length === 0) { return null; }

  var beacons = [];

  var ke = crypto.createECDH(thaliConfig.BEACON_CURVE);

  // Generate preamble
  var pubKe = ke.generateKeys();
  // We fuzz the expiration by adding on a random number that fits in
  // an unsigned 8 bit integer.
  var expiration = Date.now() + millisecondsUntilExpiration +
    crypto.randomBytes(1).readUInt8(0);
  var expirationLong = Long.fromNumber(expiration);
  var expirationBuffer = new Buffer(module.exports.LONG_SIZE);
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
    var hkxy = HKDF(module.exports.SHA256, sxy, expirationBuffer)
      .derive('', module.exports.SHA256_HMAC_KEY_SIZE);

    // BeaconHmac = HMAC(SHA256, HKxy, Expiration).first(16)
    var beaconHmac = crypto.createHmac(module.exports.SHA256, hkxy)
      .update(expirationBuffer)
      .digest()
      .slice(0, module.exports.TRUNCATED_HASH_SIZE);

    // Sey = ECDH(Ke.private(), PubKy)
    var sey = ke.computeSecret(pubKy);

    // hkey = HKDF(SHA256, Sey, Expiration, 16)
    var hkey = HKDF(module.exports.SHA256, sey, expirationBuffer)
      .derive('', module.exports.AES_128_KEY_SIZE);

    // beacons.append(AESEncrypt(GCM, HKey, 0, 128, UnencryptedKeyId) +
    // BeaconHmac)
    var aes = crypto.createCipher(module.exports.GCM, hkey);

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
 * unencryptedKeyId
 * @returns {?Buffer} - The public key associated with the
 * unecryptedKeyId or null if the remove peer is not one the local peer
 * recognizes or wishes to communicate with
 */

/**
 * @typedef {Object} parseBeaconsResponse
 * @property {Buffer} preAmble A Buffer containing the preamble from the
 * beacon stream
 * @property {Buffer} unencryptedKeyId The first 16 bytes of the sha 256 hash
 * of the remote peer's public ke
 * @property {Buffer} encryptedBeaconKeyId A horrible name representing the
 * beacon, aka the EncryptedBeaconFlag + BeaconHmac.
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
 * @returns {?parseBeaconsResponse} - Null if none of the beacons could be
 * validated as being targeted at the local peer or if the beacon came from a
 * remote peer the local peer does not wish to communicate with.
 */
function parseBeacons (beaconStreamWithPreAmble, ecdhForLocalDevice,
                       addressBookCallback) {
  if (beaconStreamWithPreAmble == null) {
    return null;
  }

  var len = beaconStreamWithPreAmble.length;

  // Ensure that is an ECDH secp256k1 public key
  var pubKe = beaconStreamWithPreAmble.slice(0, module.exports.PUBLIC_KEY_SIZE);
  if (pubKe.length !== module.exports.PUBLIC_KEY_SIZE) {
    throw new Error(
      'Preamble public key must be from ECDH secp256k1'
    );
  }

  // Ensure that expiration is 64-bit integer
  var expirationBuffer = beaconStreamWithPreAmble
    .slice(module.exports.PUBLIC_KEY_SIZE,
      module.exports.PUBLIC_KEY_SIZE + module.exports.EXPIRATION_SIZE);
  if (expirationBuffer.length !== module.exports.EXPIRATION_SIZE) {
    throw new Error('Preamble expiration must be a 64 bit integer');
  }

  // Ensure within range
  var expiration = Long.fromBits(
    expirationBuffer.readInt32BE(4),
    expirationBuffer.readInt32BE(0)).toNumber();
  var now = Date.now();
  if (expiration < now || expiration > now + module.exports.ONE_DAY) {
    throw new Error('Expiration out of range');
  }

  // Sey = ECDH(Ky.private, PubKe)
  var sey = ecdhForLocalDevice.computeSecret(pubKe);

  // hkey = HKDF(SHA256, Sey, Expiration, 16)
  var hkey = HKDF(module.exports.SHA256, sey, expirationBuffer)
    .derive('', module.exports.AES_128_KEY_SIZE);

  for (var i = module.exports.PUBLIC_KEY_SIZE + module.exports.EXPIRATION_SIZE;
       i < len; i += module.exports.BEACON_SIZE) {
    // encryptedBeaconKeyId = beaconStream.read(48)
    var encryptedBeaconKeyId =
      beaconStreamWithPreAmble.slice(i, i + module.exports.BEACON_SIZE);
    if (encryptedBeaconKeyId.length !== module.exports.BEACON_SIZE) {
      throw new Error('Malformed encrypted beacon key ID');
    }

    // UnencryptedKeyId = AESDecrypt(GCM, HKey, 0, 128,
    // encryptedBeaconKeyId.slice(0, 32))
    var unencryptedKeyId;
    try {
      var aes = crypto.createDecipher(module.exports.GCM, hkey);
      unencryptedKeyId =
        Buffer.concat(
          [aes.update(encryptedBeaconKeyId.slice(0,
                                        module.exports.ENCRYPTED_KEY_ID_SIZE)),
            aes.final()]);
    } catch (e) {
      // Decryption failed due to bad decrypt, this is expected
      var BAD_DECRYPT_ERROR = 'error:06065064:digital envelope routines:' +
        'EVP_DecryptFinal_ex:bad decrypt';
      if (e.message === BAD_DECRYPT_ERROR) {
        continue;
      }
      throw e;
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
    var beaconHmac =
      encryptedBeaconKeyId.slice(module.exports.ENCRYPTED_KEY_ID_SIZE,
                                 module.exports.ENCRYPTED_KEY_ID_SIZE +
                                  module.exports.BEACON_HMAC_SIZE);

    // Sxy = ECDH(Ky.private(), PubKx)
    var sxy = ecdhForLocalDevice.computeSecret(pubKx);

    // HKxy = HKDF(SHA256, Sxy, Expiration, 32)
    var hkxy = HKDF(module.exports.SHA256, sxy, expirationBuffer)
      .derive('', module.exports.SHA256_HMAC_KEY_SIZE);

    // BeaconHmac.equals(HMAC(SHA256, HKxy, Expiration).first(16)
    var otherBeaconHmac = crypto.createHmac('sha256', hkxy)
      .update(expirationBuffer)
      .digest()
      .slice(0, module.exports.TRUNCATED_HASH_SIZE);

    // if (beaconHmac.equals(otherBeaconHmac)) {
    if (beaconHmac.compare(otherBeaconHmac) === 0) {
      return {
        preAmble: beaconStreamWithPreAmble.slice(0,
          module.exports.PUBLIC_KEY_SIZE +
          module.exports.EXPIRATION_SIZE),
        unencryptedKeyId: unencryptedKeyId,
        encryptedBeaconKeyId: encryptedBeaconKeyId
      };
    }
  }

  return null;
}

module.exports.parseBeacons = parseBeacons;

// jscs:disable jsDoc
/**
 * Creates the PSK_Identity_Field to identify a TLS client establishing a PSK
 * connection using beacon data (see
 * http://thaliproject.org/PresenceProtocolBindings/).
 * @param {Buffer} preAmble
 * @param {Buffer} beacon
 * @returns {string}
 */
// jscs:enable jsDoc
function generatePskIdentityField(preAmble, beacon) {
  var hash = crypto.createHash('sha256');
  hash.update(Buffer.concat([preAmble, beacon]));
  return urlSafeBase64.encode(hash.digest());
}

module.exports.generatePskIdentityField = generatePskIdentityField;

/**
 * Generates a PSK secret between the local device and a remote peer.
 * @param {ECDH} ecdhForLocalDevice
 * @param {Buffer} remotePeerPublicKey
 * @param {string} pskIdentityField
 * @returns {Buffer}
 */
function generatePskSecret(ecdhForLocalDevice, remotePeerPublicKey,
                                  pskIdentityField) {
  var sxy = ecdhForLocalDevice.computeSecret(remotePeerPublicKey);
  return HKDF(module.exports.SHA256, sxy, pskIdentityField)
    .derive('', module.exports.AES_256_KEY_SIZE);
}

module.exports.generatePskSecret = generatePskSecret;

/**
 * Encodes the public key and associated PSK secret.
 *
 * @public
 * @typedef {Object} keyAndSecret
 * @property {Buffer} publicKey
 * @property {Buffer} pskSecret
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
 * This function takes a list of public keys and the device's ECDH private key
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
 * @param {Buffer[]} publicKeysToNotify - An array of buffers holding ECDH
 * public keys.
 * @param {ECDH} ecdhForLocalDevice - A Crypto.ECDH object initialized with the
 * local device's public and private keys
 * @param {Buffer} beaconStreamWithPreAmble - A buffer stream containing the
 * preamble and beacons
 * @returns {pskMap|Error}
 */
function generatePskSecrets(publicKeysToNotify,
                            ecdhForLocalDevice,
                            beaconStreamWithPreAmble) {
  var preAmbleSizeInBytes = module.exports.PUBLIC_KEY_SIZE +
    module.exports.EXPIRATION_SIZE;

  var preAmble = beaconStreamWithPreAmble.slice(0, preAmbleSizeInBytes);
  var beaconStreamNoPreAmble =
    beaconStreamWithPreAmble.slice(preAmbleSizeInBytes);

  var beacons = [];
  for (var i = 0; i < beaconStreamNoPreAmble.length;
       i += module.exports.BEACON_SIZE) {
    beacons.push(
      beaconStreamNoPreAmble.slice(i, i + module.exports.BEACON_SIZE));
  }

  assert(beacons.length === publicKeysToNotify.length, 'We should have the' +
    'same number of beacons as public keys to notify');

  var pskMap = {};
  for (i = 0; i < publicKeysToNotify.length; ++i) {
    var pskIdentityField = generatePskIdentityField(preAmble, beacons[i]);
    var pskSecret = generatePskSecret(ecdhForLocalDevice, publicKeysToNotify[i],
      pskIdentityField);
    pskMap[pskIdentityField] = {
      publicKey: publicKeysToNotify[i],
      pskSecret: pskSecret
    };
  }
  return pskMap;
}

module.exports.generatePskSecrets = generatePskSecrets;

/**
 * @typedef {Object} beaconStreamAndSecretDictionary
 * @property {Buffer} beaconStreamWithPreAmble
 * @property {keyAndSecret} keyAndSecret
 */

/**
 * This is a unified function that will generate the beacon stream and
 * preamble as well as the secret dictionary needed to validate TLS PSK
 * connections generated as a consequence of the advertised beacon stream.
 *
 * @param {Buffer[]} publicKeysToNotify - An array of buffers holding ECDH
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
    return null;
  }

  var pskMap = generatePskSecrets(publicKeysToNotify, ecdhForLocalDevice,
    beaconStreamWithPreAmble);

  return {
    beaconStreamWithPreAmble: beaconStreamWithPreAmble,
    keyAndSecret: pskMap
  };
}

module.exports.generateBeaconStreamAndSecrets = generateBeaconStreamAndSecrets;
