'use strict';

var util     = require('util');
var format   = util.format;
var inherits = util.inherits;

var objectAssign = require('object-assign');
var EventEmitter = require('events').EventEmitter;

var asserts = require('./utils/asserts.js');
var Promise = require('./utils/promise');

var defaultConfig = require('./config/Socket');


function Socket(rawSocket, options) {
  this._setOptions(options);

  asserts.exists(rawSocket);
  this._rawSocket = rawSocket;
}

inherits(Socket, EventEmitter);

Socket.prototype._setOptions = function (options) {
  if (options) {
    asserts.isObject(options);
  }
  this._options = objectAssign({}, defaultConfig, options);
  asserts.isNumber(this._options.retryCount);
  asserts.isNumber(this._options.retryTimeout);
}

Socket.prototype.update = function (socket) {
  asserts.instanceOf(socket, Socket);
  asserts.exists(socket._rawSocket);
  this._rawSocket = socket._rawSocket;
  this.emit('updated');
}

// Our handler should not care about socket.
Socket.prototype._bind = function (method, event, handler) {
  var self = this;

  var prevSocket;
  function bind(socket) {
    // We should remove listener from previous socket and add listener to new one.
    if (prevSocket) {
      prevSocket.removeListener(event, handler);
    }
    prevSocket = socket;
    socket[method](event, handler);
  }

  function updatedHandler () {
    bind(self._rawSocket);
  }
  this.on('updated', updatedHandler);
  updatedHandler();

  return {
    unbind: function () {
      self.removeListener('updated', updatedHandler);
      self._rawSocket.removeListener(event, handler);
    }
  };
}

// We should re-run method on the new socket.
Socket.prototype._run = function (method) {
  var self = this;
  var args = Array.from(arguments).slice(1);

  function updatedHandler () {
    self._rawSocket[method].apply(self._rawSocket, args);
  }
  this.on('updated', updatedHandler);
  updatedHandler();

  return {
    unbind: function () {
      self.removeListener('updated', updatedHandler);
    }
  };
}

// We will emit data until confirmation.
Socket.prototype.emitData = function (event, data) {
  var self = this;

  var timer;
  var retryIndex = 0;
  var onceConfirmed;
  var emitter;
  data = data || '';

  return new Promise(function (resolve, reject) {
    onceConfirmed = self._bind(
      'once',
      event + '_confirmed',
      function (receivedData) {
        if (data === receivedData) {
          resolve();
        } else {
          reject(new Error(
            format(
              'received confirmation with invalid data, sent data: \'%s\', received data: \'%s\'',
              data, receivedData
            )
          ));
        }
      }
    );

    function emit() {
      if (retryIndex >= self._options.retryCount) {
        reject(new Error(
          'retry count exceed'
        ));
        return;
      }
      retryIndex ++;

      if (emitter) {
        emitter.unbind();
      }
      emitter = self._run('emit', event, data);

      timer = setTimeout(emit, self._options.retryTimeout);
    }
    emit();
  })
  .finally(function () {
    clearTimeout(timer);
    if (emitter) {
      emitter.unbind();
    }
    if (onceConfirmed) {
      onceConfirmed.unbind();
    }
  });
}

// For example: runEvent('teardown', '2. my test', '{ a: 1 }', 1000)
Socket.prototype.runEvent = function (event, test, data, timeout) {
  var self = this;
  event += '_' + test;

  function handler (receivedData, resolve, reject) {
    try {
      asserts.isString(receivedData);
      var result = JSON.parse(receivedData);
      asserts.isBool(result.success);
      if (result.success) {
        resolve(result.data);
      } else {
        throw new Error(format(
          'run failed, test: \'%s\', event: \'%s\', sent data: \'%s\', received data: \'%s\'',
          test, event, data, receivedData
        ));
      }
    } catch (error) {
      reject(error);
    }
  }

  var onceFinished;
  return this.emitData(event, data)
  .then(function () {
    return new Promise(function (resolve, reject) {
      onceFinished = self._bind(
        'once',
        event + '_finished',
        function (receivedData) {
          handler(receivedData, resolve, reject);
        }
      );
    })
    .timeout(timeout, format(
      'timeout, event: \'%s_finished\', test: \'%s\'',
      event, test
    ));
  })
  .finally(function () {
    if (onceFinished) {
      onceFinished.unbind();
    }
  });
}

module.exports = Socket;
