'use strict';

// We want to initialize Socket

var util     = require('util');
var format   = util.format;
var inherits = util.inherits;

var assert       = require('assert');
var uuid         = require('node-uuid');
var objectAssign = require('object-assign');
var EventEmitter = require('events').EventEmitter;

var asserts = require('./utils/asserts.js');
var Promise = require('./utils/Promise');
var logger  = require('./utils/ThaliLogger')('Socket');

var defaultConfig = require('./config/Socket');


// We want to create 'Socket' from raw socket.
// We want to use 'runEvent' and 'emitData' methods.
// We can update raw socket anytime and our current jobs shouldn't fail or hang.
function Socket(rawSocket, options) {
  this._setOptions(options);

  asserts.exists(rawSocket);
  this._rawSocket = rawSocket;

  this._init();
}

inherits(Socket, EventEmitter);

Socket.prototype._setOptions = function (options) {
  if (options) {
    asserts.isObject(options, 'Socket._setOptions');
  }
  this._options = objectAssign({}, defaultConfig, options);
  asserts.isNumber(this._options.retryCount);
  asserts.isNumber(this._options.retryTimeout);
};

Socket.prototype._init = function () {
  var self = this;

  // Current socket client wants to be synchronized with other clients.
  this._bind('on', 'sync', function (data) {
    self.emit('sync', data);
  });
};

// We want to notify all our auto-bind and auto-apply handlers
// that raw socket was updated.
Socket.prototype.update = function (socket) {
  asserts.instanceOf(socket, Socket);
  asserts.exists(socket._rawSocket);
  this._rawSocket = socket._rawSocket;
  this.emit('updated');
};

// For example _bind('once', 'schedule_confirmed',
// function (receivedData) { ... })
// We want our handler not to care about socket.
// We want to receive data from any raw socket.
// So we want to auto-bind to any new socket and unbind from previous one.
// We want to be able to unbind this auto-bind function.
Socket.prototype._bind = function (method, event, handler) {
  var self = this;

  var prevSocket;
  function bind(socket) {
    // We should remove listener from previous socket and add listener to new
    // one.
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
};

// For example _apply('emit', 'schedule', '[test1, test2]')
// We need to apply this 'emit' method on current socket.
// We want this method to be applied to any new socket.
// We want to be able to unbind this auto-apply function.
Socket.prototype._apply = function (method) {
  var self = this;
  var args = Array.prototype.slice.call(arguments, 1);

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
};

// We will emit data until confirmation.
// For example: emitData('schedule', '[test1, test2]');
// 1. We will send 'schedule' with data until confirmation.
// 2. We will wait until 'schedule_confirmed' will be received with data.
// 3. We will check that these datas are the same.
Socket.prototype.emitData = function (event, data) {
  var self = this;

  var timer;
  var retryIndex = 0;
  var onceConfirmed;
  var emitter;

  data = {
    uuid:    uuid.v4(),
    content: data
  };
  var dataString = JSON.stringify(data);

  return new Promise(function (resolve, reject) {
    onceConfirmed = self._bind(
      'once',
      event + '_confirmed',
      function (receivedData) {
        var receivedDataString = JSON.stringify(receivedData);
        if (dataString === receivedDataString) {
          resolve();
        } else {
          reject(new Error(
            format(
              'received confirmation with invalid data, sent data: \'%s\', ' +
              'received data: \'%s\'', dataString, receivedDataString
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
      emitter = self._apply('emit', event, data);

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
};

// We will emit data until confirmation and then verify the test finish.
// For example: runEvent('teardown', '2. my test', '{ a: 1 }', 1000).
// 1. We will send 'teardown_2. my test' until confirmation.
// 2. We will wait until 'teardown_2. my test_finished' or 'teardown_2.
// my test_skipped' will be received.
// 3. We will check whether skip is allowed if event was skipped.
// 3. We will verify that test succeeded.
Socket.prototype.runEvent = function (event, test, data, timeout, canBeSkipped)
{
  var self = this;

  var dataString = JSON.stringify(data);
  event += '_' + test;

  function finishedHandler (receivedData, resolve, reject) {
    try {
      var receivedDataString = JSON.stringify(receivedData);
      asserts.isBool(receivedData.success);
      if (receivedData.success) {
        resolve(receivedData.data);
      } else {
        throw new Error(format(
          'run failed, test: \'%s\', event: \'%s\', sent data: \'%s\', ' +
          'received data: \'%s\'', test, event, dataString, receivedDataString
        ));
      }
    } catch (error) {
      reject(error);
    }
  }

  function skipHandler (resolve, reject) {
    try {
      assert(
        canBeSkipped,
        format('we should allow event \'%s\' to be skipped', event)
      );
      logger.info(
        'run skipped, test: \'%s\', event: \'%s\'',
        test, event
      );
      throw new Error('skipped');
    } catch (error) {
      reject(error);
    }
  }

  var onceFinished;
  var onceSkipped;
  return new Promise(function (resolve, reject) {
    onceFinished = self._bind(
      'once',
      event + '_finished',
      function (receivedData) {
        finishedHandler(receivedData, resolve, reject);
      }
    );
    onceSkipped = self._bind(
      'once',
      event + '_skipped',
      function () {
        skipHandler(resolve, reject);
      }
    );

    self.emitData(event, data)
    .catch(function (error) {
      logger.error(
        'unexpected error: \'%s\', stack: \'%s\'',
        error.toString(), error.stack
      );
      reject(error);
    });
  })
  .timeout(timeout, format(
    'timeout exceeded, event: \'%s_finished\', test: \'%s\'',
    event, test
  ))
  .finally(function () {
    if (onceFinished) {
      onceFinished.unbind();
    }
    if (onceSkipped) {
      onceSkipped.unbind();
    }
  });
};

module.exports = Socket;
