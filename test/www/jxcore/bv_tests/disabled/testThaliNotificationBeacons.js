'use strict';

var tape = require('../lib/thaliTape');
var notificationBeacons =
  require('thali/NextGeneration/notification/thaliNotificationBeacons');
var crypto = require('crypto');
var long = require('long');
var urlSafeBase64 = require('urlsafe-base64');
var testUtils = require('../lib/testUtils.js');
var thaliConfig = require('thali/NextGeneration/thaliConfig');

var test = tape({
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    t.end();
  }
});

/*
 * Note to programmer: At this time we do not have GCM support in JXcore. This
 * means that when we decrypt the BeaconFlag (see
 * http://thaliproject.org/PresenceProtocolForOpportunisticSynching/) we can
 * get a spurious match. That is, because we don't have the GCM MAC to validate
 * that the decryption worked properly we can end up in a situation where it
 * looks like we successfully decrypted the value when, in fact, we did not.
 * The BeaconHmac will catch this so it's not a security issue per say but it
 * does complicate testing because we can't just state that the address book
 * should, for example, never be called if we use a key in the parse function
 * that doesn't match any of the beacons. A spurious match could cause an
 * address book call but the value should be garbage. All of this goes away
 * when we can put in GCM.
 */

test('#generatePreambleAndBeacons bad args', function (t) {
  var publicKeys = [];
  var localDevice = crypto.createECDH(thaliConfig.BEACON_CURVE);
  localDevice.generateKeys();
  var expiration = 9000;

  t.throws(function () {
    notificationBeacons.generatePreambleAndBeacons(
      null,
      localDevice,
      expiration
    );
  }, 'publicKeysToNotify cannot be null');

  t.throws(function () {
    notificationBeacons.generatePreambleAndBeacons(
      publicKeys,
      null,
      expiration
    );
  }, 'ecdh for local device cannot be null');

  t.throws(function () {
    notificationBeacons.generatePreambleAndBeacons(
      null,
      localDevice,
      -1
    );
  }, 'milliseconds cannot be less than 0');

  t.throws(function () {
    notificationBeacons.generatePreambleAndBeacons(
      null,
      localDevice,
      0
    );
  }, 'milliseconds cannot be  0');

  t.throws(function () {
    notificationBeacons.generatePreambleAndBeacons(
      null,
      localDevice,
      notificationBeacons.ONE_DAY + 1
    );
  }, 'milliseconds cannot be greater than one_day');

  t.end();
});

test('#generatePreambleAndBeacons empty keys to notify', function (t) {
  var publicKeys = [];
  var localDevice = crypto.createECDH(thaliConfig.BEACON_CURVE);
  localDevice.generateKeys();
  var expiration = 9000;

  var results = notificationBeacons.generatePreambleAndBeacons(
    publicKeys,
    localDevice,
    expiration
  );

  t.equal(results, null);
  t.end();
});

test('#generatePreambleAndBeacons multiple keys to notify', function (t) {
  var publicKeys = [];
  var localDevice = crypto.createECDH(thaliConfig.BEACON_CURVE);
  localDevice.generateKeys();
  var expiration = 9000;

  var device1 = crypto.createECDH(thaliConfig.BEACON_CURVE).generateKeys();
  var device2 = crypto.createECDH(thaliConfig.BEACON_CURVE).generateKeys();
  var device3 = crypto.createECDH(thaliConfig.BEACON_CURVE).generateKeys();

  publicKeys.push(device1, device2, device3);

  var oldNow = Date.now();
  var results = notificationBeacons.generatePreambleAndBeacons(
    publicKeys,
    localDevice,
    expiration
  );

  var pubKe = results.slice(0, notificationBeacons.PUBLIC_KEY_SIZE);
  var expirationBuffer = results.slice(notificationBeacons.PUBLIC_KEY_SIZE,
    notificationBeacons.PUBLIC_KEY_SIZE + notificationBeacons.LONG_SIZE);

  t.equal(pubKe.length, notificationBeacons.PUBLIC_KEY_SIZE);
  t.equal(expirationBuffer.length, notificationBeacons.LONG_SIZE);
  var expirationDate =
    long.fromBits(expirationBuffer.readInt32BE(4),
                  expirationBuffer.readInt32BE(0))
      .toNumber();
  var outputExpiration = expirationDate - oldNow;
  // The 100 is just a buffer to deal with slow environments, I had to pick
  // some random value.
  var errorRange = notificationBeacons.EXPIRATION_FUZZ_MAX_VALUE + 100;
  t.ok(outputExpiration <= expiration + errorRange &&
       outputExpiration >= expiration - errorRange);
  t.equal(results.length, notificationBeacons.PUBLIC_KEY_SIZE +
    notificationBeacons.LONG_SIZE + (notificationBeacons.BEACON_SIZE * 3));

  t.end();
});

