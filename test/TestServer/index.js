/*
 Main entry point for Thali test frameworks coordinator server

 jx index.js "{\"devices\":{\"android\":\"3\",\"ios\":\"2\"},\"honorCount\":\"true\"} //
 */

'use strict';


var options = {
  transports: ['websocket']
};

//pingTimeout: 3599000,
//pingInterval: 60000,

var app = require('express')();
var http = require('http').Server(app)

var io = require('socket.io')(http,options);

var TestDevice = require('./TestDevice');
var PerfTestFramework = require('./PerfTestFramework');
var UnitTestFramework = require('./UnitTestFramework');
var devicesObject = JSON.parse(process.argv[2]);

// This is the time to wait for devices to connect in case honor count is
// not set to true. This is especially designed for the CI environment where
// it might take a significant amount of time to deploy to all devices
// but in the end, the deployment to all might not always work and thus
// it is beneficial to be able to anyways do the test run with the amount
// of devices that were able to connect.
var timeOutValueToStart = 300000; // 5 minutes

var TestsFrameworks  = {};
TestsFrameworks.perftest =  {};
TestsFrameworks.perftest.android = new PerfTestFramework("Android",devicesObject.devices.android,devicesObject.honorCount);
TestsFrameworks.perftest.ios     = new PerfTestFramework("iOs",devicesObject.devices.ios,devicesObject.honorCount);
TestsFrameworks.unittest =  {};
TestsFrameworks.unittest.android = new UnitTestFramework("Android");
TestsFrameworks.unittest.ios     = new UnitTestFramework("iOs");

var weHaveStartedTesting = false;
var startTimerId = null;
if (!devicesObject.honorCount) {
  startTimerId = setTimeout(function () {
    console.log("-------------- We got wait done, now starting the testing process ------------------");
    weHaveStartedTesting = true;

    var perfAndCount = TestsFrameworks.perftest.android.getCount();
    var perfIosCount = TestsFrameworks.perftest.ios.getCount();
    var unitAndCount = TestsFrameworks.unittest.android.getCount();
    var unitIosCount = TestsFrameworks.unittest.ios.getCount();

    TestsFrameworks['perftest']['android'].startTest({"devices":{"ios":perfIosCount,"android":perfAndCount}});
    TestsFrameworks['perftest']['ios'].startTest({"devices":{"ios":perfIosCount,"android":perfAndCount}});
    TestsFrameworks['unittest']['android'].startTest({"devices":{"ios":unitIosCount,"android":unitAndCount}});
    TestsFrameworks['unittest']['ios'].startTest({"devices":{"ios":unitIosCount,"android":unitAndCount}});

  }, timeOutValueToStart);
}

io.on('connection', function (socket) {
  socket.on('present', function (msg) {
    var presentObj = JSON.parse(msg);
    if (!presentObj.os || !presentObj.name || !presentObj.type) {
      console.log("malformed message");
      socket.emit('error', JSON.stringify({"errorDescription ": "malformed message"}));
      return;
    }

    if (weHaveStartedTesting) {
      var isThisTestFromAddedDevice = false;
      // each file will do its own present with different name
      //  and we need to register the names, so we can determine which tests are actually included
      // thus we need to check whether we would need to let these present pass, even though we have started
      // there is one connection, i.e. one socket for each device, so we use that to determine what to do
      if (presentObj.type == "unittest") {
        if (devicesObject.honorCount) {
          isThisTestFromAddedDevice = TestsFrameworks['unittest'][presentObj.os].isSocketAlreadyCounted(socket);
        }
      } else { //perf test
        isThisTestFromAddedDevice = TestsFrameworks['perftest'][presentObj.os].isDeviceAlreadyAdded(presentObj.name);
      }

      if (!isThisTestFromAddedDevice) {
        console.log("too late arrival");
        socket.emit('too_late', JSON.stringify({"timeout ": "malformed message"}));
        return;
      }
    }

    var newDevice = new TestDevice(socket, presentObj.name, presentObj.os, presentObj.type, presentObj.btaddress);
    TestsFrameworks[presentObj.type][presentObj.os].addDevice(newDevice, socket);

    // implemented by both unit & performance tests
    if (devicesObject.honorCount && !weHaveStartedTesting) {

      var androidCount = TestsFrameworks[presentObj.type]['android'].getCount();
      var iosCount = TestsFrameworks[presentObj.type]['ios'].getCount();

      if (devicesObject.devices.android <= androidCount
          && devicesObject.devices.ios <= iosCount) {
        weHaveStartedTesting = true;
        TestsFrameworks[presentObj.type]['android'].startTest({"devices": {"ios": iosCount, "android": androidCount}});
        TestsFrameworks[presentObj.type]['ios'].startTest({"devices": {"ios": iosCount, "android": androidCount}});
      }
    }

    // implemented by both unit & performance tests
    socket.on('disconnect', function () {
      if (!weHaveStartedTesting) {
        socket.emit('test_error', JSON.stringify({"timeout ": "message not acceptable in current Test Server state"}));
        return;
      }
      TestsFrameworks[presentObj.type][presentObj.os].removeDevice(newDevice);
    });

    //this event only happens with unit tests, presentObj.type == unittest
    socket.on('setup_unit_test', function (msg) {
      var msgData = JSON.parse(msg);
      if (msgData.name == newDevice.getName()) {
        TestsFrameworks[presentObj.type][presentObj.os].addTest(newDevice, msgData.test);
      }
    });

    //this event only happens with unit tests, presentObj.type == unittest
    socket.on('unit_test_done', function (msg) {
      if (!weHaveStartedTesting) {
        socket.emit('test_error', JSON.stringify({"timeout ": "message not acceptable in current Test Server state"}));
        return;
      }

      var msgData = JSON.parse(msg);
      if (msgData.name == newDevice.getName()) {
        TestsFrameworks[presentObj.type][presentObj.os].ClientStopEventReceived(msgData.name, msgData.test);
      }
    });

    //this event only happens with performance tests, presentObj.type == perftest
    socket.on('test data', function (data) {
      if (!weHaveStartedTesting) {
        socket.emit('test_error', JSON.stringify({"timeout ": "message not acceptable in current Test Server state"}));
        return;
      }
      TestsFrameworks[presentObj.type][presentObj.os].ClientDataReceived(newDevice.getName(), data);
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

