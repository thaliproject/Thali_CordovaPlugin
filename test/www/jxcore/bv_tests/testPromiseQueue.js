'use strict';
var tape = require('../lib/thali-tape');
var PromiseQueue = require('thali/NextGeneration/promiseQueue');

var currentUnhandledRejectionHandler = null;

function unhandledRejectionHandler(t) {
  return function (error, self) {
    t.fail('Got an unhandled rejection error: ' + error + ', ' +
      JSON.stringify(self));
  };
}

var test = tape({
  setup: function (t) {
    currentUnhandledRejectionHandler = unhandledRejectionHandler(t);
    process.on('unhandledRejection', currentUnhandledRejectionHandler);
    t.end();
  },
  teardown: function (t) {
    process.removeListener('unhandledRejection',
      currentUnhandledRejectionHandler);
    t.end();
  }
});

test('enqueue and run in order', function (t) {
  var testValue = 0;
  var testPromiseOnePassed = false;
  var testPromiseTwoPassed = false;
  var promiseQueue = new PromiseQueue();

  // First Promise
  promiseQueue.enqueue(function (resolve) {
    setTimeout(function () {
      t.equal(testValue, 0, 'firstPromise setTimeout');
      testValue = 10;
      resolve(testValue);
    }, 100);
  }).then(function (result) {
    t.equal(result, 10, 'firstPromise result');
    t.equal(testValue, 10, 'firstPromise testValue');
    testPromiseOnePassed = true;
  }).catch(function () {
    t.fail('We should not have gotten to firstPromise catch handler');
  });

  // Second Promise
  promiseQueue.enqueue(function (resolve, reject) {
    setTimeout(function () {
      t.equal(testValue, 10, 'secondPromise setTimeout');
      testValue = 100;
      reject(testValue);
    }, 100);
  }).then(function () {
    t.fail('We should not have gotten to secondPromise then handler');
  }).catch(function (result) {
    t.equal(result, 100, 'secondPromise result');
    t.equal(testValue, 100, 'secondPromise testValue');
    testPromiseTwoPassed = true;
  });

  // Third Promise
  promiseQueue.enqueue(function (resolve) {
    t.equal(testValue, 100, 'thirdPromise in promise');
    testValue = 1000;
    resolve(testValue);
  }).then(function (result) {
    t.equal(result, 1000, 'thirdPromise result');
    t.equal(testValue, 1000, 'thirdPromise testValue');
    if (testPromiseOnePassed && testPromiseTwoPassed) {
      t.end();
    } else {
      t.fail('One of the previous clauses failed');
    }
  }).catch(function () {
    t.fail('We should not have gotten to thirdPromise catch handler');
  });
});
