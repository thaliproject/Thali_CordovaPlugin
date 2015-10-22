/*
 Main entry point for Thali test frameworks coordinator server
 */

var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

//var TestDevice = require('./IPAddressToFile');

var TestDevice = require('./TestDevice');
var PerfTestFramework = require('./PerfTestFramework');
var UnitTestFramework = require('./UnitTestFramework');
var devicesObject = JSON.parse(process.argv[2]);

var perfTestsAndroid = new PerfTestFramework(devicesObject.devices.android,"Android");
var perfTestsIOS     = new PerfTestFramework(devicesObject.devices.ios,"iOs");
var unitTestsAndroid = new UnitTestFramework(devicesObject.devices.android,"Android");
var unitTestsIOS     = new UnitTestFramework(devicesObject.devices.ios,"iOs");

io.on('connection', function(socket) {
  console.log("got connection");

  socket.on('start_performance_testing', function(msg){

    var deviceObj = JSON.parse(msg);
    var newDevice = new TestDevice(this,deviceObj.name,deviceObj.os);

    if(newDevice.getPlatform() == 'android') {
      perfTestsAndroid.addDevice(newDevice);
    }else{
      perfTestsIOS.addDevice(newDevice);
    }

    this.on('disconnect', function () {

      if(newDevice.getPlatform() == 'android') {
        perfTestsAndroid.removeDevice(newDevice.getName());
      }else{
        perfTestsIOS.removeDevice(newDevice.getName());
      }
    });

    this.on('test data', function (data) {
      if(newDevice.getPlatform() == 'android') {
        perfTestsAndroid.ClientDataReceived(newDevice.getName(),data)
      }else{
        perfTestsIOS.ClientDataReceived(newDevice.getName(),data)
      }
    });
  });

  socket.on('start_unit_testing', function(msg){
    var deviceObj = JSON.parse(msg);
    var unitTestDevice = new TestDevice(this,deviceObj.name,deviceObj.os);

    this.on('setup_unit_test', function (msg) {
      var msgData = JSON.parse(msg);
      if(msgData.name == unitTestDevice.getName()) {
        if(unitTestDevice.getPlatform() == 'android') {
          unitTestsAndroid.addDevice(unitTestDevice, msgData.test);
        }else{
          unitTestsIOS.addDevice(unitTestDevice, msgData.test);
        }
      }
    });

    this.on('disconnect', function () {
      if(unitTestDevice.getPlatform() == 'android') {
        unitTestsAndroid.removeDevice(unitTestDevice);
      }else{
        unitTestsIOS.removeDevice(unitTestDevice);
      }
    });

    this.on('unit_test_done', function (msg) {
      var msgData = JSON.parse(msg);
      if(msgData.name == unitTestDevice.getName()) {
        if(unitTestDevice.getPlatform() == 'android') {
          unitTestsAndroid.ClientStopEventReceived(msgData.name, msgData.test)
        }else{
          unitTestsIOS.ClientStopEventReceived(msgData.name, msgData.test)
        }
      }
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

