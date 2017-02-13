'use strict';

var Promise = require('bluebird');

/** @module utils/common */

module.exports.serializePouchError = function (err) {
  if (err) {
    return (err.status || '') + ' ' + (err.message || '');
  } else {
    return '';
  }
};

/**
 * Make function async as if it is always wrapped into setImmediate.
 *
 * For example:
 *
 * ```
 * function emit(x) {
 *   console.log(this.name + ':', 'emitting', x);
 * }
 * var emitter = {
 *   name: 'Test emitter',
 *   emit: emit,
 *   emitAsync: makeAsync(emit)
 * };
 * ```
 *
 * is equivalent to:
 *
 * ```
 * function emit(x) {
 *   console.log(this.name + ':', 'emitting', x);
 * }
 * var emitter = {
 *   name: 'Test emitter',
 *   emit: emit,
 *   emitAsync: function () {
 *     var self = this;
 *     var args = arguments;
 *     setImmediate(function () {
 *       emit.apply(self, args);
 *     });
 *   }
 * };
 * ```
 *
 * @param {function} fn
 * @returns {function} new function which, when invoked, executes original `fn`
 * asynchronously (via setImmediate). Preserves context and arguments, but
 * return value is ignored.
 */
module.exports.makeAsync = function (fn) {
  var apply = Function.prototype.apply.bind(fn);
  return function () {
    setImmediate(apply, this, arguments);
  };
};

/**
 * @private
 */
var enqueued = function (atTop, fn) {
  return function enqeuedMethod () {
    var self = this;
    var args = arguments;
    var method = atTop ? 'enqueueAtTop' : 'enqueue';
    return self._promiseQueue[method](function (resolve, reject) {
      var result = fn.apply(self, args);
      Promise.resolve(result).then(resolve, reject);
    });
  };
};

/**
 * Wraps provided function into
 * {@link module:promiseQueue~PromiseQueue#enqueue}.
 *
 * It should be used only for methods and it expects that the class has
 * `_promiseQueue` property.
 *
 * Example:
 * ```
 * function WifiListener() {
 *   this._promiseQueue = new PromiseQueue();
 *   this._isStarted = false;
 * }
 *
 * WifiListener.prototype.start = enqueuedMethod(function () {
 *   return this.performAsyncLogic().then(function () {
 *     this._isStarted = true
 *   }.bind(this));
 * });
 * ```
 *
 * @method
 * @static
 * @param {function} fn - function to wrap. MUST be either synchronous or return
 * a Promise
 * @returns {Promise}
 */
module.exports.enqueuedMethod = enqueued.bind(null, false);

/**
 * The same as [enqueuedMethod]{@link module:utils/common.enqueuedMethod} but
 * uses [enqueueAtTop]{@link module:promiseQueue~PromiseQueue#enqueueAtTop}
 * instead.
 *
 * @method
 * @static
 * @param {function} fn - function to wrap. MUST be either synchronous or return
 * a Promise
 * @returns {Promise}
 */
module.exports.enqueuedAtTopMethod = enqueued.bind(null, true);
