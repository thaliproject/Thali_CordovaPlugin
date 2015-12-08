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

var io = require('socket.io')(http,options);

var TestDevice = require('./TestDevice');
var PerfTestFramework = require('./PerfTestFramework');
var UnitTestFramework = require('./UnitTestFramework');

var testConfig = JSON.parse(process.argv[2]);

var unitTestManager = new UnitTestFramework(testConfig);
var perfTestManager = new PerfTestFramework(testConfig);

var timeOutValueToStart = 120000; // 2 minutes
if (!testConfig.honorCount) {

  // Perf tests only will start after a timeout regardless of whether the 
  // required number of devices has reported in (if honorCount == true)

  setTimeout(function () {

    console.log("-------- Starting perf test (after timeout) --------");

    perTestManager.startTests('ios');
    perTestManager.startTests('android');

  }, timeOutValueToStart);
}

io.on('connection', function(socket) {

  // A new device has connected to us.. we expect the next thing to happen to be
  // a 'present' message

  socket.on('disconnect', function () {
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
      socket, _device.name, _device.os, _device.type, _device.tests, _device.btaddress
    );

    switch (device.type)
    {
      case 'unittest' : 
      {
        console.log("New unit test device: " + device.deviceName);
        unitTestManager.addDevice(device);
      }
      break;

      case 'perftest' : 
      {
        console.log("New perf test device: " + device.deviceName);
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

