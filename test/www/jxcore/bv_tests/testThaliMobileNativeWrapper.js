'use strict';

var ThaliMobileNativeWrapper = require('thali/NextGeneration/thaliMobileNativeWrapper');
var validations = require('thali/validations');
var tape = require('../lib/thali-tape');

var test = tape({
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    ThaliMobileNativeWrapper.stop().then(function () {
      t.end();
    });
  }
});

test('error returned if network status called before starting', function (t) {
  ThaliMobileNativeWrapper.getNonTCPNetworkStatus()
  .then(function () {
    t.fail('call should not succeed');
    t.end();
  })
  .catch(function (error) {
    t.equal(error.message, 'Call Start!', 'specific error should be received');
    t.end();
  });
});;

test('can get the network status after started', function (t) {
  ThaliMobileNativeWrapper.start()
  .then(function () {
    return ThaliMobileNativeWrapper.getNonTCPNetworkStatus();
  })
  .then(function (networkChangedValue) {
    t.doesNotThrow(function () {
      var requiredProperties = [
        'wifi',
        'bluetooth',
        'bluetoothLowEnergy',
        'cellular'
      ];
      for (var index in requiredProperties) {
        validations.ensureNonNullOrEmptyString(
          networkChangedValue[requiredProperties[index]]);
      }
    }, 'network status should have certain non-empty properties');
    t.end();
  });
});
