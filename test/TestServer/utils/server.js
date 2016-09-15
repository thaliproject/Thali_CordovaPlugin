'use strict';

var http         = require('http');
var socketIO     = require('socket.io');
var objectAssign = require('object-assign');

var logger = require('./logger')('TestServer');


function Server (options) {
  var self = this;
  this._options = objectAssign({}, this.defaults, options);

  var server = http.createServer();
  this._io = socketIO(server, {
    transports: this._options.transports
  });
  server.listen(this._options.port, function () {
    logger.info('listening on *:' + self._options.port);
  });

  this.bind();
}

Server.prototype.defaults = {
  transports: ['websocket']
};

Server.prototype.bind = function () {
  process.once('exit', this._exit.bind(this));
  this._io.on('connect', this._connect.bind(this));
}

Server.prototype._connect = function (socket) {
  asserts.isObject(socket);
  socket.deviceName = 'device that was not presented yet';

  this._socket = socket;
}

Server.prototype._exit = function () {
  this._io.close();
}

module.exports = Server;
