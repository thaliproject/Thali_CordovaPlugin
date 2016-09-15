'use strict';

// Main entry point for Thali test frameworks coordinator server
// jx index.js "{ 'devices': { 'android': 3, 'ios': 2 } }"

var util   = require('util');
var format = util.format;

var http     = require('http');
var socketIO = require('socket.io');

require('./utils/process');
var asserts = require('./utils/asserts');
var Promise = require('./utils/promise');
var logger  = require('./utils/logger')('TestServerIndex');

var TestDevice        = require('./TestDevice');
var UnitTestFramework = require('./UnitTestFramework');
// var PerfTestFramework = require('./PerfTestFramework');


var server = http.createServer();
var io = socketIO(server, {
  transports: ['websocket']
});
server.listen(3000, function () {
  logger.info('listening on *:3000');
});

process.on('exit', function () {
  io.close();
});

var config = process.argv[2];
if (config) {
  config = JSON.parse(config);
}
var unitTestManager = new UnitTestFramework(config);
// var perfTestManager = new PerfTestFramework(testConfig, logger);

unitTestManager.once('completed', function (results) {
  logger.debug('completed');
  var isSuccess = results.every(function (result) {
    return result;
  });
  io.close();
  if (isSuccess) {
    process.exit(0);
  } else {
    process.exit(1);
  }
});

io.on('connect', function (socket) {
  // A new device has connected to us.
  // We expect the next thing to happen to be a 'present' message.

  asserts.isObject(socket);
  socket.deviceName = 'device that was not presented yet';

  socket
  .on('disconnect', function (reason) {
    logger.info(
      'Socket to device name: \'%s\' disconnected, reason: \'%s\'',
      socket.deviceName, reason
    );
  })
  .on('error', function (error) {
    logger.error(
      'unexpected exception, error: \'%s\', stack: \'%s\'',
      error.toString(), error.stack
    );
    io.close();
    process.exit(2);
  })
  .on('present', function (data) {
    // present - The device is announcing it's presence and telling us
    // whether it's running perf or unit tests.

    var device;
    try {
      asserts.isString(data);
      var device_data = JSON.parse(data);
      device = new TestDevice(socket, device_data);
      socket.deviceName = device.name;
    } catch (error) {
      socket.emit(
        'error',
        format(
          'malformed message, data: \'%s\', error: \'%s\', stack: \'%s\'',
          data, error.toString(), error.stack
        )
      );
      return;
    }

    logger.debug(
      'device presented, name: \'%s\', uuid: \'%s\', platformName: \'%s\', type: \'%s\', supportedHardware: \'%s\'',
      device.name, device.uuid, device.platformName, device.type, device.supportedHardware
    );

    // Add the new device to the test type/os it reports as belonging to.
    try {
      switch (device.type) {
        case 'unittest': {
          unitTestManager.addDevice(device);
          break;
        }
        // case 'perftest': {
        // }
        default: {
          throw new Error(
            format('unrecognised device type: \'%s\'', device.type)
          );
        }
      }
    } catch (error) {
      socket.emit(
        'error',
        format(
          'could not add device, error: \'%s\', stack: \'%s\'',
          error.toString(), error.stack
        )
      );
    }
  });
});
