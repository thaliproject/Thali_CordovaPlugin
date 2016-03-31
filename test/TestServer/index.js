/*
 Main entry point for Thali test frameworks coordinator server
 jx index.js "{\"devices\": {\"android\": 3, \"ios\": 2}, \"honorCount\": true}"
*/

'use strict';

var options = {
  transports: ['websocket']
};

var app = require('express')();
var http = require('http').Server(app);

var io = require('socket.io')(http, options);

var TestDevice = require('./TestDevice');
var PerfTestFramework = require('./PerfTestFramework');
var UnitTestFramework = require('./UnitTestFramework');

// Create a logger
var winston = require('winston');
var logger = new (winston.Logger)({
  level : 'debug',
  transports: [
    new (winston.transports.Console)({'timestamp':true, 'debugStdout':true})
  ]
});

var testConfig = JSON.parse(process.argv[2]);
var unitTestManager = new UnitTestFramework(testConfig, logger);
var perfTestManager = new PerfTestFramework(testConfig, logger);

process.on('SIGINT', function () {
  logger.debug('Got SIGINT.  Terminating.');
  io.close();
  process.exit(130); // Ctrl-C std exit code
});

io.on('connection', function (socket) {

  // A new device has connected to us.. we expect the next thing to happen to be
  // a 'present' message

  socket.deviceName = 'DEVICE THAT HAS NOT PRESENTED YET';

  socket.on('disconnect', function (reason) {
    logger.info(
      'Socket to device %s disconnected: %s',
      socket.deviceName, reason
    );
  });

  socket.on('error', function (error) {
    logger.debug(error);
  });

  socket.on('present', function (msg) {

    // present - The device is announcing it's presence and telling us
    // whether it's running perf or unit tests

    var _device = JSON.parse(msg);
    if (!_device.os || !_device.name || !_device.type) {
      logger.debug('malformed message');
      socket.emit('error', JSON.stringify({
        'errorDescription ': 'malformed message',
        'message' : msg
      }));
      return;
    }

    socket.deviceName = _device.name;

    // Add the new device to the test type/os it reports as belonging to
    var device = new TestDevice(
      socket, _device.name, _device.uuid, _device.os, _device.type,
      _device.tests, _device.supportedHardware, _device.btaddress
    );

    logger.debug(
      'Device presented: %s (%s) - %s %s',
      _device.name, _device.uuid, _device.os, _device.version
    );

    switch (device.type)
    {
      case 'unittest' : {
        unitTestManager.addDevice(device);
        break;
      }
      case 'perftest' : {
        perfTestManager.addDevice(device);
        break;
      }
      default : {
        logger.debug('unrecognised test type: ' + device.type);
      }
    }
  });

});

app.get('/', function (req, res){
  logger.info('HTTP get called');
  res.sendfile('index.html');
});

http.listen(3000, function (){
  logger.info('listening on *:3000');
});
