'use strict';

var assert = require('assert');

// Class that is used to store each test device so we can send data to them.
function TestDevice(socket, data) {
  assert(
    socket !== undefined && socket !== null,
    '\'socket\' should be defined'
  );
  this.socket = socket;

  assert(
    typeof data.name === 'string' && data.name,
    '\'data.name\' should be not empty string'
  );
  this.deviceName = data.name;

  assert(
    typeof data.uuid === 'string' && data.uuid,
    '\'data.uuid\' should be not empty string'
  );
  this.uuid = data.uuid;

  assert(
    typeof data.os === 'string' && data.os,
    '\'data.os\' should be not empty string'
  );
  this.platform = data.os;

  assert(
    typeof data.type === 'string' && data.type,
    '\'data.type\' should be not empty string'
  );
  this.type = data.type;

  assert(
    typeof data.supportedHardware === 'boolean',
    '\'data.supportedHardware\' should be a defined boolean'
  );
  this.supportedHardware = data.supportedHardware;

  assert(
    Array.isArray(data.tests) && data.tests.length > 0,
    '\'tests\' should be an array with at least one test'
  );
  this.tests = data.tests;

  this.btAddress = data.btaddress;
}

module.exports = TestDevice;
