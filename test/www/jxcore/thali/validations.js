'use strict';

var toString = Object.prototype.toString;

Number.isNaN = Number.isNaN || function(value) {
  return toString.call(value) === '[object Number]' && value !== value;
};

module.exports.ensureValidPort = function ensureValidPort (n) {
  if (toString.call(n) !== '[object Number]' || Number.isNaN(n)) { throw new TypeError('port must be a number'); }
  if (n > 65536 || n < 0) { throw new Error('port must be greater than 0 and less than or equal 65536'); }
}

module.exports.ensureNonNullOrEmptyString = function ensureNonNullOrEmptyString (value, param) {
  if (toString.call(value) !== '[object String]') { throw new TypeError(param + ' must be a string'); }
  if (value.trim().length === 0) { throw new Error(param + ' cannot be empty'); }
}

module.exports.ensureIsFunction = function ensureIsFunction (value, param) {
  if (toString.call(value) !== '[object Function]') { throw new TypeError(param + ' must be a function'); }
}
