'use strict';

var tape = require('../lib/thali-tape');
var NotificationBeacons =
  require('thali/NextGeneration/thaliNotificationBeacons');
var crypto = require('crypto');
var Long = require('long');

// Constants
var SECP256K1 = 'secp256k1';

var NotificationBeacons;

var test = tape({
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    t.end();
  }
});

test('#generatePreambleAndBeacons null ECDH for local device', function (t) {
  var publicKeys = null;
  var localDevice = crypto.createECDH(SECP256K1);
  localDevice.generateKeys();
  var expiration = 9000;

  t.throws(function () {
    NotificationBeacons.generatePreambleAndBeacons(
      publicKeys,
      localDevice,
      expiration
    );
  }, 'publicKeysToNotify cannot be null');

  t.end();
});

test('#generatePreambleAndBeacons null ECDH for local device', function (t) {
  var publicKeys = [];
  var localDevice = null;
  var expiration = 9000;

  t.throws(function () {
    NotificationBeacons.generatePreambleAndBeacons(
      publicKeys,
      localDevice,
      expiration
    );
  }, 'ecdhForLocalDevice cannot be null');

  t.end();
});

test('#generatePreambleAndBeacons expiration out of range', function (t) {
  var publicKeys = [];
  var localDevice = crypto.createECDH(SECP256K1);
  localDevice.generateKeys();
  var expiration = -1;

  t.throws(function () {
    NotificationBeacons.generatePreambleAndBeacons(
      publicKeys,
      localDevice,
      expiration
    );
  }, 'secondsUntilExpiration out of range.');

  t.end();
});

test('#generatePreambleAndBeacons empty keys to notify', function (t) {
  var publicKeys = [];
  var localDevice = crypto.createECDH(SECP256K1);
  localDevice.generateKeys();
  var expiration = 9000;

  var results = NotificationBeacons.generatePreambleAndBeacons(
    publicKeys,
    localDevice,
    expiration
  );

  t.equal(results, null);
  t.end();
});

test('#generatePreambleAndBeacons multiple keys to notify', function (t) {
  var publicKeys = [];
  var localDevice = crypto.createECDH(SECP256K1);
  localDevice.generateKeys();
  var expiration = 9000;

  var device1 = crypto.createECDH(SECP256K1).generateKeys();
  var device2 = crypto.createECDH(SECP256K1).generateKeys();
  var device3 = crypto.createECDH(SECP256K1).generateKeys();

  publicKeys.push(device1, device2, device3);

  var results = NotificationBeacons.generatePreambleAndBeacons(
    publicKeys,
    localDevice,
    expiration
  );

  var pubKe = results.slice(0, 65);
  var expirationBuffer = results.slice(65, 65 + 8);

  t.equal(pubKe.length, 65);
  t.equal(expirationBuffer.length, 8);
  t.equal(Long.fromBits(expirationBuffer.readInt32BE(4),
                        expirationBuffer.readInt32BE(0)).toNumber(),
                        expiration);
  t.equal(results.length, 65 + 8 + 48 + 48 + 48);

  t.end();
});

test('#parseBeacons invalid ECDH public key in beaconStreamWithPreAmble',
  function (t) {
    var localDevice = crypto.createECDH(SECP256K1);
    localDevice.generateKeys();

    var beaconStreamWithPreAmble = new Buffer(62);

    var addressBookCallback = function () {
      t.fail();
    };

    t.throws(function () {
      NotificationBeacons.parseBeacons(
        beaconStreamWithPreAmble,
        localDevice,
        addressBookCallback
      );
    });

    t.end();
  });

test('#parseBeacons invalid expiration in beaconStreamWithPreAmble',
  function (t) {
    var localDevice = crypto.createECDH(SECP256K1);
    localDevice.generateKeys();

    var beaconStreamWithPreAmble = new Buffer(70);

    var addressBookCallback = function () {
      t.fail();
    };

    t.throws(function () {
      NotificationBeacons.parseBeacons(
        beaconStreamWithPreAmble,
        localDevice,
        addressBookCallback
      );
    }, 'Preamble expiration must be a 64 bit integer');

    t.end();
});

test('#parseBeacons expiration out of range', function (t) {
  var localDevice = crypto.createECDH(SECP256K1);
  localDevice.generateKeys();

  var pubKe = crypto.createECDH(SECP256K1).generateKeys();
  var expiration = Long.fromNumber(-1);
  var expirationBuffer = new Buffer(8);
  expirationBuffer.writeInt32BE(expiration.high, 0);
  expirationBuffer.writeInt32BE(expiration.low, 4);
  var beaconStreamWithPreAmble = Buffer.concat([pubKe, expirationBuffer]);

  var addressBookCallback = function () {
    t.fail();
    return null;
  };

  t.throws(function () {
    NotificationBeacons.parseBeacons(
      beaconStreamWithPreAmble,
      localDevice,
      addressBookCallback
    );
  }, 'Expiration out of range');

  t.end();
});

