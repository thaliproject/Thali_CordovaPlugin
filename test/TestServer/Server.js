'use strict';

var util     = require('util');
var format   = util.format;
var inherits = util.inherits;

var assert       = require('assert');
var objectAssign = require('object-assign');
var Promise      = require('bluebird');
var nssocket     = require('nssocket');
var EventEmitter = require('events').EventEmitter;

var asserts = require('./utils/asserts');
var logger  = require('./utils/ThaliLogger')('Server');

var address = require('./server-address');
asserts.isString(address);


function Server (options) {
  this._sockets = [];

  this._setOptions(options);
  this._bind();
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

Server.prototype._bind = function () {
  this._server = nssocket.createServer(
    this._connect.bind(this),
    {
      type: this._options.type
    }
  );
  this._server.listen(this._options.port, address);

  logger.info('listening on \'%s:%d\'', address, this._options.port);
}

Server.prototype._connect = function (socket) {
  asserts.exists(socket);
  logger.debug('client is connected');
  this._sockets.push(socket);
}

Server.prototype.shutdown = function () {
  var self = this;

  var promises = this._sockets.map(function (socket) {
    return new Promise(function (resolve, reject) {
      socket
      .once('close', resolve)
      .once('error', reject)
      socket.destroy();
    });
  });
  return Promise.all(promises)
  .then(function () {
    self._server.close();
  });
}

module.exports = Server;
