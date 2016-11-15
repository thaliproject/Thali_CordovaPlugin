'use strict';

// Main entry point for Thali test frameworks coordinator server
// jx index.js "{ 'devices': { 'android': 3, 'ios': 2 } }"

var util   = require('util');
var format = util.format;

require('./utils/process');
var logger = require('./utils/ThaliLogger')('TestServer');

var HttpServer        = require('./HttpServer');
var UnitTestFramework = require('./UnitTestFramework');

var DEFAULT_SERVER_PORT = Number(process.env.COORDINATED_PORT) || 3000;
var WAITING_FOR_DEVICES_TIMEOUT = 5 * 60 * 1000;

var httpServer = new HttpServer({
  port: DEFAULT_SERVER_PORT,
  transports: ['websocket']
});

var options = process.argv[2];
if (options) {
  options = JSON.parse(options);
}
var unitTestManager = new UnitTestFramework(options);

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

var timer = setTimeout(function () {
  throw new Error('timeout exceed');
}, WAITING_FOR_DEVICES_TIMEOUT);

unitTestManager
.once('started', function () {
  clearTimeout(timer);
})
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
