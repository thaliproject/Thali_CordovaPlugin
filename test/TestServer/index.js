'use strict';

// Main entry point for Thali test frameworks coordinator server
// jx index.js "{ 'devices': { 'android': 3, 'ios': 2 } }"

var util   = require('util');
var format = util.format;

require('./utils/process');
var logger = require('./utils/ThaliLogger')('TestServer');

var Server            = require('./Server');
var TestDevice        = require('./TestDevice');
var UnitTestFramework = require('./UnitTestFramework');


var WAITING_FOR_DEVICES_TIMEOUT = 5 * 60 * 1000;

var server = new Server({
  port: 3000
});

var managerOptions = process.argv[2];
if (managerOptions) {
  managerOptions = JSON.parse(managerOptions);
}
var unitTestManager = new UnitTestFramework(managerOptions);

var options = process.argv[3];
if (options) {
  options = JSON.parse(options);
}

server
.on('presented', function (device) {
  switch (device.type) {
    case 'unittest': {
      unitTestManager.addDevice(device);
      break;
    }
    default: {
      throw new Error(
        format('unrecognised device type: \'%s\'', device.type)
      );
    }
  }
})
.on('error', function (error) {
  // throw new Error(error);
});

function reset() {
  var timer = setTimeout(function () {
    throw new Error('timeout exceed');
  }, WAITING_FOR_DEVICES_TIMEOUT);

  unitTestManager
  .once('started', function (results) {
    clearTimeout(timer);
  })
  .once('completed', function (results) {
    logger.debug('completed');

    var isSuccess = results.every(function (result) {
      return result;
    });
    httpServer.disconnectAll();
    if (isSuccess) {
      if (options && options.resetOnCompleted) {
        unitTestManager.reset();
        reset();
      } else {
        process.exit(0);
      }
    } else {
      process.exit(1);
    }
  });
}
reset();
