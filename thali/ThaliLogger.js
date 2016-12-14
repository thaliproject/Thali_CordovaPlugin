'use strict';

var util     = require('util');
var format   = util.format;

var winston      = require('winston');


var ThaliLogger = function (tag) {
  ThaliLogger.super_.call(this);
  this.tag = tag;
};

util.inherits(ThaliLogger, winston.Transport);

ThaliLogger.prototype.name = 'ThaliLogger';

if (
  typeof jxcore !== 'undefined' &&
  jxcore.utils &&
  jxcore.utils.console &&
  jxcore.utils.console.log
) {
  ThaliLogger._logger = jxcore.utils.console.log;
} else {
  ThaliLogger._logger = console.log;
}

// TODO winston is unreliable, we want to find an alternative.
// We can receive last part of message (like errors) in 'meta'.
ThaliLogger.prototype.log = function (level, message, meta, callback) {
  if (meta instanceof Error) {
    message += ' ' + meta.stack;
  }
  var now = new Date().toISOString()
    .replace(/T/, ' ')
    .replace(/.[^.]+$/, '');
  message = format(
    '%s - %s %s: \'%s\'',
    now, level.toUpperCase(), this.tag, message
  );

  ThaliLogger._logger(message);

  // Emit the `logged` event immediately because the event loop
  // will not exit until `process.stdout` has drained anyway.
  this.emit('logged');
  callback(null, true);
};

module.exports = function (tag) {
  if (!tag || typeof tag !== 'string' || tag.length < 3) {
    throw new Error(
      'All logging must have a tag that is at least 3 characters long!'
    );
  }
  var thaliLogger = new ThaliLogger(tag);
  var logger = new winston.Logger({
    transports: [thaliLogger]
  });
  logger._thaliLogger = thaliLogger;
  logger.level = 'debug';

  // Node-SSDP uses Bunyan which supports trace, Winston does not. To work
  // around this we are hacking in trace support.
  logger.trace = logger.silly;
  return logger;
};