test('#parseBeacons invalid ECDH public key in beaconStreamWithPreAmble',
  function (t) {
    var localDevice = crypto.createECDH(thaliConfig.BEACON_CURVE);
    localDevice.generateKeys();

    var beaconStreamWithPreAmble =
      new Buffer(notificationBeacons.PUBLIC_KEY_SIZE - 1);

    var addressBookCallback = function () {
      t.fail();
    };

    t.throws(function () {
      notificationBeacons.parseBeacons(
        beaconStreamWithPreAmble,
        localDevice,
        addressBookCallback
      );
    });

    t.end();
  });

test('#parseBeacons invalid expiration in beaconStreamWithPreAmble',
  function (t) {
    var localDevice = crypto.createECDH(thaliConfig.BEACON_CURVE);
    localDevice.generateKeys();

    var beaconStreamWithPreAmble =
      new Buffer(notificationBeacons.PUBLIC_KEY_SIZE +
                 notificationBeacons.EXPIRATION_SIZE - 1);

    var addressBookCallback = function () {
      t.fail();
    };

    t.throws(function () {
      notificationBeacons.parseBeacons(
        beaconStreamWithPreAmble,
        localDevice,
        addressBookCallback
      );
    }, 'Preamble expiration must be a 64 bit integer');

    t.end();
  });

test('#parseBeacons expiration out of range lower', function (t) {
  var localDevice = crypto.createECDH(thaliConfig.BEACON_CURVE);
  localDevice.generateKeys();

  var pubKe = crypto.createECDH(thaliConfig.BEACON_CURVE).generateKeys();
  var expiration = long.fromNumber(Date.now() - 1);
  var expirationBuffer = new Buffer(notificationBeacons.EXPIRATION_SIZE);
  expirationBuffer.writeInt32BE(expiration.high, 0);
  expirationBuffer.writeInt32BE(expiration.low, 4);
  var beaconStreamWithPreAmble = Buffer.concat([pubKe, expirationBuffer]);

  var addressBookCallback = function () {
    t.fail();
    return null;
  };

  t.throws(function () {
    notificationBeacons.parseBeacons(
      beaconStreamWithPreAmble,
      localDevice,
      addressBookCallback
    );
  }, 'Expiration out of range');

  t.end();
});

test('#parseBeacons expiration out of range lower', function (t) {
  var localDevice = crypto.createECDH(thaliConfig.BEACON_CURVE);
  localDevice.generateKeys();

  var pubKe = crypto.createECDH(thaliConfig.BEACON_CURVE).generateKeys();
  var expiration = long.fromNumber(Date.now() + notificationBeacons.ONE_DAY +
    1000);
  var expirationBuffer = new Buffer(notificationBeacons.LONG_SIZE);
  expirationBuffer.writeInt32BE(expiration.high, 0);
  expirationBuffer.writeInt32BE(expiration.low, 4);
  var beaconStreamWithPreAmble = Buffer.concat([pubKe, expirationBuffer]);

  var addressBookCallback = function () {
    t.fail();
    return null;
  };

  t.throws(function () {
    notificationBeacons.parseBeacons(
      beaconStreamWithPreAmble,
      localDevice,
      addressBookCallback
    );
  }, 'Expiration out of range');

  t.end();
});

test('#parseBeacons no beacons returns null', function (t) {
  var publicKeys = [];
  var localDevice = crypto.createECDH(thaliConfig.BEACON_CURVE);
  localDevice.generateKeys();
  var expiration = 9000;

  var beaconStreamWithPreAmble = notificationBeacons.generatePreambleAndBeacons(
    publicKeys,
    localDevice,
    expiration
  );

  var addressBookCallback = function () {
    t.fail();
    return null;
  };

  var results = notificationBeacons.parseBeacons(
    beaconStreamWithPreAmble,
    localDevice,
    addressBookCallback
  );

  t.equal(results, null);
  t.end();
});

