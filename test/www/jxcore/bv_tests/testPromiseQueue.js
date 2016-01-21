'use strict';
var tape = require('../lib/thali-tape');
var PromiseQueue = require('thali/NextGeneration/promiseQueue');

var unhandledRejectionHandler = null;

function unHandledRejectionHandler(t) {
  return function(error, self) {
    t.fail('Got an unhandled rejection error: ' + error + ", " +
      JSON.stringify(self));
  }
}

var test = tape({
  setup: function(t) {
    unhandledRejectionHandler = unHandledRejectionHandler(t);
    process.on('unhandledRejection', unhandledRejectionHandler);
    t.end();
  },
  teardown: function(t) {
    process.removeListener('unhandledRejection', unhandledRejectionHandler);
    t.end();
  }
});

function testTestValue(t, actualValue, expectedValue, tag) {
  t.equal(actualValue, expectedValue, tag + ' expected ' + expectedValue +
    ' and got ' + actualValue);
}

test('enqueue and run in order', function(t) {
  var testValue = 0;
  var testPromiseOnePassed = false;
  var testPromiseTwoPassed = false;
  var promiseQueue = new PromiseQueue();
  var firstPromise = promiseQueue.enqueue(function(resolve, reject) {
    setTimeout(function() {
      testTestValue(t, testValue, 0, 'firstPromise setTimeout');
      testValue = 10;
      resolve(testValue);
    }, 100);
  }).then(function(result) {
    testTestValue(t, result, 10, 'firstPromise result');
    testTestValue(t, testValue, 10, 'firstPromise testValue');
    testPromiseOnePassed = true;
  }).catch(function() {
    t.fail('We should not have gotten to firstPromise catch handler');
  });

  var secondPromise = promiseQueue.enqueue(function(resolve, reject) {
    setTimeout(function() {
      testTestValue(t, testValue, 10, 'secondPromise setTimeout');
      testValue = 100;
      reject(testValue);
    }, 100);
  }).then(function() {
    t.fail('We should not have gotten to secondPromise then handler');
  }).catch(function(result) {
    testTestValue(t, result, 100, 'secondPromise result');
    testTestValue(t, testValue, 100, 'secondPromise testValue');
    testPromiseTwoPassed = true;
  });

  var thirdPromise = promiseQueue.enqueue(function(resolve, reject) {
    testTestValue(t, testValue, 100, 'thirdPromise in promise');
    testValue = 1000;
    resolve(testValue);
  }).then(function(result) {
    testTestValue(t, result, 1000, 'thirdPromise result');
    testTestValue(t, testValue, 1000, 'thirdPromise result');
    if (testPromiseOnePassed && testPromiseTwoPassed) {
      t.end();
    } else {
      t.fail('One of the previous clauses failed');
    }
  }).catch(function() {
    t.fail('We should not have gotten to thirdPromis6e catch handler');
  });
});
