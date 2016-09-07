'use strict';

// Main entry point for Thali test frameworks coordinator server
// jx index.js "{ 'devices': { 'android': 3, 'ios': 2 } }"

var format = require('util').format;
var http = require('http');
var socketIO = require('socket.io');
var winston = require('winston');
var Promise = require('bluebird');

var asserts = require('./utils/asserts');

var TestDevice = require('./TestDevice');
var PerfTestFramework = require('./PerfTestFramework');
var UnitTestFramework = require('./UnitTestFramework');


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
server.listen(3000, function (){
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
    format('Uncaught Exception, error: \'%s\'', error.stack)
  );
  io.close();
  process.exit(1);
})
.on('unhandledRejection', function (error, p) {
  logger.error(
    format('Uncaught Promise Rejection, error: \'%s\'', error.stack)
  );
  io.close();
  process.exit(2);
});

try {
  var testConfig = JSON.parse(process.argv[2]);
  var unitTestManager = new UnitTestFramework(testConfig, logger);
  var perfTestManager = new PerfTestFramework(testConfig, logger);

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
      logger.error(error);
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
            'malformed message, reason: \'%s\', data: \'%s\'',
            error.stack, data
          )
        );
        return;
      }

      logger.debug(
        'device presented, name: \'%s\', uuid: \'%s\', platform: \'%s\', type: \'%s\', supportedHardware: \'%s\'',
        device.name, device.uuid, device.platform, device.type, device.supportedHardware
      );

      // Add the new device to the test type/os it reports as belonging to.
      try {
        switch (device.type) {
          case 'unittest': {
            unitTestManager.addDevice(device);
            break;
          }
          case 'perftest': {
            perfTestManager.addDevice(device);
            break;
          }
          default: {
            throw new Error(
              format('unrecognised device type: \'%s\'', device.type)
            );
          }
        }
      } catch (error) {
        socket.emit(
          'error',
          format('could not add device, reason: \'%s\'', error.stack)
        );
      }
    });
  });
} catch (error) {
  io.close();
  logger.error(error.stack);
}
