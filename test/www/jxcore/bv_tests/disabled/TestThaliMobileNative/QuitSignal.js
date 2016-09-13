'use strict';

var assert = require('assert');

var logger = require('thali/thaliLogger')('QuitSignal');


function QuitSignal() {
  this.raised = false;
  this._handlers = [];
}

QuitSignal.prototype.bindHandler = function (handler) {
  assert(
    !this.raised,
    'no calling bindHandler after signal was raised'
  );
  this._handlers.push(handler);
};

QuitSignal.prototype.unbindHandler = function (handler) {
  var index = this._handlers.indexOf(handler);
  assert(
    index !== -1,
    'handler should exist while unbinding'
  );
  this._handlers.splice(index, 1);
};

QuitSignal.prototype.raise = function () {
  if (this.raised) {
    return;
  }
  this.raised = true;

  this._handlers.forEach(function (handler) {
    handler();
  });
};

module.exports = QuitSignal;
