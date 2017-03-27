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
  this._running = false;
  this._activePromise = null;
  this._tasks = [];
  this._run = this._run.bind(this);
}

/**
 * This is just a resolve or reject function created by a Promise constructor.
 *
 * @private
 * @callback resolveOrRejectFn
 * @param {any} result
 */

/**
 * @typedef {Object} Task
 * Task object
 * @private
 * @property {function} run starts task. It will execute original executor and
 * resolve or reject task's promise
 * @property {Promise} promise promise that becomes resolved when task is
 * successfully executed and rejected otherwise
 */

/**
 * Creates a [Task]{@link module:promiseQueue~executor} using provided executor.
 * @private
 * @param {module:promiseQueue~executor} executor
 * @returns {Task}
 */
function createTask (executor) {
  var run;
  var promise = new Promise(function (resolve, reject) {
    run = function () {
      try { executor(resolve, reject); }
      catch (error) { reject(error); }
    };
  });
  return { run: run, promise: promise };
}

/**
 * This is the callback function used in a Promise. The function that will be
 * called when its turn in the queue comes up. The function takes as arguments
 * the resolve and reject functions used with promises. So the function can run
 * asynchronously and indicate their success or failure using the resolve or
 * reject function arguments.
 *
 * @public
 * @callback executor
 * @param {module:promiseQueue~resolveOrRejectFn} resolve
 * @param {module:promiseQueue~resolveOrRejectFn} reject
 */

/**
 * Enqueue a function to be executed only when all the functions enqueued before
 * it have been executed.
 *
 * @public
 * @param {executor} fn
 * @returns {Promise} A promise that will resolve or be rejected depending
 * on the outcome of the submitted function.
 */
PromiseQueue.prototype.enqueue = function (fn) {
  var task = createTask(fn);
  this._tasks.push(task);
  this._processQueue();
  return task.promise;
};

/**
 * Enqueue a function at the head of the queue. It will be executed as soon as
 * the current promise (if any) resolves, before anyone who called enqueue.
 * If multiple calls are made to enqueueAtTop then they will be enqueued at
 * the head of the queue in LIFO order.
 *
 * @public
 * @param {module:promiseQueue~executor} fn
 * @returns {Promise} A promise that will resolve or be rejected depending
 * on the outcome of the submitted function.
 */
PromiseQueue.prototype.enqueueAtTop = function (fn) {
  var task = createTask(fn);
  this._tasks.unshift(task);
  this._processQueue();
  return task.promise;
};

/**
 * Starts processing enqueued tasks
 * @private
 */
PromiseQueue.prototype._processQueue = function () {
  if (this._running) {
    return;
  }
  this._running = true;
  process.nextTick(this._run);
};

// Part of the `_processQueue`. Extracted into separated method so it can be
// easily passed into `promise.then`
PromiseQueue.prototype._run = function () {
  var task = this._tasks.shift();
  if (task) {
    this._activePromise = task.promise.then(this._run, this._run);
    task.run();
  } else {
    this._activePromise = null;
    this._running = false;
  }
};

module.exports = PromiseQueue;
