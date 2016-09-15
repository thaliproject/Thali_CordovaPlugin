'use strict';

// Main entry point for Thali test frameworks coordinator server
// jx index.js "{ 'devices': { 'android': 3, 'ios': 2 } }"

var util   = require('util');
var format = util.format;

var logger = require('./utils/logger')('TestServer');

var HttpServer        = require('./HttpServer');
var TestDevice        = require('./TestDevice');
var UnitTestFramework = require('./UnitTestFramework');


var httpServer = new HttpServer({
  port: 3000,
  transports: ['websocket']
});

var config = process.argv[2];
if (config) {
  config = JSON.parse(config);
}
var unitTestManager = new UnitTestFramework(config);

httpServer
.on('present', function (device) {
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
});

unitTestManager
.once('completed', function (results) {
  logger.debug('completed');
  var isSuccess = results.every(function (result) {
    return result;
  });
  if (isSuccess) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});
