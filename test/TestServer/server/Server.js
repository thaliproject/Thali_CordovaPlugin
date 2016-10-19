'use strict';

var util     = require('util');
var inherits = util.inherits;

var assert       = require('assert');
var objectAssign = require('object-assign');
var Promise      = require('bluebird');
var nssocket     = require('nssocket');
var EventEmitter = require('events').EventEmitter;

var asserts = require('../utils/asserts');
var logger  = require('../utils/ThaliLogger')('Server');

var Socket = require('./Socket');

var address = require('../server-address');
asserts.isString(address);


function Server (options) {
  this._sockets     = [];
  this._isAvailable = false;

  this._setOptions(options);
  this.start();
}

inherits(Server, EventEmitter);

Server.prototype.defaults = {
  port: 3000,
  type: 'tcp4' // 'tcp4' or 'tls'
};

Server.prototype._setOptions = function (options) {
  if (options) {
    asserts.isObject(options);
  }
  this._options = objectAssign({}, this.defaults, options);

  asserts.isNumber(this._options.port);
  assert(
    this._options.type === 'tcp4' ||
    this._options.type === 'tls',
    '\'type\' should equals \'tcp4\' or \'tls\''
  );
}

Server.prototype.start = function () {
  this._server = nssocket.createServer(
    {
      type: this._options.type
    },
    this._connect.bind(this)
  );
  this._isAvailable = true;

  this._bind();
}

Server.prototype._bind = function () {
  this._server.on('error', this._error.bind(this));
  this._server.listen(this._options.port, address);

  logger.info('listening on \'%s:%d\'', address, this._options.port);
}

Server.prototype._connect = function (socket) {
  var self = this;

  if (!this._isAvailable) {
    logger.warn('server is not available, ignoring client');
    return;
  }

  logger.debug('client is connected');

  socket = new Socket(socket);
  this._sockets.push(socket);
  socket.once('close', function () {
    var index = self._sockets.indexOf(socket);
    assert(index !== -1, 'socket should exist');
    self._sockets.splice(index, 1);
  });
}

Server.prototype._error = function (error) {
  if (!this._isAvailable) {
    logger.error('error after server became unavailable');
  }

  logger.error(
    'unexpected error: \'%s\', stack: \'%s\'',
    error.toString(), error.stack
  );
}

Server.prototype.closeAllSockets = function () {
  var promises = this._sockets.map(function (socket) {
    return new Promise(function (resolve, reject) {
      function error(error) {
        socket.removeListener('close', close);
        reject(error);
      }
      function close() {
        socket.removeListener('error', error);
        resolve();
      }
      socket
      .once('error', error)
      .once('close', close);
      socket.end();
    });
  });
  return Promise.all(promises)
  .then(function () {
    logger.debug('all sockets killed');
  });
}

Server.prototype.shutdown = function () {
  var self = this;

  if (!this._isAvailable) {
    return Promise.reject(new Error('server is not available'));
  }
  this._isAvailable = false;

  return this.closeAllSockets()
  .finally(function () {
    self._server.close();
    logger.debug('server was closed');
  });
}

module.exports = Server;
