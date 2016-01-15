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
    // Need to call stops here to ensure we're in stopped state since Mobile is a static
    // singleton
    Mobile('StopListeningForAdvertisements').callNative(function (err) {
      t.notOk(err, "Should be able to call StopListeningForAdvertisments in teardown");
      Mobile('StopUpdateAdvertisingAndListenForIncomingConnections').callNative(function(err) {
        t.notOk(
          err, 
          "Should be able to call StopAdvertisingAndListenForIncomingConnections in teardown"
        );
        t.end();
      });
    });
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

test('Can call Start/StopUpdateAdvertisingAndListenForIncomingConnections', function (t) {
  Mobile('StartUpdateAdvertisingAndListenForIncomingConnections').callNative(4242, function (err) {
    t.notOk(err, 'Can call StartUpdateAdvertisingAndListenForIncomingConnections without error');
    Mobile('StopUpdateAdvertisingAndListenForIncomingConnections').callNative(function (err) {
      t.notOk(
        err, 'Can call StopUpdateAdvertisingsingAndListenForIncomingConnections without error'
      );
      t.end();
    });
  });
});

test('Calling StartUpdateAdvertisingAndListeningForIncomingConnections twice is NOT and error', 
function (t) {
  Mobile('StartUpdateAdvertisingAndListenForIncomingConnections').callNative(4242, function (err) {
    t.notOk(err, 'Can call StartUpdateAdvertisingAndListenForIncomingConnections without error');
    Mobile('StartUpdateAdvertisingAndListenForIncomingConnections').callNative(4243, 
    function (err) {
      t.notOk(
        err, 
        'Can call StartUpdateAdvertisingsingAndListenForIncomingConnections twice without error'
      );
      t.end();
    });
  });
});

test('PeerAvailabilityChange is called', function (t) {

  var complete = false;

  Mobile("PeerAvailabilityChanged").registerToNative(function(peers) {

    if (!complete)
    {
      t.ok(peers instanceof Array, "peers must be an array");
      t.ok(peers.length != 0, "peers must not be zero-length");

      t.ok(peers[0].hasOwnProperty("peerIdentifier"), "peer must have peerIdentifier");
      t.ok(typeof peers[0].peerIdentifier === 'string', "peerIdentifier must be a string");
      
      t.ok(peers[0].hasOwnProperty("peerAvailable"), "peer must have peerAvailable");
      t.ok(peers[0].hasOwnProperty("pleaseConnect"), "peer must have pleaseConnect");

      complete = true;
      t.end();
    }
  });

  Mobile('StartUpdateAdvertisingAndListenForIncomingConnections').callNative(4242, function (err) {
    t.notOk(err, 'Can call StartUpdateAdvertisingAndListenForIncomingConnections without error');
    Mobile('StartListeningForAdvertisements').callNative(function (err) {
      t.notOk(err, 'Can call StartListeningForAdvertisements without error');
    });
  });
});


