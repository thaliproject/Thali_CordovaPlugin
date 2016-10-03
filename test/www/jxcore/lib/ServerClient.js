'use strict';

var util     = require('util');
var format   = util.format;
var inherits = util.inherits;

var net          = require('net');
var assert       = require('assert');
var objectAssign = require('object-assign');
var Promise      = require('bluebird');
var EventEmitter = require('events').EventEmitter;

var asserts = require('./utils/asserts');

var logger = require('./testLogger')('ServerClient');


function ServerClient(host, port, options) {
  asserts.isString(host);
  this._host = host;

  asserts.isNumber(port);
  assert(
    port >= 1 && port <= (1 << 16) - 1,
    'port should be valid'
  );
  this._port = port;

  asserts.isObject(options);
  this._options = objectAssign({}, this.defaults, options);

  this._connect = this.connect.bind(this);
  this._reconnectionIndex = -1;
}

inherits(ServerClient, EventEmitter);

ServerClient.prototype.defaults = {
  reconnectionAttempts: 15,
  reconnectionDelay:    200,
  emitTimeout:          2 * 60 * 1000
};

ServerClient.prototype.connect = function () {
  var self = this;

  this._reconnectionIndex = 0;

  var socket = new net.Socket()
  .on('data',  this._data  .bind(this))
  .on('error', this._error .bind(this))
  .on('end',   this._end   .bind(this))
  .on('close', this._closed.bind(this));

  logger.debug('connecting to \'%s:%d\'', this._host, this._port);
  socket.connect(this._port, this._host, this._connected.bind(this, socket));
}

ServerClient.prototype._connected = function (socket) {
  logger.debug('connected to \'%s:%d\'', this._host, this._port);
  this._socket = socket;
  this.emit('connect');
}

ServerClient.prototype._data = function (resultBuffer) {
  var self = this;
  function parse (data) {
    var result = JSON.parse(data);
    asserts.isString(result.event);
    asserts.exists(result.data);
    self.emit(result.event, result.data);
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

ServerClient.prototype._closed = function () {
  this._socket = null;
  if (this._reconnectionIndex === -1) {
    return;
  } else if (this._reconnectionIndex > this._options.reconnectionAttempts) {
    var error = 'socket closed, reconnection limit exceeded';
    logger.error(error);
    this.emit('error', new Error(error));
  } else {
    logger.debug('socket closed, we will try to reconnect');
    this._reconnectionIndex ++;
    setTimeout(this._connect, this._options.reconnectionDelay);
  }
}

ServerClient.prototype._error = function (error) {
  this._socket = null;
  this.emit('error', error);
}

ServerClient.prototype._end = function () {
  this._socket = null;
}

// Emitting message to socket without confirmation.
ServerClient.prototype.emitData = function (event, data) {
  var self = this;

  asserts.isString(event);
  data = JSON.stringify({
    event: event,
    data:  data || ''
  });

  return new Promise(function (resolve, reject) {
    function writeData() {
      self._socket.write(data, 'utf8', resolve);
    }
    if (self._socket) {
      // We are connected.
      writeData();
    } else {
      self.once('connect', function () {
        asserts.exists(self._socket);
        writeData();
      });
    }
  })
  .catch(function (error) {
    logger.error(
      'unexpected error: \'%s\', stack: \'%s\'',
      error.toString(), error.stack
    );
    return Promise.reject(error);
  })
  .timeout(
    this._options.emitTimeout,
    'timeout exceeded while trying to write data into socket'
  );
}

ServerClient.prototype.disconnect =
ServerClient.prototype.close = function () {
  this._reconnectionIndex = -1;
  if (this._socket) {
    this._socket.end();
  }
}

module.exports = ServerClient;
