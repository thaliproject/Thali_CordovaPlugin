'use strict';

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
