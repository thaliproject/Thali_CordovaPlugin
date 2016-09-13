'use strict';

// Main entry point for Thali test frameworks coordinator server
// jx index.js "{ 'devices': { 'android': 3, 'ios': 2 } }"

var util = require('util');
var format = util.format;

var http = require('http');
var socketIO = require('socket.io');
var winston = require('winston');
var Promise = require('bluebird');

var asserts = require('./utils/asserts');

var TestDevice = require('./TestDevice');
var UnitTestFramework = require('./UnitTestFramework');
// var PerfTestFramework = require('./PerfTestFramework');


Promise.config({
  warnings: true,
  longStackTraces: true,
  cancellation: true,
  monitoring: true
});

var logger = new winston.Logger({
  level: 'debug',
  transports: [
    new winston.transports.Console({
      timestamp: true,
      debugStdout: true
    })
  ]
});

var server = http.createServer();
server.listen(3000, function () {
  logger.info('listening on *:3000');
});
var io = socketIO(server, {
  transports: ['websocket']
});

process
.on('SIGINT', function () {
  logger.error('got \'SIGINT\', terminating');
  io.close();
  process.exit(130); // Ctrl-C std exit code
})
.on('uncaughtException', function (error) {
  logger.error(
    format(
      'uncaught exception, error: \'%s\', stack: \'%s\'',
      error.toString(), error.stack
    )
  );
  io.close();
  process.exit(1);
})
.on('unhandledRejection', function (error, p) {
  logger.error(
    format(
      'uncaught promise rejection, error: \'%s\', stack: \'%s\'',
      error.toString(), error.stack
    )
  );
  io.close();
  process.exit(2);
});

var RETRY_COUNT = 120;
var RETRY_TIMEOUT = 3 * 1000;
var SETUP_TIMEOUT = 1 * 60 * 1000;
var TEST_TIMEOUT = 10 * 60 * 1000;
var TEARDOWN_TIMEOUT = 1 * 60 * 1000;

try {
  var config = process.argv[2];
  if (config) {
    config = JSON.parse(config);
  }
  var unitTestManager = new UnitTestFramework(config, logger);
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
      process.exit(3);
    }
  });

  io.on('connection', function (socket) {
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
    })
    .on('present', function (data) {
      // present - The device is announcing it's presence and telling us
      // whether it's running perf or unit tests.

      var device;
      try {
        asserts.isString(data);
        var device_data = JSON.parse(data);
        device = new TestDevice(socket, device_data, {
          retryCount: RETRY_COUNT,
          retryTimeout: RETRY_TIMEOUT,
          setupTimeout: SETUP_TIMEOUT,
          testTimeout: TEST_TIMEOUT,
          teardownTimeout: TEARDOWN_TIMEOUT
        });
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
          //   perfTestManager.addDevice(device);
          //   break;
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
} catch (error) {
  io.close();
  logger.error(
    'unexpected exception, error: \'%s\', stack: \'%s\'',
    error.toString(), error.stack
  );
}
