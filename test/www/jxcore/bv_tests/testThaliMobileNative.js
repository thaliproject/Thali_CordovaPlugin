"use strict";

if (!jxcore.utils.OSInfo().isMobile) {
  return;
}

var tape = require('../lib/thali-tape');

test('Can call Start/StopListeningForAdvertisements', function (t) {
  Mobile('StartListeningForAdvertisements').callNative(function (err) {
    t.notOk(err, 'Can call StartListeningForAdvertisements without error');
    Mobile('StopListeningForAdvertisements').callNative(function (err) {
      t.notOk(err, 'Can call StopListeningForAdvertisements without error');
      t.end();
    });
  });
});

test('Calling StopListeningForAdvertisements before Start is an error', function (t) {
  Mobile('StopListeningForAdvertisements').callNative(function (err) {
    t.Ok(err, 'Calling Stop before Start is an error');
    t.end();
  });
});

test('Can call Start/StopUpdateAdvertisingAndListenForIncomingConnections', function (t) {
  Mobile('StartUpdateAdvertisingAndListenForIncomingConnections').callNative(function (err) {
    t.notOk(err, 'Can call StartUpdateAdvertisingAndListenForIncomingConnections without error');
    Mobile('Can StopUpdateAdvertisingAndListenForIncomingConnections').callNative(function (err) {
      t.notOk(err, 'Can call StopUpdateAdvertisingAndListenForIncomingConnections without error');
      t.end();
    });
  });
});

test('Calling StopUpdateAdvertisingAndListenForIncomingConnectionsStopUAALFIC before start is an error", function (t) {
  Mobile('StopUpdateAdvertisingAndListenForIncomingConnections').callNative(function (err) {
    t.notOk(err, 'Calling Stop before Start is an error');
    t.end();
  });
});
