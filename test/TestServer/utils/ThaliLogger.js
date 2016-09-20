'use strict';

var util     = require('util');
var inherits = util.inherits;
var format   = util.format;

var winston      = require('winston');
var EventEmitter = require('events').EventEmitter;


var ThaliLogger = function (logger) {
  ThaliLogger.super_.call(this);

  this._logger = logger || ThaliLogger._defaultLogger;
};

var defaultLogger;
if (
  typeof jxcore !== 'undefined' &&
  jxcore.utils &&
  jxcore.utils.console &&
  jxcore.utils.console.log
) {
  ThaliLogger._defaultLogger = jxcore.utils.console.log.bind(jxcore.utils.console);
} else {
  ThaliLogger._defaultLogger = console.log.bind(console);
}

util.inherits(ThaliLogger, EventEmitter);

ThaliLogger.prototype.name = 'ThaliLogger';

ThaliLogger.prototype.log = function (level, message, meta, callback) {
  var now = new Date().toISOString()
    .replace(/T/, ' ')
    .replace(/.[^.]+$/, '');
  message = format(
    '%s - %s %s: \'%s\'',
    now, level.toUpperCase(), meta.tag, message
  );

  this._logger(message);

  // Emit the `logged` event immediately because the event loop
  // will not exit until `process.stdout` has drained anyway.
  this.emit('logged');
  callback(null, true);

  this.emit('message', message);
};

module.exports = function (tag, logger) {
  if (!tag || typeof tag !== 'string' || tag.length < 3) {
    throw new Error(
      'All logging must have a tag that is at least 3 characters long!'
    );
  }
  var thaliLogger = new ThaliLogger(logger);
  var logger = new winston.Logger({
    transports: [thaliLogger]
  });
  logger.rewriters.push(function (level, msg, meta) {
    if (!meta.tag) {
      meta.tag = tag;
    }
    return meta;
  });
  logger.level = 'debug';
  return logger;
};
