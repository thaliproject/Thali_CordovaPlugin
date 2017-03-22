'use strict';

var util     = require('util');
var inherits = util.inherits;
var sinon   = require('sinon');
var tape = require('../lib/thaliTape');
var EventEmitter = require('events').EventEmitter;

var asserts = require('./utils/asserts');
var logger = require('thali/ThaliLogger')('SinonTest');


function SinonTest (callback) {
  // We are calling this function directly without 'new'.
  if (!this) {
    return new SinonTest(callback);
  }

  return this;
}

inherits(SinonTest, EventEmitter);

module.exports = SinonTest;
