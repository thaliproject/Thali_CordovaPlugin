var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;



function ThaliEmitter() {
  EventEmitter.call(this);
}

inherits(ThaliEmitter, EventEmitter);

module.exports = ThaliEmitter;