test('#parseBeacons invalid size for encryptedBeaconKeyId in ' +
      ' beaconStreamWithPreAmble',
  function (t) {
    var localDevice = crypto.createECDH(thaliConfig.BEACON_CURVE);
    localDevice.generateKeys();

    var beaconStreamWithPreAmble =
      new Buffer(notificationBeacons.PUBLIC_KEY_SIZE +
                 notificationBeacons.EXPIRATION_SIZE +
                 notificationBeacons.BEACON_SIZE - 1);

    var addressBookCallback = function () {
      return null;
    };

    t.throws(function () {
      notificationBeacons.parseBeacons(
        beaconStreamWithPreAmble,
        localDevice,
        addressBookCallback
      );
    }, 'Malformed encrypted beacon key ID');

    t.end();
  });

test('#parseBeacons addressBookCallback fails decrypt', function (t) {
  var publicKeys = [];
  var localDevice = crypto.createECDH(thaliConfig.BEACON_CURVE);
  var localDeviceKey = localDevice.generateKeys();
  var expiration = 9000;

  var device1 = crypto.createECDH(thaliConfig.BEACON_CURVE);
  var device1Key = device1.generateKeys();
  var device2 = crypto.createECDH(thaliConfig.BEACON_CURVE);
  var device2Key = device2.generateKeys();
  var device3 = crypto.createECDH(thaliConfig.BEACON_CURVE);
  var device3Key = device3.generateKeys();

  publicKeys.push(device1Key, device2Key, device3Key);

  var beaconStreamWithPreAmble = notificationBeacons.generatePreambleAndBeacons(
    publicKeys,
    localDevice,
    expiration
  );

  var localDeviceKeyHash =
    notificationBeacons.createPublicKeyHash(localDeviceKey);
  var addressBookCallback = function (unencryptedKeyId) {
    // We should only have spurious decrypts due to the GCM issue
    t.ok(unencryptedKeyId.compare(localDeviceKeyHash) !== 0);
    return null;
  };

  var badDevice = crypto.createECDH(thaliConfig.BEACON_CURVE);
  badDevice.generateKeys();
  var results = notificationBeacons.parseBeacons(
    beaconStreamWithPreAmble,
    badDevice,
    addressBookCallback
  );

  t.equal(results, null);
  t.end();
});

test('#parseBeacons addressBookCallback returns no matches', function (t) {
  // We recognize the sender but they are not on our approved list so
  // we return null
  var publicKeys = [];
  var localDevice = crypto.createECDH(thaliConfig.BEACON_CURVE);
  var localDeviceKey = localDevice.generateKeys();
  var expiration = 9000;

  var device1 = crypto.createECDH(thaliConfig.BEACON_CURVE);
  var device1Key = device1.generateKeys();
  var device2 = crypto.createECDH(thaliConfig.BEACON_CURVE);
  var device2Key = device2.generateKeys();
  var device3 = crypto.createECDH(thaliConfig.BEACON_CURVE);
  var device3Key = device3.generateKeys();

  publicKeys.push(device1Key, device2Key, device3Key);

  var beaconStreamWithPreAmble = notificationBeacons.generatePreambleAndBeacons(
    publicKeys,
    localDevice,
    expiration
  );

  var success = 0;
  var localDeviceKeyHash =
    notificationBeacons.createPublicKeyHash(localDeviceKey);
  var addressBookCallback = function (unencryptedKeyId) {
    if (unencryptedKeyId.compare(localDeviceKeyHash) === 0) {
      success++;
    }
    return null;
  };

  var results = notificationBeacons.parseBeacons(
    beaconStreamWithPreAmble,
    device3,
    addressBookCallback
  );

  t.equal(results, null);
  t.equal(success, 1);
  t.end();
});

