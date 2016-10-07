'use strict';
var tape = require('../lib/thaliTape');
var PromiseQueue = require('thali/NextGeneration/promiseQueue');
var Promise = require('lie');

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

test('enqueueAtTop and run backwards', function (t) {
  var promiseQueue = new PromiseQueue();

  // This is just a delay so we can add the other promises and make sure
  // the logic to add them to the queue runs without any of the functions
  // being run.
  promiseQueue.enqueue(function (resolve) {
    setTimeout(function () {
      resolve();
    }, 100);
  });

  var currentValue = 0;
  var secondPromise = false;
  var thirdPromise = false;

  promiseQueue.enqueueAtTop(function (resolve) {
    t.equal(currentValue, 2, 'firstPromise - third to run');
    currentValue = null;
    resolve('first');
  }).then(function (value) {
    t.equal(value, 'first', 'firstPromise - in then');
    t.ok(secondPromise && thirdPromise, 'testing promises');
    t.end();
  }).catch(function () {
    t.fail('firstPromise - This should have been a resolve');
  });

  promiseQueue.enqueueAtTop(function (resolve, reject) {
    t.equal(currentValue, 3, 'secondPromise - second to run');
    currentValue = 2;
    reject('second');
  }).then(function () {
    t.fail('secondPromise - This should have been a reject');
  }).catch(function (value) {
    t.equal(value, 'second', 'secondPromise - in catch');
    secondPromise = true;
  });

  promiseQueue.enqueueAtTop(function (resolve) {
    t.equal(currentValue, 0, 'thirdPromise - first to run');
    currentValue = 3;
    resolve('third');
  }).then(function(value) {
    t.equal(value, 'third', 'thirdPromise - in resolve');
    thirdPromise = true;
  });
});

test('mix enqueue and enqueueAtTop', function (t) {
  // EnqueueAtTop a delay
  // Then enqueue - first
  // Then enqueueAtTop - second
  // Then enqueue - third
  // Then enqueueAtTop - fourth
  // fourth second first third

  var promiseQueue = new PromiseQueue();
  promiseQueue.enqueueAtTop(function (resolve) {
    setTimeout(function () {
      resolve();
    }, 100);
  });

  var currentValue = 0;
  var firstPromise = false;
  var secondPromise = false;
  var fourthPromise = false;

  promiseQueue.enqueue(function (resolve, reject) {
    t.equal(currentValue, 2, 'first');
    currentValue = 1;
    reject('first');
  }).then(function () {
    t.fail('first promise - then');
  }).catch(function (value) {
    t.equal(value, 'first', 'firstPromise - in catch');
    firstPromise = true;
  });

  promiseQueue.enqueueAtTop(function (resolve) {
    t.equal(currentValue, 4, 'second');
    currentValue = 2;
    resolve('second');
  }).then(function (value) {
    t.equal(value, 'second', 'secondPromise - in then');
    secondPromise = true;
  }).catch(function () {
    t.fail('second promise - catch');
  });

  promiseQueue.enqueue(function (resolve) {
    t.equal(currentValue, 1, 'third');
    currentValue = 3;
    resolve('third');
  }).then(function (value) {
    t.equal(value, 'third', 'thirdPromise - in then');
    t.ok(firstPromise && secondPromise && fourthPromise, 'testingPromises');
    t.end();
  }).catch(function () {
    t.fail('third promise - catch');
  });

  promiseQueue.enqueueAtTop(function (resolve, reject) {
    t.equal(currentValue, 0, 'fourth');
    currentValue = 4;
    reject('fourth');
  }).then(function () {
    t.fail('fourth promise - then');
  }).catch(function (value) {
    t.equal(value, 'fourth', 'fourth');
    fourthPromise = true;
  });
});

test('queues handled independently', function (t) {
  var firstQueue = new PromiseQueue();
  var secondQueue = new PromiseQueue();

  var shortInterval = 10;
  var longInterval = shortInterval * 100;
  var longOperationTimeout = null;

  var shortOperation = function (resolve, reject) {
    setTimeout(function () {
      resolve();
    }, shortInterval);
  };
  secondQueue.enqueue(shortOperation);

  firstQueue.enqueue(function (resolve, reject) {
    longOperationTimeout = setTimeout(function () {
      resolve();
    }, longInterval);
  })
  .then(function () {
    t.fail();
    t.end();
  });
  firstQueue.enqueue(shortOperation);

  secondQueue.enqueue(shortOperation);
  secondQueue.enqueue(shortOperation)
  .then(function () {
    t.ok(true, 'all short operations completed before the long resolves');
    clearTimeout(longOperationTimeout);
    t.end();
  });
});
