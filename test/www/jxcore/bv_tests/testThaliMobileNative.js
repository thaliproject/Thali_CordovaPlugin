"use strict";

if (!jxcore.utils.OSInfo().isMobile) {
  return;
}

var tape = require('../lib/thali-tape');

var test = tape({
  setup: function(t) {
    t.end();
  },
  teardown: function(t) {
    t.end();
  }
});

test('Can call Start/StopListeningForAdvertisements', function (t) {
  Mobile('StartListeningForAdvertisements').callNative(function (err) {
    t.notOk(err, 'Can call StartListeningForAdvertisements without error');
    Mobile('StopListeningForAdvertisements').callNative(function (err) {
      t.notOk(err, 'Can call StopListeningForAdvertisements without error');
      t.end();
    });
  });
});

test('Calling StartListeningForAdvertisements twice is an error', function (t) {
  Mobile('StartListeningForAdvertisements').callNative(function (err) {
    t.notOk(err, 'Can call StartListeningForAdvertisements without error');
    Mobile('StartListeningForAdvertisements').callNative(function (err) {
      t.ok(err, 'Calling Start twice is an error');
      t.ok(err == "Call Stop!", 'Error must be "Call Stop!"');
      t.end();
    });
  });
});
