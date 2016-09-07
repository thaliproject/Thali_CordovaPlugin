'use strict';

// Main entry point for Thali test frameworks coordinator server
// jx index.js "{\"devices\": {\"android\": 3, \"ios\": 2}, \"honorCount\": true}"

var http = require('http');
var socketIO = require('socket.io');
var winston = require('winston');

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

var TestDevice = require('./TestDevice');
var PerfTestFramework = require('./PerfTestFramework');
var UnitTestFramework = require('./UnitTestFramework');

var testConfig = JSON.parse(process.argv[2]);
var unitTestManager = new UnitTestFramework(testConfig, logger);
var perfTestManager = new PerfTestFramework(testConfig, logger);

process.on('SIGINT', function () {
  logger.debug('Got \'SIGINT\'. Terminating.');
  io.close();
  process.exit(130); // Ctrl-C std exit code
});

io.on('connection', function (socket) {
  // A new device has connected to us.
  // We expect the next thing to happen to be a 'present' message.

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

    logger.debug('device presented, data: %s', data);

    // Add the new device to the test type/os it reports as belonging to.
    try {
      var device_data = JSON.parse(data);
      var device = new TestDevice(socket, device_data);
      socket.deviceName = device.name;
    } catch (error) {
      socket.emit(
        'error',
        'malformed message, reason: \'' + error.toString() + '\', data: \'' + data + '\''
      );
      return;
    }

    switch (device.type) {
      case 'unittest' : {
        unitTestManager.addDevice(device);
        break;
      }
      case 'perftest' : {
        perfTestManager.addDevice(device);
        break;
      }
      default : {
        logger.error(
          'unrecognised test type: \'%s\'', device.type
        );
      }
    }
  });
});
