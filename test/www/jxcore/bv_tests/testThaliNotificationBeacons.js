'use strict';

var tape = require('../lib/thali-tape');
var notificationBeacons =
  require('thali/NextGeneration/thaliNotificationBeacons');
var crypto = require('crypto');
var long = require('long');

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
  var localDevice = crypto.createECDH(notificationBeacons.SECP256K1);
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
  var localDevice = crypto.createECDH(notificationBeacons.SECP256K1);
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
  var localDevice = crypto.createECDH(notificationBeacons.SECP256K1);
  localDevice.generateKeys();
  var expiration = 9000;

  var device1 = crypto.createECDH(notificationBeacons.SECP256K1).generateKeys();
  var device2 = crypto.createECDH(notificationBeacons.SECP256K1).generateKeys();
  var device3 = crypto.createECDH(notificationBeacons.SECP256K1).generateKeys();

  publicKeys.push(device1, device2, device3);

  var oldNow = Date.now();
  var results = notificationBeacons.generatePreambleAndBeacons(
    publicKeys,
    localDevice,
    expiration
  );

  var pubKe = results.slice(0, 65);
  var expirationBuffer = results.slice(65, 65 + 8);

  t.equal(pubKe.length, 65);
  t.equal(expirationBuffer.length, 8);
  var expirationDate =
    long.fromBits(expirationBuffer.readInt32BE(4),
                  expirationBuffer.readInt32BE(0))
      .toNumber();
  var outputExpiration = expirationDate - oldNow;
  var errorRange = 250 + 100; // 250 is the maximum fuzz and 100 just incase
  t.ok(outputExpiration <= expiration + errorRange &&
       outputExpiration >= expiration - errorRange);
  t.equal(results.length, 65 + 8 + 48 + 48 + 48);

  t.end();
});

test('#parseBeacons invalid ECDH public key in beaconStreamWithPreAmble',
  function (t) {
    var localDevice = crypto.createECDH(notificationBeacons.SECP256K1);
    localDevice.generateKeys();

    var beaconStreamWithPreAmble = new Buffer(62);

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
    var localDevice = crypto.createECDH(notificationBeacons.SECP256K1);
    localDevice.generateKeys();

    var beaconStreamWithPreAmble = new Buffer(70);

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
  var localDevice = crypto.createECDH(notificationBeacons.SECP256K1);
  localDevice.generateKeys();

  var pubKe = crypto.createECDH(notificationBeacons.SECP256K1).generateKeys();
  var expiration = long.fromNumber(Date.now() - 1);
  var expirationBuffer = new Buffer(8);
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
  var localDevice = crypto.createECDH(notificationBeacons.SECP256K1);
  localDevice.generateKeys();

  var pubKe = crypto.createECDH(notificationBeacons.SECP256K1).generateKeys();
  var expiration = long.fromNumber(Date.now() + notificationBeacons.ONE_DAY +
    1000);
  var expirationBuffer = new Buffer(8);
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
  var localDevice = crypto.createECDH(notificationBeacons.SECP256K1);
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
    var localDevice = crypto.createECDH(notificationBeacons.SECP256K1);
    localDevice.generateKeys();

    var beaconStreamWithPreAmble = new Buffer(104);

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
  var localDevice = crypto.createECDH(notificationBeacons.SECP256K1);
  var localDeviceKey = localDevice.generateKeys();
  var expiration = 9000;

  var device1 = crypto.createECDH(notificationBeacons.SECP256K1);
  var device1Key = device1.generateKeys();
  var device2 = crypto.createECDH(notificationBeacons.SECP256K1);
  var device2Key = device2.generateKeys();
  var device3 = crypto.createECDH(notificationBeacons.SECP256K1);
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

  var badDevice = crypto.createECDH(notificationBeacons.SECP256K1);
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
  var localDevice = crypto.createECDH(notificationBeacons.SECP256K1);
  var localDeviceKey = localDevice.generateKeys();
  var expiration = 9000;

  var device1 = crypto.createECDH(notificationBeacons.SECP256K1);
  var device1Key = device1.generateKeys();
  var device2 = crypto.createECDH(notificationBeacons.SECP256K1);
  var device2Key = device2.generateKeys();
  var device3 = crypto.createECDH(notificationBeacons.SECP256K1);
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
  var localDevice = crypto.createECDH(notificationBeacons.SECP256K1);
  var localDeviceKey = localDevice.generateKeys();
  var expiration = 9000;

  var device1 = crypto.createECDH(notificationBeacons.SECP256K1);
  var device1Key = device1.generateKeys();
  var device2 = crypto.createECDH(notificationBeacons.SECP256K1);
  var device2Key = device2.generateKeys();
  var device3 = crypto.createECDH(notificationBeacons.SECP256K1);
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
  var spuriousECDH = crypto.createECDH(notificationBeacons.SECP256K1);
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

test('#parseBeacons addressBookCallback returns public key', function (t) {
  var publicKeys = [];
  var localDevice = crypto.createECDH(notificationBeacons.SECP256K1);
  var localDeviceKey = localDevice.generateKeys();
  var expiration = 9000;

  var device1 = crypto.createECDH(notificationBeacons.SECP256K1);
  var device1Key = device1.generateKeys();
  var device2 = crypto.createECDH(notificationBeacons.SECP256K1);
  var device2Key = device2.generateKeys();
  var device3 = crypto.createECDH(notificationBeacons.SECP256K1);
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

  t.equal(success, 1);
  t.ok(results.compare(localDeviceKeyHash) === 0);
  t.end();
});

test('#parseBeacons with beacons both for and not for the user', function (t) {
  var localDevice = crypto.createECDH(notificationBeacons.SECP256K1);
  var localDeviceKey = localDevice.generateKeys();

  var ecdhForDummyDevice = crypto.createECDH(notificationBeacons.SECP256K1);
  var publicKeyForDummyDevice = ecdhForDummyDevice.generateKeys();

  var ecdhForTargetDevice = crypto.createECDH(notificationBeacons.SECP256K1);
  var publicKeyForTargetDevice = ecdhForTargetDevice.generateKeys();

  var publicKeys = [];
  // Note that the first key is explicitly not for the device
  publicKeys.push(publicKeyForDummyDevice, publicKeyForTargetDevice);

  var beaconStreamWithPreAmble =
    notificationBeacons.generatePreambleAndBeacons(
      publicKeys,
      localDevice,
      10 * 60 * 60 * 1000);

  var success = 0;
  var localDeviceKeyHash =
    notificationBeacons.
    createPublicKeyHash(localDeviceKey);
  var addressBookCallback = function (unencryptedKeyId) {
    if (unencryptedKeyId.compare(localDeviceKeyHash) === 0) {
      ++success;
      return localDeviceKey;
    }
    return null;
  };

  var results = notificationBeacons.parseBeacons(
    beaconStreamWithPreAmble,
    ecdhForTargetDevice,
    addressBookCallback
  );

  t.equal(success, 1);
  t.ok(results.compare(localDeviceKeyHash) === 0);
  t.end();
});
