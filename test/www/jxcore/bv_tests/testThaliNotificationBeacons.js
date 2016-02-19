'use strict';

var tape = require('../lib/thali-tape');
var notificationBeacons =
  require('thali/NextGeneration/notification/thaliNotificationBeacons');
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
  localDevice.generateKeys();
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

  var addressBookCallback = function () {
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
  var publicKeys = [];
  var localDevice = crypto.createECDH(notificationBeacons.SECP256K1);
  localDevice.generateKeys();
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

  var called = 0;
  var newECDH = crypto.createECDH(notificationBeacons.SECP256K1);
  var newECDHKey = newECDH.generateKeys();
  var newECDHKeyHash = notificationBeacons.createPublicKeyHash(newECDHKey);
  var addressBookCallback = function (unencryptedKeyId) {
    called++;
    if (unencryptedKeyId.compare(newECDHKeyHash) === 0) {
      return newECDHKey;
    }
    return null;
  };

  var results = notificationBeacons.parseBeacons(
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
  var localDevice = crypto.createECDH(notificationBeacons.SECP256K1);
  var localDeviceKey = localDevice.generateKeys();
  var localDeviceKeyHash =
    notificationBeacons.createPublicKeyHash(localDeviceKey);
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

  var called = 0;

  var addressBookCallback = function (unencryptedKeyId) {
    called++;
    if (unencryptedKeyId.compare(localDeviceKeyHash) === 0) {
      return localDeviceKey;
    }
    return null;
  };

  var results = notificationBeacons.parseBeacons(
    beaconStreamWithPreAmble,
    device2,
    addressBookCallback
  );

  t.equal(called, 1);
  t.ok(results);
  t.end();
});

test('#parseBeacons with beacons both for and not for the user', function (t) {
  var ecdhForDeviceThatGeneratedBeacons =
    crypto.createECDH(notificationBeacons.SECP256K1);
  var publicKeyForDeviceThatGeneratedBeacons =
    ecdhForDeviceThatGeneratedBeacons.generateKeys();
  var publicKeyHashForDeviceThatGeneratedBeacons =
    notificationBeacons.
      createPublicKeyHash(publicKeyForDeviceThatGeneratedBeacons);

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
      ecdhForDeviceThatGeneratedBeacons,
      10 * 60 * 60 * 1000);

  var addressBookCallback = function (unencryptedKeyId) {
    if (unencryptedKeyId.compare(publicKeyHashForDeviceThatGeneratedBeacons) ===
                                 0) {
      return publicKeyForDeviceThatGeneratedBeacons;
    }
    return null;
  };

  var results = notificationBeacons.parseBeacons(
    beaconStreamWithPreAmble,
    ecdhForTargetDevice,
    addressBookCallback
  );

  t.ok(results.compare(publicKeyHashForDeviceThatGeneratedBeacons) === 0);
  t.end();
});
