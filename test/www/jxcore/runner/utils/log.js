'use strict';
var inspect = require('util').inspect;

var log = function () {
  var msg = Array.prototype.join.call(arguments, '');
  console.info('[TTR] :: ' + msg);
};

log.error = function (msg, error) {
  if (msg instanceof Error) {
    var error = msg;
    log(error.message, error.stack);
  } else {
    log(msg, error.message, error.stack);
  }
};

module.exports = log;
