'use strict';

var uuid = require('uuid');

var tape = require('../lib/thaliTape');
var USN = require('thali/NextGeneration/utils/usn');

var test = tape({});

test('Correctly parses/stringifies USN', function (t) {
  var someUuid = uuid.v4();
  var someGeneration = 4;

  var usn = 'data:' + someUuid + ':' + someGeneration;
  var invalidPrefix = 'foo:' + someUuid + ':' + someGeneration;
  var invalidIdentifier = 'data:a:b:c:0';
  var invalidGeneration = 'data:' + someUuid + ':notanumber';

  var peer = {
    peerIdentifier: someUuid,
    generation: someGeneration
  };

  t.deepEqual(USN.parse(usn), peer, 'correctly parses USN string');
  t.throws(function () {
    USN.parse(invalidPrefix);
  }, 'throws if usn has invalid prefix');
  t.throws(function () {
    USN.parse(invalidIdentifier);
  }, 'throws if usn has invalid identifier format');
  t.throws(function () {
    USN.parse(invalidGeneration);
  }, 'throws if usn has invalid generation');

  t.equal(USN.stringify(peer), usn, 'correctly stringifies peer');
  t.end();
});
