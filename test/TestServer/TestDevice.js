'use strict';

var util     = require('util');
var inherits = util.inherits;

var objectAssign = require('object-assign');
var assert       = require('assert');
var EventEmitter = require('events').EventEmitter;

var asserts = require('./utils/asserts.js');

var Socket        = require('./Socket');
var defaultConfig = require('./config/TestDevice');


// Class that is used to store each test device so we can send data to them.
function TestDevice(rawSocket, info, options) {
  this._setInfo(info);
  this._setOptions(options);

  asserts.exists(rawSocket);
  this._socket = new Socket(rawSocket);

  this._init();
}

inherits(TestDevice, EventEmitter);

TestDevice.prototype._setOptions = function (options) {
  if (options) {
    asserts.isObject(options, 'TestDevice._setOptions');
  }
  this._options = objectAssign({}, defaultConfig, options);
  asserts.isNumber(this._options.setupTimeout);
  asserts.isNumber(this._options.testTimeout);
  asserts.isNumber(this._options.teardownTimeout);
};

TestDevice.prototype._setInfo = function (info) {
  asserts.isString(info.name);
  this.name = info.name;

  asserts.isString(info.uuid);
  this.uuid = info.uuid;

  asserts.isString(info.os);
  this.platformName = info.os;

  asserts.isString(info.type);
  this.type = info.type;

  asserts.isBool(info.hasRequiredHardware);
  this.hasRequiredHardware = info.hasRequiredHardware;

  asserts.isBool(info.nativeUTFailed);
  this.nativeUTFailed = info.nativeUTFailed;

  asserts.isArray(info.tests);
  assert(
    info.tests.length > 0,
    'we should have at least one test'
  );
  info.tests.forEach(function (test) {
    asserts.isString(test);
  });
  this.tests = info.tests;

  this.btAddress = info.btaddress;
};

TestDevice.prototype._init = function () {
  var self = this;

  // Current device wants to be synchonized with other devices.
  this._socket.on('sync', function (data) {
    self.emit('sync', data);
  });
};

TestDevice.prototype.syncFinished = function (data) {
  return this._socket.emitData('syncFinished', data);
};

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
  asserts.equals(this.hasRequiredHardware, newDevice.hasRequiredHardware);
  asserts.equals(this.nativeUTFailed, newDevice.nativeUTFailed);

  asserts.arrayEquals(this.tests, newDevice.tests);
  asserts.equals(this.btAddress, newDevice.btAddress);

  this._socket.update(newDevice._socket);
};

TestDevice.prototype.scheduleTests = function (tests) {
  return this._socket.emitData('schedule', tests);
};

TestDevice.prototype.setupTest = function (test, canBeSkipped) {
  return this._socket.runEvent('setup', test, undefined,
    this._options.setupTimeout, canBeSkipped);
};

TestDevice.prototype.runTest = function (test, data, canBeSkipped) {
  return this._socket.runEvent('run', test, data,
    this._options.testTimeout, canBeSkipped);
};

TestDevice.prototype.teardownTest = function (test, canBeSkipped) {
  return this._socket.runEvent('teardown', test, undefined,
    this._options.teardownTimeout, canBeSkipped);
};

TestDevice.prototype.complete = function () {
  return this._socket.emitData('complete');
};

TestDevice.prototype.disqualify = function (error) {
  return this._socket.emitData('disqualify', error);
};

TestDevice.prototype.discard = function () {
  return this._socket.emitData('discard');
};

TestDevice.prototype.error = function (error) {
  return this._socket.emitData('error', error);
};

module.exports = TestDevice;
