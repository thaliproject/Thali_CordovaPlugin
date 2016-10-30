'use strict';

var log = function () {
  var msg = Array.prototype.join.call(arguments, '');
  console.info('[TTR] :: ', msg);
};

log.error = function (msg, error) {
  var err = error;
  if (msg instanceof Error) {
    err = msg;
  }
  log(msg, err, '\n', err.stack);
};

module.exports = log;
