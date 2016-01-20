'use strict';

var Promise = require('lie');

/** @module promiseQueue */

/**
 * @classdesc Creates a queue of functions that are guaranteed to be run
 * exactly once and in serial FIFO order. So that the first enqueue function
 * will complete before the second is executed.
 *
 * ```javascript
 * var PromiseQueue = require('promiseQueue');
 * var promiseQueue = new PromiseQueue();
 * var firstPromise = promiseQueue.enqueue(function(resolve, reject) {
 *    do stuff...
 * }).then(function(result) {
 *    do more stuff...
 * }).catch(function(err) {
 *    and more stuff...
 * });
 * ```
 *
 * @public
 * @constructor
 */
function PromiseQueue () {

}

PromiseQueue.prototype.globalPromise = Promise.resolve(true);

/**
 * We use two different promises to wrap things up, this lets us make sure
 * both promise's resolve/reject functions are called.
 *
 * @private
 * @param localFn Either the local resolve or reject function as appropriate.
 * @param globalResolveFn Always the resolve function since the global queue
 * promise all resolves successfully regardless of the outcome of the local
 * fn.
 * @returns {Function}
 */
function finishPromise (localFn, globalResolveFn) {
  return function(value) {
    localFn(value);
    globalResolveFn();
  };
}

/**
 * Enqueue a function to be executed only when all the functions enqueued before
 * it has been executed.
 *
 * @public
 * @param fn The function that will be called when its turn in the queue comes
 * up. The function takes as arguments the resolve and reject functions used
 * with promises. So the function can run asynchronously and indicate their
 * success or failure using the resolve or reject function arguments.
 * @returns {Promise} A promise that will resolve or be rejected depending
 * on the outcome of the submitted function.
 */
PromiseQueue.prototype.enqueue = function (fn) {
  var self = this;
  return new Promise(function(localResolve, localReject) {
    self.globalPromise = self.globalPromise.then(function () {
      return new Promise(function (globalResolve) {
        fn(finishPromise(localResolve, globalResolve),
          finishPromise(localReject, globalResolve));
      });
    });
  });
};

module.exports = PromiseQueue;
