'use strict';

var util     = require('util');
var inherits = util.inherits;

var http         = require('http');
var socketIO     = require('socket.io');
var objectAssign = require('object-assign');
var EventEmitter = require('events').EventEmitter;

var asserts = require('./utils/asserts');
var logger  = require('./utils/ThaliLogger')('HttpServer');

var TestDevice = require('./TestDevice');


function Server (options) {
  var self = this;

  this._setOptions(options);

  var server = http.createServer();
  this._io = socketIO(server, {
    transports: this._options.transports
  });
  server.listen(this._options.port, function () {
    logger.info('listening on *:' + self._options.port);
  });

  this._bind();
}

inherits(Server, EventEmitter);

Server.prototype.defaults = {
  transports: ['websocket']
};

Server.prototype._setOptions = function (options) {
  asserts.isObject(options, 'Server._setOptions');

  this._options = objectAssign({}, this.defaults, options);

  asserts.isNumber(this._options.port);
  asserts.isArray(this._options.transports);
  this._options.transports.forEach(function (transport) {
    asserts.isString(transport);
  });
};

Server.prototype._bind = function () {
  process.once('exit', this._exit.bind(this));
  this._io.on('connect', this._connect.bind(this));
};

Server.prototype._connect = function (socket) {
  asserts.exists(socket);
  socket.deviceName = 'device that was not presented yet';

  socket
  .on('disconnect', this._disconnect.bind(this, socket))
  .on('error',      this._error.bind(this, socket))
  .on('present',    this._present.bind(this, socket));
};

Server.prototype._disconnect = function (socket, reason) {
  logger.info(
    'Socket to device name: \'%s\' disconnected, reason: \'%s\'',
    socket.deviceName, reason
  );
};

Server.prototype._error = function (socket, error) {
  logger.error(
    'unexpected server error: ' + error.message + '\n' + error.stack + '\n' +
    error.content
  );
  throw new Error(error.content);
};

Server.prototype._present = function (socket, deviceInfo) {
  var device = new TestDevice(socket, deviceInfo);
  socket.deviceName = device.name;

  logger.debug(
    'device presented, name: \'%s\', uuid: \'%s\', platformName: \'%s\', ' +
    'type: \'%s\', hasRequiredHardware: \'%s\', nativeUTFailed: \'%s\'',
    device.name, device.uuid, device.platformName, device.type,
    device.hasRequiredHardware, device.nativeUTFailed
  );

  this.emit('present', device);
};

Server.prototype._exit = function () {
  this._io.close();
};

module.exports = Server;