test('#parseBeacons addressBookCallback returns spurious match', function (t) {
  // This tests a really evil case where our lack of GCM causes us to
  // 'successfully' decrypt something we should not have and that value
  // (with astronomically small odds) happens to match one of the keys in our
  // list. The HMAC should still cause a failure though.
  var publicKeys = [];
  var localDevice = crypto.createECDH(thaliConfig.BEACON_CURVE);
  var localDeviceKey = localDevice.generateKeys();
  var expiration = 9000;

  var device1 = crypto.createECDH(thaliConfig.BEACON_CURVE);
  var device1Key = device1.generateKeys();
  var device2 = crypto.createECDH(thaliConfig.BEACON_CURVE);
  var device2Key = device2.generateKeys();
  var device3 = crypto.createECDH(thaliConfig.BEACON_CURVE);
  var device3Key = device3.generateKeys();

  publicKeys.push(device1Key, device2Key, device3Key);

  var beaconStreamWithPreAmble = notificationBeacons.generatePreambleAndBeacons(
    publicKeys,
    localDevice,
    expiration
  );

  var success = 0;
  var localDeviceKeyHash =
    notificationBeacons.createPublicKeyHash(localDeviceKey);
  var spuriousECDH = crypto.createECDH(thaliConfig.BEACON_CURVE);
  var spuriousECDHKey = spuriousECDH.generateKeys();
  var addressBookCallback = function (unencryptedKeyId) {
    if (unencryptedKeyId.compare(localDeviceKeyHash) === 0) {
      ++success;
      return spuriousECDHKey;
    }
    return null;
  };

  var results = notificationBeacons.parseBeacons(
    beaconStreamWithPreAmble,
    device3,
    addressBookCallback
  );

  t.equal(results, null);
  t.equal(success, 1);
  t.end();
});

var preAmbleSizeInBytes = notificationBeacons.PUBLIC_KEY_SIZE +
  notificationBeacons.EXPIRATION_SIZE;

test('#parseBeacons addressBookCallback returns public key', function (t) {
  var publicKeys = [];
  var localDevice = crypto.createECDH(thaliConfig.BEACON_CURVE);
  var localDeviceKey = localDevice.generateKeys();
  var expiration = 9000;

  var device1 = crypto.createECDH(thaliConfig.BEACON_CURVE);
  var device1Key = device1.generateKeys();
  var device2 = crypto.createECDH(thaliConfig.BEACON_CURVE);
  var device2Key = device2.generateKeys();
  var device3 = crypto.createECDH(thaliConfig.BEACON_CURVE);
  var device3Key = device3.generateKeys();

  publicKeys.push(device1Key, device2Key, device3Key);

  var beaconStreamWithPreAmble = notificationBeacons.generatePreambleAndBeacons(
    publicKeys,
    localDevice,
    expiration
  );

  var success = 0;
  var localDeviceKeyHash =
    notificationBeacons.createPublicKeyHash(localDeviceKey);
  var addressBookCallback = function (unencryptedKeyId) {
    if (unencryptedKeyId.compare(localDeviceKeyHash) === 0) {
      success++;
      return localDeviceKey;
    }
    return null;
  };

  var results = notificationBeacons.parseBeacons(
    beaconStreamWithPreAmble,
    device2,
    addressBookCallback
  );

  var preAmble = testUtils.extractPreAmble(beaconStreamWithPreAmble);
  var beacon = testUtils.extractBeacon(beaconStreamWithPreAmble, 1);

  // Remember spurious matches can cause the count to be higher than 1, with
  // GCM it would be guaranteed to be exactly one
  t.ok(success >= 1 && success < 3, 'right number of calls to address book');
  t.ok(results.preAmble.compare(preAmble) === 0, 'good preAmble');
  t.ok(results.unencryptedKeyId.compare(localDeviceKeyHash) === 0, 'good ' +
    'unencryptedKeyId');
  t.ok(results.encryptedBeaconKeyId.compare(beacon) === 0, 'good beacon');
  t.end();
});

test('validate generatePskIdentityField', function (t) {
  var preAmble = new Buffer(73);
  var beacon = new Buffer(48);
  var actualResult =
    notificationBeacons.generatePskIdentityField(preAmble, beacon);
  var decodedActualResult = urlSafeBase64.decode(actualResult);

  var hash = crypto.createHash('sha256');
  hash.update(Buffer.concat([preAmble, beacon]));
  var calculatedDecodedResult = hash.digest();

  t.ok(decodedActualResult.compare(calculatedDecodedResult) === 0,
    'decoded buffers match');
  t.end();
});

