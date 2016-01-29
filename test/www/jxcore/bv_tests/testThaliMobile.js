'use strict';

var ThaliMobile = require('thali/NextGeneration/thaliMobile');
var tape = require('../lib/thali-tape');

var test = tape({
  setup: function(t) {
    t.end();
  },
  teardown: function(t) {
    t.end();
  }
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
