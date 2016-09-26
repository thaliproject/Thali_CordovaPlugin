'use strict';

var Promise = require('bluebird');

Promise.config({
  warnings:        true,
  longStackTraces: true,
  cancellation:    true,
  monitoring:      true
});

module.exports = Promise;
