'use strict';

var express = require('express');

if (typeof Mobile === 'undefined') {
  return;
}

var ThaliMobileNativeWrapper = require('thali/NextGeneration/thaliMobileNativeWrapper');
var validations = require('thali/validations');
var tape = require('../lib/thali-tape');

var test = tape({
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    ThaliMobileNativeWrapper.stop()
    .then(function () {
      t.end();
    });
  }
});

var testIdempotentFunction = function (t, functionName) {
  ThaliMobileNativeWrapper.start(express.Router())
  .then(function () {
    return ThaliMobileNativeWrapper[functionName]();
  })
  .then(function (error) {
    t.notOk(error, 'no errors');
    return ThaliMobileNativeWrapper[functionName]();
  })
  .then(function (error) {
    t.notOk(error, 'still no errors');
    t.end();
  });
};

var testFunctionBeforeStart = function (t, functionName) {
  ThaliMobileNativeWrapper[functionName]()
  .then(function () {
    t.fail('call should not succeed');
    t.end();
  })
  .catch(function (error) {
    t.equal(error.message, 'Call Start!', 'specific error should be returned');
    t.end();
  });
};

test('#startListeningForAdvertisements should fail if start not called',
  function (t) {
    testFunctionBeforeStart(t, 'startListeningForAdvertisements');
  }
);

test('#startUpdateAdvertisingAndListening should fail if start not called',
  function (t) {
    testFunctionBeforeStart(t, 'startUpdateAdvertisingAndListening');
  }
);

test('should be able to call #stopListeningForAdvertisements many times',
  function (t) {
    testIdempotentFunction(t, 'stopListeningForAdvertisements');
  }
);

test('should be able to call #startListeningForAdvertisements many times',
  function (t) {
    testIdempotentFunction(t, 'startListeningForAdvertisements');
  }
);

test('should be able to call #startUpdateAdvertisingAndListening many times',
  function (t) {
    testIdempotentFunction(t, 'startUpdateAdvertisingAndListening');
  }
);

test('should be able to call #stopAdvertisingAndListening many times',
  function (t) {
    testIdempotentFunction(t, 'stopAdvertisingAndListening');
  }
);

test('can get the network status before starting', function (t) {
  ThaliMobileNativeWrapper.getNonTCPNetworkStatus()
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

test('error returned with bad router', function (t) {
  ThaliMobileNativeWrapper.start('bad router')
  .then(function () {
    t.fail('should not succeed');
    t.end();
  })
  .catch(function (error) {
    t.equals(error.message, 'Bad Router', 'specific error expected');
    t.end();
  });
});