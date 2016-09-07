'use strict';

var assert = require('assert');
var Promise = require('bluebird');

var asserts = require('./utils/asserts.js');


// Class that is used to store each test device so we can send data to them.
function TestDevice(socket, data) {
  asserts.exists(socket);
  this._socket = socket;

  asserts.isString(data.name);
  this.name = data.name;

  asserts.isString(data.uuid)
  this.uuid = data.uuid;

  asserts.isString(data.os)
  this.platform = data.os;

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
}

TestDevice.prototype._emit = function (event, confirmationEvent, data) {
  var self = this;
  return new Promise(function (resolve) {
    self._socket
    .once(confirmationEvent, function () {
      resolve();
    })
    .emit(event, data);
  });
}

TestDevice.prototype.scheduleTests = function () {
  return this._emit(
    'schedule',
    'schedule_complete',
    JSON.stringify(this.tests)
  );
}

TestDevice.prototype.disqualify = function () {
  // Without confirmation.
  this._socket.emit('disqualify');
}

TestDevice.prototype.discard = function () {
  // Without confirmation.
  this._socket.emit('discard');
}

module.exports = TestDevice;
