'use strict';

var format = require('util').format;
var assert = require('assert');

require('./polyfills.js');


function exists(value) {
  return value !== undefined && value !== null;
}
module.exports.exists = function (value) {
  assert(
    exists(value),
    format('existing value expected, received: \'%s\'', value)
  );
};

function isString(value) {
  return exists(value) && typeof value === 'string';
}
module.exports.isString = function (value) {
  assert(
    isString(value),
    format('string expected, received: \'%s\'', value)
  );
};

function isArray(value) {
  return exists(value) && Array.isArray(value);
}
module.exports.isArray = function (value) {
  assert(
    isArray(value),
    format('array expected, received: \'%s\'', value)
  );
};

function isBool(value) {
  return value === true || value === false;
}
module.exports.isBool = function (value) {
  assert(
    isBool(value),
    format('bool expected, received: \'%s\'', value)
  );
};

function isNumber(value) {
  return exists(value) && typeof value === 'number';
}
module.exports.isNumber = function (value) {
  assert(
    isNumber(value),
    format('number expected, received: \'%s\'', value)
  );
};

function arrayEquals(a1, a2) {
  if (
    !isArray(a1) || !isArray(a2) ||
    a1.length !== a2.length
  ) {
    return false;
  }
  return a1.every(function (value, key) {
    return value === a2[key];
  });
}
module.exports.arrayEquals = function(a1, a2) {
  assert(
    arrayEquals(a1, a2),
    format('equals arrays expected, received array 1: \'%s\', array 2: \'%s\'', a1, a2)
  );
}

function isObject(value) {
  return exists(value) && typeof value === 'object';
}
module.exports.isObject = function (value) {
  assert(
    isObject(value),
    format('object expected, received: \'%s\'', value)
  );
};

function instanceOf(value, base) {
  return isObject(value) && value instanceof base;
}
module.exports.instanceOf = function (value, base) {
  assert(
    instanceOf(value, base),
    format('\'%s\' should be an instance of \'%s\'', value, base)
  );
};

module.exports.equals = function (value1, value2) {
  assert(
    value1 === value2,
    format('equals values expected, received value 1: \'%s\', value 2: \'%s\'', value1, value2)
  );
}

function isFunction(fun) {
  return exists(fun) && typeof fun === 'function';
}
module.exports.isFunction = function (value) {
  assert(
    isFunction(value),
    format('function expected, received: \'%s\'', value)
  );
};
