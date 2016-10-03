'use strict';

var util     = require('util');
var format   = util.format;
var inherits = util.inherits;

var net          = require('net');
var objectAssign = require('object-assign');
var EventEmitter = require('events').EventEmitter;

var asserts = require('./utils/asserts');
var logger  = require('./utils/ThaliLogger')('Server');

var TestDevice = require('./TestDevice');


function Server (options) {
  this._setOptions(options);

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
}

Server.prototype._connect = function (socket) {
  asserts.exists(socket);

  var remoteEvents = new EventEmitter();
  remoteEvents._socket = socket;

  socket
  .on('error', this._error.bind(this))
  .on('data',  this._data.bind(this, remoteEvents))
  .on('end close', function () {
    remoteEvents._socket = null;
  });

  remoteEvents
  .once('present', this._present.bind(this))
  remoteEvents.emitData = this._writeData.bind(this, remoteEvents);
}

Server.prototype._exit = function () {
  this._server.close();
}

Server.prototype._error = function (error) {
  var error = format('unexpected server error: \'%s\'', error);
  logger.error(error);
  throw new Error(error);
}

Server.prototype._data = function (remoteEvents, resultBuffer) {
  var self = this;
  function parse (data) {
    var result = JSON.parse(data);
    asserts.isString(result.event);
    asserts.exists(result.data);
    remoteEvents.emit(result.event, result.data, remoteEvents);
  }

  var data = resultBuffer.toString('utf8');

  var index;
  // This is possible only with multiple json objects in buffer.
  while((index = data.indexOf("}{")) !== -1) {
    var jsonData = data.slice(0, index + 1);
    data = data.slice(index + 1);
    parse(jsonData);
  }
  parse(data);
}

Server.prototype._writeData = function (remoteEvents, event, data) {
  if (!remoteEvents._socket) {
    return;
  }
  data = {
    event: event,
    data:  data || ''
  };
  remoteEvents._socket.write(JSON.stringify(data), 'utf8');
}

Server.prototype._present = function (deviceInfo, remoteEvents) {
  var device = new TestDevice(remoteEvents, deviceInfo);
  logger.debug(
    'device presented, name: \'%s\', uuid: \'%s\', platformName: \'%s\', ' +
    'type: \'%s\', hasRequiredHardware: \'%s\', nativeUTFailed: \'%s\'',
    device.name, device.uuid, device.platformName, device.type, device.hasRequiredHardware, device.nativeUTFailed
  );
  this.emit('present', device);
}

module.exports = Server;
