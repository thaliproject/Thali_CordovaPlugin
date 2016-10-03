'use strict';

var util     = require('util');
var inherits = util.inherits;

var net          = require('net');
var objectAssign = require('object-assign');
var EventEmitter = require('events').EventEmitter;

var asserts = require('./utils/asserts');
var logger  = require('./utils/ThaliLogger')('Server');

var TestDevice = require('./TestDevice');


function Server (options) {
  this._setOptions(options);

  this._remoteEvents = new EventEmitter();
  this._bind();
}

inherits(Server, EventEmitter);

Server.prototype.defaults = {
  port: 3000
};

Server.prototype._setOptions = function (options) {
  asserts.isObject(options);
  this._options = objectAssign({}, this.defaults, options);

  asserts.isNumber(this._options.port);
}

Server.prototype._bind = function () {
  var self = this;

  this._server = net.createServer(this._connect.bind(this));
  process.once('exit', this._exit.bind(this));
  this._server.listen(this._options.port);

  logger.info('listening on *:' + this._options.port);

  this._remoteEvents
  .on('present', this._present.bind(this));
}

Server.prototype._connect = function (socket) {
  asserts.exists(socket);

  socket
  .on('error', this._error.bind(this))
  .on('data',  this._data.bind(this, socket));
}

Server.prototype._exit = function () {
  this._server.close();
}

Server.prototype._error = function (socket, error) {
  var error = format('unexpected server error: \'%s\'', error);
  logger.error(error);
  throw new Error(error);
}

Server.prototype._data = function (socket, resultBuffer) {
  var result = JSON.parse(resultBuffer.toString('utf8'));
  asserts.isString(result.event);
  asserts.exists(result.data);
  this._remoteEvents.emit(result.event, socket, result.data);
}

Server.prototype._present = function (socket, deviceInfo) {
  var device = new TestDevice(socket, deviceInfo);
  logger.debug(
    'device presented, name: \'%s\', uuid: \'%s\', platformName: \'%s\', ' +
    'type: \'%s\', hasRequiredHardware: \'%s\', nativeUTFailed: \'%s\'',
    device.name, device.uuid, device.platformName, device.type, device.hasRequiredHardware, device.nativeUTFailed
  );
  this.emit('present', device);
}

module.exports = Server;
