'use strict';

var util     = require('util');
var inherits = util.inherits;

var assert       = require('assert');
var Promise      = require('bluebird');
var EventEmitter = require('events').EventEmitter;

var asserts = require('./utils/asserts');
var logger  = require('./utils/ThaliLogger')('Socket');


function Socket (socket) {
  asserts.exists(socket);
  this._socket = socket;

  this._isClosed = true;
  this._isEnded  = true;

  this._bind();
}

inherits(Socket, EventEmitter);

Socket.prototype.logger = logger;

Socket.prototype._bind = function () {
  this._socket
  .data('*', this._data.bind(this))
  .on('error', this._error.bind(this))
  .on('start', this._start.bind(this))
  .on('close', this._close.bind(this));
}

Socket.prototype._data = function (data) {
  if (this._isClosed) {
    this.logger.error('data after socket closed');
    return;
  }

  // 'event' should be like ['data', 'something'].
  asserts.isArray(this._socket.event);
  assert(
    this._socket.event.length === 2,
    'we should receive \'data\' and \'event\' name'
  );
  asserts.equals(this._socket.event[0], 'data', 'we should receive \'data\'');
  var event = this._socket.event[1];
  asserts.isString(event);

  event = 'data:' + event;
  this.logger.debug('socket received event: \'%s\'', event);
  this.emit(event, data);
}

Socket.prototype._error = function (error) {
  if (this._isClosed) {
    this.logger.error('error after socket closed');
  }

  this.logger.error(
    'unexpected error: \'%s\', stack: \'%s\'',
    error.toString(), error.stack
  );
}

Socket.prototype._start = function () {
  this._isClosed = false;
  this._isEnded  = false;

  this.emit('open');
  this.logger.debug('socket was opened');
}

Socket.prototype._close = function () {
  if (this._isClosed) {
    this.logger.error('socket is already closed');
    return;
  }
  this._isClosed = true;

  this.emit('close');
  this.logger.debug('socket was closed');
}

Socket.prototype.end = function () {
  if (this._isEnded) {
    throw new Error('socket is already ended');
    return;
  }
  this._isEnded = true;

  this._socket.end();
  this.logger.debug('socket was ended');
}

module.exports = Socket;
