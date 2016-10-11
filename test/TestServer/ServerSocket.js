'use strict';

var util     = require('util');
var inherits = util.inherits;

var Promise      = require('bluebird');
var EventEmitter = require('events').EventEmitter;

var asserts = require('./utils/asserts');
var logger  = require('./utils/ThaliLogger')('ServerSocket');


function ServerSocket (socket) {
  asserts.exists(socket);
  this._socket = socket;

  this._isClosed = false;
  this._isEnded  = false;

  this._bind();
}

inherits(ServerSocket, EventEmitter);

ServerSocket.prototype.logger = logger;

ServerSocket.prototype._bind = function () {
  this._socket
  .data('*', this._data.bind(this))
  .on('error', this._error.bind(this))
  .on('close', this._close.bind(this));
}

ServerSocket.prototype._data = function (data) {
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
  asserts.equals(socket.event[0], 'data');
  var event = socket.event[1];
  asserts.isString(event);

  this.logger.debug('socket received event: \'%s\'', event);
}

ServerSocket.prototype._error = function (error) {
  if (this._isClosed) {
    this.logger.error('error after socket closed');
  }

  this.logger.error(
    'unexpected error: \'%s\', stack: \'%s\'',
    error.toString(), error.stack
  );
}

ServerSocket.prototype._close = function () {
  if (this._isClosed) {
    this.logger.error('socket is already closed');
    return;
  }
  this._isClosed = true;

  this.emit('close');
  this.logger.debug('socket was closed');
}

ServerSocket.prototype.close = function () {
  if (this._isEnded) {
    throw new Error('socket is already ended');
    return;
  }
  this._isEnded = true;

  this._socket.end();
  this.logger.debug('socket was ended');
}

module.exports = ServerSocket;
