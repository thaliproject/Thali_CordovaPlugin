'use strict';

var tape = require('../../lib/thaliTape');
var identityExchangeUtils = require('thali/identityExchange/identityExchangeUtils');

var test = tape({
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    t.end();
  }
});

test('test compareEqualSizeBuffers', function (t) {
  var testValues = [
      ['', ''],
      [null, null],
      [new Buffer([0, 0], '')],
      ['foo', new Buffer([0, 1])],
      [new Buffer([9, 9]), new Buffer([9, 9, 9])]
  ];
  testValues.forEach(function (testValue) {
    t.throws(function () {
      identityExchangeUtils.compareEqualSizeBuffers(testValue[0], testValue[1]);
    });
  });

  var moreTestValues = [
      { result: -1, values: [
          [[0], [1]],
          [[0, 1, 1], [1, 1, 1]],
          [[7, 7, 6], [7, 7, 7]]
      ]},
      { result: 0, values: [
          [[0], [0]],
          [[1, 1, 1, 1], [1, 1, 1, 1]]
      ]},
      { result: 1, values: [
          [[1], [0]],
          [[0, 0, 0, 2], [0, 0, 0, 1]]
      ]}
  ];
  moreTestValues.forEach(function (testPair) {
    testPair.values.forEach(function (value) {
      var buffer1 = new Buffer(value[0]);
      var buffer2 = new Buffer(value[1]);
      var result = identityExchangeUtils.compareEqualSizeBuffers(buffer1, buffer2);
      t.equal(testPair.result, result);
    });
  });
  t.end();
});