test('validate generatePskSecret', function (t) {
  var device1 = crypto.createECDH(thaliConfig.BEACON_CURVE);
  var device1Key = device1.generateKeys();

  var device2 = crypto.createECDH(thaliConfig.BEACON_CURVE);
  var device2Key = device2.generateKeys();

  var preAmble = new Buffer(preAmbleSizeInBytes);
  var beacon = new Buffer(notificationBeacons.BEACON_SIZE);
  var pskIdentityField =
    notificationBeacons.generatePskIdentityField(preAmble, beacon);

  var device1Secret = notificationBeacons.generatePskSecret(device1,
    device2Key, pskIdentityField);

  var device2Secret = notificationBeacons.generatePskSecret(device2,
    device1Key, pskIdentityField);

  t.ok(device1Secret.compare(device2Secret) === 0, 'secrets match');
  t.end();
});

test('validate generatePskSecrets', function (t) {
  var device1 = crypto.createECDH(thaliConfig.BEACON_CURVE);
  var device1Key = device1.generateKeys();

  var device2 = crypto.createECDH(thaliConfig.BEACON_CURVE);
  var device2Key = device2.generateKeys();

  var device3 = crypto.createECDH(thaliConfig.BEACON_CURVE);
  var device3Key = device3.generateKeys();

  var localDevice = crypto.createECDH(thaliConfig.BEACON_CURVE);
  localDevice.generateKeys();
  var expiration = 9000;

  var publicKeys = [device1Key, device2Key, device3Key];

  var beaconsWithPreamble =
    notificationBeacons.
      generatePreambleAndBeacons(publicKeys, localDevice, expiration);

  var pskMap = notificationBeacons.generatePskSecrets(publicKeys,
      localDevice, beaconsWithPreamble);

  t.equal(Object.keys(pskMap).length, publicKeys.length, 'Matching numbers');

  var preAmble = testUtils.extractPreAmble(beaconsWithPreamble);

  for (var i = 0; i < publicKeys.length; ++i) {
    var beacon = testUtils.extractBeacon(beaconsWithPreamble, i);
    var pskIdentityField =
      notificationBeacons.generatePskIdentityField(preAmble, beacon);
    var pskSecret = notificationBeacons.generatePskSecret(localDevice,
        publicKeys[i], pskIdentityField);
    var mapEntry = pskMap[pskIdentityField];
    t.ok(mapEntry, 'We have an entry!');
    t.ok(publicKeys[i].compare(mapEntry.publicKey) === 0, 'keys match');
    t.ok(pskSecret.compare(mapEntry.pskSecret) === 0, 'secrets match');
  }

  t.end();
});

test('validate generateBeaconStreamAndSecrets', function (t) {
  var device1 = crypto.createECDH(thaliConfig.BEACON_CURVE);
  var device1Key = device1.generateKeys();

  var localDevice = crypto.createECDH(thaliConfig.BEACON_CURVE);
  localDevice.generateKeys();
  var expiration = 9000;

  var publicKeys = [device1Key];

  var beaconStreamAndDictionary =
    notificationBeacons
      .generateBeaconStreamAndSecrets(publicKeys, localDevice, expiration);

  var dummyForSizeOnly =
    notificationBeacons
      .generatePreambleAndBeacons(publicKeys, localDevice, expiration);

  // Since each call to generatePreambleAndBeacons generates a new ephemeral
  // key we can't compare them directly because each call will be different
  t.ok(beaconStreamAndDictionary.beaconStreamWithPreAmble.length ===
    dummyForSizeOnly.length, 'Streams have same length');

  var pskMap =
    notificationBeacons
      .generatePskSecrets(publicKeys, localDevice,
        beaconStreamAndDictionary.beaconStreamWithPreAmble);


  var keyAndSecret =  beaconStreamAndDictionary.keyAndSecret;
  t.ok(Object.keys(pskMap).length ===
         Object.keys(keyAndSecret).length,
      'matching size');
  var keys = Object.keys(pskMap);
  keys.forEach(function (key)  {
    t.ok(pskMap[key].publicKey.compare(keyAndSecret[key].publicKey) === 0,
      'keys match');
    t.ok(pskMap[key].pskSecret.compare(keyAndSecret[key].pskSecret) === 0,
      'secrets match');
  });

  t.end();
});