test('#parseBeacons no beacons returns null', function (t) {
  var publicKeys = [];
  var localDevice = crypto.createECDH(SECP256K1);
  localDevice.generateKeys();
  var expiration = 9000;

  var beaconStreamWithPreAmble = NotificationBeacons.generatePreambleAndBeacons(
    publicKeys,
    localDevice,
    expiration
  );

  var addressBookCallback = function () {
    t.fail();
    return null;
  };

  var results = NotificationBeacons.parseBeacons(
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
    var localDevice = crypto.createECDH(SECP256K1);
    localDevice.generateKeys();

    var beaconStreamWithPreAmble = new Buffer(104);

    var addressBookCallback = function () {
      return null;
    };

    t.throws(function () {
      NotificationBeacons.parseBeacons(
        beaconStreamWithPreAmble,
        localDevice,
        addressBookCallback
      );
    }, 'Malformed encrypted beacon key ID');

    t.end();
  });

test('#parseBeacons addressBookCallback fails decrypt', function (t) {
  var publicKeys = [];
  var localDevice = crypto.createECDH(SECP256K1);
  localDevice.generateKeys();
  var expiration = 9000;

  var device1 = crypto.createECDH(SECP256K1);
  var device1Key = device1.generateKeys();
  var device2 = crypto.createECDH(SECP256K1);
  var device2Key = device2.generateKeys();
  var device3 = crypto.createECDH(SECP256K1);
  var device3Key = device3.generateKeys();

  publicKeys.push(device1Key, device2Key, device3Key);

  var beaconStreamWithPreAmble = NotificationBeacons.generatePreambleAndBeacons(
    publicKeys,
    localDevice,
    expiration
  );

  var addressBookCallback = function () {
    t.fail();
    return null;
  };

  var badDevice = crypto.createECDH(SECP256K1);
  badDevice.generateKeys();
  var results = NotificationBeacons.parseBeacons(
    beaconStreamWithPreAmble,
    badDevice,
    addressBookCallback
  );

  t.equal(results, null);
  t.end();
});

test('#parseBeacons addressBookCallback returns no matches', function (t) {
  var publicKeys = [];
  var localDevice = crypto.createECDH(SECP256K1);
  localDevice.generateKeys();
  var expiration = 9000;

  var device1 = crypto.createECDH(SECP256K1);
  var device1Key = device1.generateKeys();
  var device2 = crypto.createECDH(SECP256K1);
  var device2Key = device2.generateKeys();
  var device3 = crypto.createECDH(SECP256K1);
  var device3Key = device3.generateKeys();

  publicKeys.push(device1Key, device2Key, device3Key);

  var beaconStreamWithPreAmble = NotificationBeacons.generatePreambleAndBeacons(
    publicKeys,
    localDevice,
    expiration
  );

  var called = 0;
  var newECDH = crypto.createECDH(SECP256K1);
  var newECDHKey = newECDH.generateKeys();
  var newECDHKeyHash = NotificationBeacons.createPublicKeyHash(newECDHKey);
  var addressBookCallback = function (unencryptedKeyId) {
    called++;
    if (unencryptedKeyId.compare(newECDHKeyHash) === 0) {
      return newECDHKey;
    }
    return null;
  };

  var results = NotificationBeacons.parseBeacons(
    beaconStreamWithPreAmble,
    device3,
    addressBookCallback
  );

  t.equal(results, null);
  t.equal(called, 1);
  t.end();
});

test('#parseBeacons addressBookCallback returns public key', function (t) {
  var publicKeys = [];
  var localDevice = crypto.createECDH(SECP256K1);
  var localDeviceKey = localDevice.generateKeys();
  var localDeviceKeyHash = NotificationBeacons.createPublicKeyHash(localDeviceKey);
  var expiration = 9000;

  var device1 = crypto.createECDH(SECP256K1);
  var device1Key = device1.generateKeys();
  var device2 = crypto.createECDH(SECP256K1);
  var device2Key = device2.generateKeys();
  var device3 = crypto.createECDH(SECP256K1);
  var device3Key = device3.generateKeys();

  publicKeys.push(device1Key, device2Key, device3Key);

  var beaconStreamWithPreAmble = NotificationBeacons.generatePreambleAndBeacons(
    publicKeys,
    localDevice,
    expiration
  );

  var called = 0;

  var addressBookCallback = function (unencryptedKeyId) {
    called++;
    if (unencryptedKeyId.compare(localDeviceKeyHash) === 0) {
      return localDeviceKey;
    }
    return null;
  };

  var results = NotificationBeacons.parseBeacons(
    beaconStreamWithPreAmble,
    device2,
    addressBookCallback
  );

  t.equal(called, 1);
  t.ok(results);
  t.end();
});

test('#parseBeacons with beacons both for and not for the user', function (t) {
  var ecdhForDeviceThatGeneratedBeacons = crypto.createECDH(SECP256K1);
  var publicKeyForDeviceThatGeneratedBeacons =
    ecdhForDeviceThatGeneratedBeacons.generateKeys();
  var publicKeyHashForDeviceThatGeneratedBeacons =
    NotificationBeacons.
      createPublicKeyHash(publicKeyForDeviceThatGeneratedBeacons);

  var ecdhForDummyDevice = crypto.createECDH(SECP256K1);
  var publicKeyForDummyDevice = ecdhForDummyDevice.generateKeys();

  var ecdhForTargetDevice = crypto.createECDH(SECP256K1);
  var publicKeyForTargetDevice = ecdhForTargetDevice.generateKeys();

  var publicKeys = [];
  // Note that the first key is explicitly not for the device
  publicKeys.push(publicKeyForDummyDevice, publicKeyForTargetDevice);

  var beaconStreamWithPreAmble =
    NotificationBeacons.generatePreambleAndBeacons(
      publicKeys,
      ecdhForDeviceThatGeneratedBeacons,
      10 * 60 * 60 * 1000);

  var addressBookCallback = function (unencryptedKeyId) {
    if (unencryptedKeyId.compare(publicKeyHashForDeviceThatGeneratedBeacons) ===
                                 0) {
      return publicKeyForDeviceThatGeneratedBeacons;
    }
    return null;
  };

  var results = NotificationBeacons.parseBeacons(beaconStreamWithPreAmble,
                                                 ecdhForTargetDevice,
                                                 addressBookCallback);

  t.ok(results.compare(publicKeyHashForDeviceThatGeneratedBeacons) === 0);
  t.end();
});
