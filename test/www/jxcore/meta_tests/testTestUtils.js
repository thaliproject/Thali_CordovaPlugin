'use strict';

var path = require('path');
var fs = require('fs');

var testUtils = require('../lib/testUtils.js');
var tape = require('../lib/thaliTape');

var test = tape({
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    t.end();
  }
});

test('should return same temporary folder when called multiple times',
function (t) {
  var firstDirectory = testUtils.tmpDirectory();
  var secondDirectory = testUtils.tmpDirectory();
  t.equal(firstDirectory, secondDirectory);
  t.end();
});

test('should be able to write to the temporary folder', function (t) {
  var temporaryDirectory = testUtils.tmpDirectory();
  console.log(temporaryDirectory);
  fs.mkdir(path.join(temporaryDirectory, 'somePath'), function (err) {
    t.equal(err, null, 'no error returned when creating a subfolder');
    t.end();
  });
});

test('can call hasRequiredHardware', function (t) {
  testUtils.hasRequiredHardware()
  .then(function (hasRequiredHardware) {
    t.ok(hasRequiredHardware === true || hasRequiredHardware === false,
      'resolves with a boolean');
    t.end();
  });
});
