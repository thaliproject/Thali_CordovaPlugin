'use strict';

module.exports.serializePouchError = function (err) {
  if (err) {
    return (err.status || '') + ' ' + (err.message || '');
  } else {
    return '';
  }
};

module.exports.makeAsync = function (fn) {
  var apply = Function.prototype.apply.bind(fn);
  return function () {
    setImmediate(apply, this, arguments);
  };
};
