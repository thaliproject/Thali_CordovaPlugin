'use strict';

var util     = require('util');
var format   = util.format;
var inherits = util.inherits;

var nssocket     = require('nssocket');
var assert       = require('assert');
var objectAssign = require('object-assign');
var Promise      = require('bluebird');
var EventEmitter = require('events').EventEmitter;

var asserts = require('./utils/asserts');
var logger  = require('./utils/ThaliLogger')('Server');

var TestDevice = require('./TestDevice');


function Server (options) {
  if (options) {
    asserts.isObject(options);
  }
  this._options = objectAssign({}, this.defaults, options);
  asserts.isNumber(this._options.port);

  this._sockets = [];
  this._bind();
}

inherits(Server, EventEmitter);

Server.prototype.defaults = {
  port: 3000,
  sendTimeout: 2 * 60 * 1000
};

Server.prototype._bind = function () {
  var self = this;

  this._server = nssocket.createServer(this._connect.bind(this));
  this._server.listen(this._options.port);

  logger.info('listening on *:' + this._options.port);
}

Server.prototype._connect = function (socket) {
  var self = this;

  asserts.exists(socket);

  var remoteEvents = new EventEmitter();
  remoteEvents.emitData = this._emitData.bind(this, socket);

  socket.data('*', this._data.bind(this, socket, remoteEvents));
  remoteEvents.on('present', this._present.bind(this, remoteEvents));

  socket.on('error', function () {});
  // socket.on('error', remoteEvents.emit.bind(remoteEvents, 'error'));

  this._sockets.push(socket);
  socket.once('close', function () {
    var socketIndex = self._sockets.indexOf(socket);
    assert(socketIndex !== -1, 'socket should exist');
    self._sockets.splice(socketIndex, 1);
  });

  logger.debug('client connected');
}

Server.prototype._data = function (socket, remoteEvents, data) {
  asserts.isArray(socket.event);
  assert(
    socket.event.length === 2,
    'we should receive \'data\' and \'event\' name'
  );
  asserts.equals(socket.event[0], 'data');
  var event = socket.event[1];
  asserts.isString(event);

  remoteEvents.emit(event, data);
}

Server.prototype._present = function (remoteEvents, deviceInfo) {
  var device = new TestDevice(remoteEvents, deviceInfo);
  logger.debug(
    'device presented, name: \'%s\', uuid: \'%s\', platformName: \'%s\', ' +
    'type: \'%s\', hasRequiredHardware: \'%s\', nativeUTFailed: \'%s\'',
    device.name, device.uuid, device.platformName, device.type, device.hasRequiredHardware, device.nativeUTFailed
  );
  this.emit('presented', device);
}

Server.prototype._emitData = function (socket, event, data) {
  var self = this;

  return new Promise(function (resolve, reject) {
    socket.send(event, data, resolve);
  })
  .catch(function (error) {
    logger.error(
      'unexpected error: \'%s\', stack: \'%s\'',
      error.toString(), error.stack
    );
    return Promise.reject(error);
  })
  .timeout(
    this._options.sendTimeout,
    'timeout exceeded while trying to write data into socket'
  );
}

Server.prototype.shutdown = function () {
  var self = this;

  var promises = this._sockets.map(function (socket) {
    return new Promise(function (resolve) {
      socket.once('close', resolve);
      socket.end();
    });
  });
  return Promise.all(promises)
  .then(function () {
    self._server.close();
  });
}

module.exports = Server;
