'use strict';

var util = require('util');
var winston = require('winston');
var EventEmitter = require('events').EventEmitter;

var Thalilogger = function () {
  EventEmitter.call(this);
};

util.inherits(Thalilogger, EventEmitter);

Thalilogger.prototype.name = 'thalilogger';

Thalilogger.prototype.log = function (level, msg, meta, callback) {
  jxcore.utils.console.log(level.toUpperCase() + ' ' + meta.tag + ': ' + msg);
  //
  // Emit the `logged` event immediately because the event loop
  // will not exit until `process.stdout` has drained anyway.
  //
  this.emit('logged');
  callback(null, true);
};

module.exports = function (tag) {
  if (!tag || typeof tag !== 'string' || tag.length < 3) {
    throw new Error('All logging must have a tag that is at least 3 ' +
                    'characters long!');
  }
  var logger =  new winston.Logger({
    transports: [
      new Thalilogger()
    ]
  });
  logger.addRewriter(function (level, msg, meta) {
    if (!meta.tag) {
      meta.tag = tag;
    }
    return meta;
  });
  return logger;
};
