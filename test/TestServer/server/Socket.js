'use strict';

var util     = require('util');
var inherits = util.inherits;

var Promise = require('bluebird');

var asserts = require('../utils/asserts');
var logger  = require('../utils/ThaliLogger')('ServerSocket');

var Socket = require('../Socket');


function ServerSocket (socket) {
  asserts.exists(socket);
  this._socket = socket;

  this._isClosed = true;
  this._isEnded  = true;

  // This socket is already started.
  this._start();

  this._bind();
}

inherits(ServerSocket, Socket);

ServerSocket.prototype.logger = logger;

ServerSocket.prototype._bind = function () {
  ServerSocket.super_.prototype._bind.call(this);

  logger.debug('waiting for id');
  this.once('data:id', this._data_id.bind(this));
}

ServerSocket.prototype._data_id = function (id) {
  this.id = id;
  logger.debug('received id: \'%s\'', this.id);
}

module.exports = ServerSocket;
