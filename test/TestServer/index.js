/*
 Main entry point for Thali test frameworks coordinator server

 jx index.js "{\"devices\":{\"android\":\"3\",\"ios\":\"2\"},\"honorCount\":\"true\"} //
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

var timeOutValueToStart = 30000;// after 300 seconds of waiting we'll start even if we did not get desired amount of devices

var deviceConfig = JSON.parse(process.argv[2]);

// honorCount == true indicates we will always wait for the required
// number of devices. Otherwise we proceed regardless after a timeout (only for perfTests)
var honorCount = deviceConfig.honorCount;

var TestFrameworks  = {
  perftest : {
    ios : new PerfTestFramework("iOs", deviceConfig.devices.ios, honorCount),
    android : new PerfTestFramework("Android", deviceConfig.devices.android, honorCount)
  },
  unittest : {
    ios : new UnitTestFramework("iOs"),
    android : new UnitTestFramework("Android")
  }
};

var startTimerId = null;
var testInProgress = false;

if (!deviceConfig.honorCount) {

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
}

io.on('connection', function (socket) {

  // A new device has connected to us.. we expect the next thing to happen to be
  // a 'present' message

  socket.on('present', function (msg) {

    var presentObj = JSON.parse(msg);
    if (!presentObj.os || !presentObj.name || !presentObj.type) {
      console.log("malformed message");
      socket.emit('error', JSON.stringify({"errorDescription ": "malformed message"}));
      return;
    }

    // Add the new device to the test type/os it reports as belonging too
    var newDevice = new TestDevice(
      socket, presentObj.name, presentObj.os, presentObj.type, presentObj.btaddress
    );
    TestsFrameworks[presentObj.type][presentObj.os].addDevice(newDevice, socket);

    var iosTests = TestFrameworks[presentObj.type]['ios'];
    var androidTests = TestFrameworks[presentObj.type]['android'];
    var testFramework = TestFrameworks[presentObj.type][presentObj.os];

    if (!testInProgress) {

      var androidCount = androidTests.getCount();
      var iosCount = iosTests.getCount();

      if (androidCount >= devicesConfig.devices.android && iosCount > devicesConfig.devices.ios) {
        testInProgress = true;
        androidTests.startTest({"devices": {"ios": iosCount, "android": androidCount}});
        iosTests.startTest({"devices": {"ios": iosCount, "android": androidCount}});
      }
    }

    // implemented by both unit & performance tests
    socket.on('disconnect', function () {
      if (!testInProgress) {
        socket.emit(
          'test_error', 
          JSON.stringify({"timeout ": "message not acceptable in current Test Server state"})
        );
        return;
      }
      testFramework.removeDevice(newDevice);
    });

    //this event only happens with unit tests, presentObj.type == unittest
    socket.on('setup_unit_test', function (msg) {
      var msgData = JSON.parse(msg);
      if (msgData.name == newDevice.getName()) {
        testFramework.addTest(newDevice, msgData.test);
      }
    });

    //this event only happens with unit tests, presentObj.type == unittest
    socket.on('unit_test_done', function (msg) {
      if (!testInProgress) {
        socket.emit('test_error', JSON.stringify({"timeout ": "message not acceptable in current Test Server state"}));
        return;
      }

      var msgData = JSON.parse(msg);
      if (msgData.name == newDevice.getName()) {
        testFramework.ClientStopEventReceived(msgData.name, msgData.test);
      }
    });

    //this event only happens with performance tests, presentObj.type == perftest
    socket.on('test data', function (data) {
      if (!testInProgress) {
        socket.emit('test_error', JSON.stringify({"timeout ": "message not acceptable in current Test Server state"}));
        return;
      }
      testFramework.ClientDataReceived(newDevice.getName(), data);
    });
  });
});

app.get('/', function(req, res){
  console.log("HTTP get called");
  res.sendfile('index.html');
});

http.listen(3000, function(){
  console.log('listening on *:3000');
});

