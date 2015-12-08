/* TestFramework - Base for classes that manage collections of devices and associated tests
 */

'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;

function TestFramework(testConfig) {

  TestFramework.super_.call(this);

  this.devices = {};
  this.testConfig = testConfig;
  this.testsRunning = false;
}

util.inherits(TestFramework, EventEmitter);

TestFramework.prototype.addDevice = function(device) {

  // this.devices = { 'ios' : [dev1, dev2], 'android' : [dev3, dev4] }
  if (!this.devices[device.platform]) {
    this.devices[device.platform] = [device];
  } else {
    this.devices[device.platform].push(device);
  }

  // See if we have enough devices of platform type to start a test run
  if (this.devices[device.platform].length === this.testConfig.devices[device.platform]) {
    this.startTests(device.platform, device.tests);
    this.testsRunning = true;
  }
}

TestFramework.prototype.removeDevice = function(device) {
  var i = this.devices[device.platform].indexOf(device);
  this.devices[device.platform].splice(i, 1);
  assert(this.devices[device.platform].indexOf(device) == -1);
}

module.exports = TestFramework;
