'use strict';

var util     = require('util');
var format   = util.format;
var inherits = util.inherits;

var objectAssign = require('object-assign');
var assert       = require('assert');
var Promise      = require('bluebird');
var EventEmitter = require('events').EventEmitter;

require('./utils/polyfills.js');
var asserts       = require('./utils/asserts.js');
var defaultConfig = require('./TestDeviceConfig');


// Class that is used to store each test device so we can send data to them.
function TestDevice(socket, data, options) {
  asserts.exists(socket);
  this._socket = socket;

  asserts.isString(data.name);
  this.name = data.name;

  asserts.isString(data.uuid);
  this.uuid = data.uuid;

  asserts.isString(data.os);
  this.platformName = data.os;

  asserts.isString(data.type);
  this.type = data.type;

  asserts.isBool(data.supportedHardware);
  this.supportedHardware = data.supportedHardware;

  asserts.isArray(data.tests);
  assert(
    data.tests.length > 0,
    'we should have at least one test'
  );
  data.tests.forEach(function (test) {
    asserts.isString(test);
  });
  this.tests = data.tests;

  this.btAddress = data.btaddress;

  this._options = objectAssign({}, defaultConfig, options);
  asserts.isNumber(this._options.retryCount);
  asserts.isNumber(this._options.retryTimeout);
}

inherits(TestDevice, EventEmitter);

TestDevice.prototype.update = function (newDevice) {
  // This is annoying.
  // Android devices will randomly disconnect and reconnect during a run.
  // When they do we need to patch the existing device record
  // with the new socket by comparing the uuid's.
  // Our device must know that we can update socket anytime.

  // We are going to update only socket.
  asserts.equals(this.name, newDevice.name);
  asserts.equals(this.uuid, newDevice.uuid);
  asserts.equals(this.platformName, newDevice.platformName);
  asserts.equals(this.type, newDevice.type);
  asserts.equals(this.supportedHardware, newDevice.supportedHardware);

  asserts.arrayEquals(this.tests, newDevice.tests);
  asserts.equals(this.btAddress, newDevice.btAddress);

  asserts.exists(newDevice._socket);
  this._socket = newDevice._socket;
  this.emit('socket_updated');
}

// Our handler should not care about socket.
TestDevice.prototype._socketBind = function (method, event, handler) {
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
    bind(self._socket);
  }
  this.on('socket_updated', updatedHandler);
  updatedHandler();

  return {
    unbind: function () {
      self.removeListener('socket_updated', updatedHandler);
      self._socket.removeListener(event, handler);
    }
  };
}

// We should re-run method on the new socket.
TestDevice.prototype._socketRun = function (method) {
  var self = this;
  var args = Array.from(arguments).slice(1);

  function updatedHandler () {
    self._socket[method].apply(self._socket, args);
  }
  this.on('socket_updated', updatedHandler);
  updatedHandler();

  return {
    unbind: function () {
      self.removeListener('socket_updated', updatedHandler);
    }
  };
}

// We will emit data until confirmation.
TestDevice.prototype._emitData = function (event, data) {
  var self = this;

  var timeout;
  var retryIndex = 0;
  var onceConfirmed;
  var emitter;
  data = data || '';

  return new Promise(function (resolve, reject) {
    onceConfirmed = self._socketBind(
      'once',
      event + '_confirmed',
      function (_data) {
        if (data === _data) {
          resolve();
        } else {
          reject(new Error(
            format(
              'received confirmation with invalid data, sent data: \'%s\', received data: \'%s\'',
              data, _data
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
      emitter = self._socketRun('emit', event, data);

      timeout = setTimeout(emit, self._options.retryTimeout);
    }
    emit();
  })
  .finally(function () {
    clearTimeout(timeout);
    if (emitter) {
      emitter.unbind();
    }
    if (onceConfirmed) {
      onceConfirmed.unbind();
    }
  });
}

TestDevice.prototype._runEvent = function (event, test, data, timeout) {
  var self = this;
  event += '_' + test;

  var onceFinished;

  return this._emitData(event, data)
  .then(function () {
    return new Promise(function (resolve, reject) {
      onceFinished = self._socketBind(
        'once',
        event + '_finished',
        function (_data) {
          try {
            asserts.isString(_data);
            var result = JSON.parse(_data);
            asserts.isBool(result.success);
            if (result.success) {
              resolve(result.data);
            } else {
              throw new Error(format(
                'run failed, test: \'%s\', event: \'%s\', sent data: \'%s\', received data: \'%s\'',
                test, event, data, _data
              ));
            }
          } catch (error) {
            reject(error);
          }
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

TestDevice.prototype.scheduleTests = function (tests) {
  return this._emitData('schedule', JSON.stringify(tests));
}

TestDevice.prototype.setupTest = function (test) {
  return this._runEvent('setup', test, undefined, this._options.setupTimeout);
}

TestDevice.prototype.runTest = function (test, data) {
  return this._runEvent('run', test, JSON.stringify(data), this._options.testTimeout);
}

TestDevice.prototype.teardownTest = function (test) {
  return this._runEvent('teardown', test, undefined, this._options.teardownTimeout);
}

TestDevice.prototype.complete = function () {
  return this._emitData('complete');
}

TestDevice.prototype.disqualify = function () {
  return this._emitData('disqualify');
}

TestDevice.prototype.discard = function () {
  return this._emitData('discard');
}

module.exports = TestDevice;
