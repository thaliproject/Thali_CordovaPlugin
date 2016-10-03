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
  this._reconnectionIndex = 0;
}

inherits(ServerClient, EventEmitter);

ServerClient.prototype.defaults = {
  reconnectionAttempts: 15,
  reconnectionDelay:    200,
  emitTimeout:          2 * 60 * 1000
};

ServerClient.prototype.connect = function () {
  var self = this;

  var socket = new net.Socket()
  .on('error', this._error .bind(this))
  .on('close', this._closed.bind(this));

  logger.debug('connecting to \'%s:%d\'', this._host, this._port);
  socket.connect(this._port, this._host, this._connected.bind(this, socket));
}

ServerClient.prototype._connected = function (socket) {
  logger.debug('connected to \'%s:%d\'', this._host, this._port);
  this._socket = socket;
  this.emit('connect');
}

ServerClient.prototype._closed = function () {
  delete this._socket;
  if (this._reconnectionIndex > this._options.reconnectionAttempts) {
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
  delete this._socket;
  this.emit('error', error);
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

module.exports = ServerClient;
