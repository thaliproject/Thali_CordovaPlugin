'use strict';

var ThaliMobile = require('thali/NextGeneration/thaliMobile');
var tape = require('../lib/thali-tape');
var express = require('express');

var test = tape({
  setup: function(t) {
    t.end();
  },
  teardown: function(t) {
    ThaliMobile.stop()
    .then(function (combinedResult) {
      t.end();
    });
  }
});

test('#start should fail if called twice in a row', function (t) {
  ThaliMobile.start(express.Router())
  .then(function (combinedResult) {
    t.equal(combinedResult.wifiResult, null, 'first call should succeed');
    return ThaliMobile.start(express.Router());
  })
  .catch(function (error) {
    t.equal(error.message, 'Call Stop!', 'specific error should be returned');
    t.end();
  });
});

test('should be able to call #stopListeningForAdvertisements many times', function (t) {
  ThaliMobile.stopListeningForAdvertisements()
  .then(function (combinedResult) {
    t.equal(combinedResult.wifiResult, null, 'wifiResult error should be null');
    return ThaliMobile.stopListeningForAdvertisements();
  })
  .then(function (combinedResult) {
    t.equal(combinedResult.wifiResult, null, 'wifiResult error should still be null');
    t.end();
  });
});
