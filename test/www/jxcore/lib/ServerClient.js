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
}

inherits(ServerClient, EventEmitter);

ServerClient.prototype.defaults = {
  reconnectionAttempts: 15,
  reconnectionDelay:    200,
  sendTimeout:          2 * 60 * 1000
};

ServerClient.prototype.connect = function () {
  this._socket = new nssocket.NsSocket({
    reconnect:     true,
    maxRetries:    this._options.reconnectionAttempts,
    retryInterval: this._options.reconnectionDelay
  });

  this._socket.data('*', this._data.bind(this));
  this._socket.on('close', this.emit.bind(this, 'close'));
  this._socket.on('error', function (error) {
    logger.error('socket error: \'%s\', stack: \'%s\'', error.toString(), error.stack);
  });
  // this._socket.on('error', this.emit.bind(this, 'error'));

  logger.debug('connecting to \'%s:%d\'', this._host, this._port);
  this._socket.connect(this._port, this._host, this._connected.bind(this));
}

ServerClient.prototype._connected = function () {
  logger.debug('connected to \'%s:%d\'', this._host, this._port);
  this.emit('connect');
}

ServerClient.prototype._data = function (data) {
  asserts.isArray(this._socket.event);
  assert(
    this._socket.event.length === 2,
    'we should receive \'data\' and \'event\' name'
  );
  asserts.equals(this._socket.event[0], 'data');
  var event = this._socket.event[1];
  asserts.isString(event);

  this.emit(event, data);
}

ServerClient.prototype.emitData = function (event, data) {
  var self = this;

  return new Promise(function (resolve, reject) {
    function send () {
      try {
        self._socket.send(event, data, resolve);
      } catch (e) {
        logger.debug('ignoring error from dead socket, error: \'%s\'', e);
        self.once('connect', send);
      }
    }
    send();
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

ServerClient.prototype.disconnect =
ServerClient.prototype.close = function () {
  this._socket.destroy();
}

module.exports = ServerClient;
