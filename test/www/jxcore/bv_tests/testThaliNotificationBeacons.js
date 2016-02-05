'use strict';

var tape = require('wrapping-tape');
var NotificationBeacons = require('thali/NextGeneration/thaliNotificationBeacons');
var crypto = require('crypto');
var Long = require('long');

// Constants
var SECP256K1 = 'secp256k1';

var notificationBecons;

var test = tape({
  setup: function(t) {
    notificationBecons = new NotificationBeacons();
    t.end();
  },
  teardown: function (t) {
    notificationBecons = null;
    t.end();
  }
});

test('#generatePreambleAndBeacons empty keys to notify', function (t) {
  var publicKeys = [];
  var localDevice = crypto.createECDH(SECP256K1);
  localDevice.generateKeys();
  var expiration = 9000;

  var results = notificationBecons.generatePreambleAndBeacons(
    publicKeys,
    localDevice,
    expiration
  );

  var pubKe = results.slice(0, 65);
  var expirationBuffer = results.slice(65, 65 + 8);

  t.equal(pubKe.length, 65);
  t.equal(expirationBuffer.length, 8);
  t.equal(Long.fromBits(expirationBuffer.readInt32BE(4), expirationBuffer.readInt32BE(0) << 8).toNumber(), expiration);
  t.equal(results.length, 65 + 8);
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

  var results = notificationBecons.generatePreambleAndBeacons(
    publicKeys,
    localDevice,
    expiration
  );

  var pubKe = results.slice(0, 65);
  var expirationBuffer = results.slice(65, 65 + 8);

  t.equal(pubKe.length, 65);
  t.equal(expirationBuffer.length, 8);
  t.equal(Long.fromBits(expirationBuffer.readInt32BE(4), expirationBuffer.readInt32BE(0) << 8).toNumber(), expiration);
  t.equal(results.length, 65 + 8 + 48 + 48 + 48);

  t.end();
});

test('#parseBeacons invalid ECDH public key in beaconStreamWithPreAmble', function (t) {
  var localDevice = crypto.createECDH(SECP256K1);
  localDevice.generateKeys();

  var beaconStreamWithPreAmble = new Buffer(62);

  var addressBookCallback = function () {
    return null;
  };

  t.throws(function () {
    notificationBecons.parseBeacons(beaconStreamWithPreAmble, localDevice, addressBookCallback);
  });

  t.end();
});

test('#parseBeacons invalid expiration in beaconStreamWithPreAmble', function (t) {
  var localDevice = crypto.createECDH(SECP256K1);
  localDevice.generateKeys();

  var beaconStreamWithPreAmble = new Buffer(70);

  var addressBookCallback = function () {
    return null;
  };

  t.throws(function () {
    notificationBecons.parseBeacons(beaconStreamWithPreAmble, localDevice, addressBookCallback);
  });

  t.end();
});

test('#parseBeacons no beacons returns null', function (t) {
  var publicKeys = [];
  var localDevice = crypto.createECDH(SECP256K1);
  localDevice.generateKeys();
  var expiration = 9000;

  var beaconStreamWithPreAmble = notificationBecons.generatePreambleAndBeacons(
    publicKeys,
    localDevice,
    expiration
  );

  var addressBookCallback = function () {
    return null;
  };

  var results = notificationBecons.parseBeacons(beaconStreamWithPreAmble, localDevice, addressBookCallback);

  t.equal(results, null);
  t.end();
});

test('#parseBeacons invalid size for encryptedBeaconKeyId in beaconStreamWithPreAmble', function (t) {
  var localDevice = crypto.createECDH(SECP256K1);
  localDevice.generateKeys();

  var beaconStreamWithPreAmble = new Buffer(104);

  var addressBookCallback = function () {
    return null;
  };

  t.throws(function () {
    notificationBecons.parseBeacons(beaconStreamWithPreAmble, localDevice, addressBookCallback);
  });

  t.end();
});

test('#parseBeacons addressBookCallback returns null for all', function (t) {
  var publicKeys = [];
  var localDevice = crypto.createECDH(SECP256K1);
  var localDeviceKey = localDevice.generateKeys();
  var expiration = 9000;

  var device1 = crypto.createECDH(SECP256K1);
  var device1Key = device1.generateKeys();
  var device2 = crypto.createECDH(SECP256K1);
  var device2Key = device2.generateKeys();
  var device3 = crypto.createECDH(SECP256K1);
  var device3Key = device3.generateKeys();

  publicKeys.push(device1Key, device2Key, device3Key);

  var beaconStreamWithPreAmble = notificationBecons.generatePreambleAndBeacons(
    publicKeys,
    localDevice,
    expiration
  );

  var addressBookCallback = function (unencryptedId) {
    return null;
  };

  var results = notificationBecons.parseBeacons(beaconStreamWithPreAmble, device1, addressBookCallback);

  t.equal(results, null);
  t.end();
});

test('#parseBeacons addressBookCallback returns public key', function (t) {
  var publicKeys = [];
  var localDevice = crypto.createECDH(SECP256K1);
  var localDeviceKey = localDevice.generateKeys();
  var expiration = 9000;

  var device1 = crypto.createECDH(SECP256K1);
  var device1Key = device1.generateKeys();
  var device2 = crypto.createECDH(SECP256K1);
  var device2Key = device2.generateKeys();
  var device3 = crypto.createECDH(SECP256K1);
  var device3Key = device3.generateKeys();

  publicKeys.push(device1Key, device2Key, device3Key);

  var beaconStreamWithPreAmble = notificationBecons.generatePreambleAndBeacons(
    publicKeys,
    localDevice,
    expiration
  );

  var addressBookCallback = function (unencryptedId) {
    return localDeviceKey;
  };

  var results = notificationBecons.parseBeacons(beaconStreamWithPreAmble, device1, addressBookCallback);

  t.ok(results);
  t.end();
});
