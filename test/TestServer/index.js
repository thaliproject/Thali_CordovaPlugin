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

// This is the time to wait for devices to connect in case honor count is
// not set to true. This is especially designed for the CI environment where
// it might take a significant amount of time to deploy to all devices
// but in the end, the deployment to all might not always work and thus
// it is beneficial to be able to anyways do the test run with the amount
// of devices that were able to connect.
var timeOutValueToStart = 120000; // 2 minutes

var testConfig = JSON.parse(process.argv[2]);

/*if (!deviceConfig.honorCount) {

  startTimerId = setTimeout(function () {

    console.log("-------- Starting test (after timeout) --------");
    testInProgress = true;

    for (var testType in TestFrameworks) {
      // Reform the deviceConfig to match the number of devices we actually saw by the
      // time the timer elapsed
      var actualConfig = { "devices" : { 
        "ios" : TestFrameworks[testType]["ios"].getCount(),
        "android" : TestFrameworks[testType]["android"].getCount()
      }};
          
      TestFramework[testType]["ios"].startTest(actualConfig);
      TestFramework[testType]["android"].startTest(actualConfig);
    }

  }, timeOutValueToStart);
}*/

var unitTestManager = new UnitTestFramework(testConfig);
var perfTestManager = new PerfTestFramework(testConfig);

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

