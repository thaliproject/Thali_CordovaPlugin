/*
 Main entry point for Thali test frameworks coordinator server

 jx index.js "{\"devices\":{\"android\":\"3\",\"ios\":\"2\"},\"honorCount\":true}"
*/

'use strict';

var options = {
  transports: ['websocket']
};

var app = require('express')();
var http = require('http').Server(app)

var io = require('socket.io')(http, options);

var TestDevice = require('./TestDevice');
var PerfTestFramework = require('./PerfTestFramework');
var UnitTestFramework = require('./UnitTestFramework');

var testConfig = JSON.parse(process.argv[2]);
var unitTestManager = new UnitTestFramework(testConfig);
var perfTestManager = new PerfTestFramework(testConfig);

process.on('SIGINT', function() {
  console.log('Got SIGINT.  Terminating.');
  io.close();
  process.exit(130); // Ctrl-C std exit code
});

io.on('connection', function(socket) {

  // A new device has connected to us.. we expect the next thing to happen to be
  // a 'present' message

  socket.on('disconnect', function () {
    console.log("Socket disconnected");
    socket.emit(
      'test_error', 
      JSON.stringify({"timeout ": "message not acceptable in current Test Server state"})
    );
  });

  socket.on('present', function(msg) {
 
    // present - The device is announcing it's presence and telling us 
    // whether it's running perf or unit tests
 
    var _device = JSON.parse(msg);
    if (!_device.os || !_device.name || !_device.type) {
      console.log("malformed message");
      socket.emit('error', JSON.stringify({
        "errorDescription ": "malformed message",
        "message" : msg
      }));
      return;
    }

    // Add the new device to the test type/os it reports as belonging to
    var device = new TestDevice(
      socket, _device.name, _device.uuid, _device.os, _device.type, _device.tests, _device.btaddress
    );

    console.log("New device presented: %s (%s) %s", _device.name, _device.os, _device.type);

    switch (device.type)
    {
      case 'unittest' : 
      {
        unitTestManager.addDevice(device);
      }
      break;

      case 'perftest' : 
      {
        perfTestManager.addDevice(device);
      }
      break;

      default : console.log('unrecognised test type: ' + device.type);
    }
  });

});

app.get('/', function(req, res){
  console.log("HTTP get called");
  res.sendfile('index.html');
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});

