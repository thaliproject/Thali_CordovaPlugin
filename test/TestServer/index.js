/*
 Main entry point for Thali test frameworks coordinator server

 jx index.js "{\"devices\":{\"android\":\"3\",\"ios\":\"2\"}}//
 */


var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);

//var IPAddressToFile = require('./IPAddressToFile');
//IPAddressToFile();

var TestDevice = require('./TestDevice');
var PerfTestFramework = require('./PerfTestFramework');
var UnitTestFramework = require('./UnitTestFramework');
var devicesObject = JSON.parse(process.argv[2]); //

var timeOutValueToStart = 300000;// after 300 seconds of waiting we'll start even if we did not get desired amount of devices

var perfTestsAndroid = new PerfTestFramework("Android");
var perfTestsIOS     = new PerfTestFramework("iOs");
var unitTestsAndroid = new UnitTestFramework("Android");
var unitTestsIOS     = new UnitTestFramework("iOs");

var weHaveStartedTesting = false;
var startTimerId = null;
if (!devicesObject.honorCount) {
  startTimerId = setTimeout(function () {
    console.log("-------------- We got wait done, now starting the testing process ------------------");
    weHaveStartedTesting = true;

    perfTestsAndroid.startTest({"devices":{"ios":perfTestsIOS.getCount(),"android":perfTestsAndroid.getCount()}});
    perfTestsIOS.startTest({"devices":{"ios":perfTestsIOS.getCount(),"android":perfTestsAndroid.getCount()}});

    unitTestsAndroid.startTest({"devices":{"ios":unitTestsIOS.getCount(),"android":unitTestsAndroid.getCount()}});
    unitTestsIOS.startTest({"devices":{"ios":unitTestsIOS.getCount(),"android":unitTestsAndroid.getCount()}});

  }, timeOutValueToStart);
}

io.set('heartbeat interval', 1200); // Do heart beat every 10 minutes
io.on('connection', function(socket) {
  console.log("got connection ");

  socket.on('present', function(msg){
    var presentObj = JSON.parse(msg);
    if(!presentObj.os || !presentObj.name  || !presentObj.type ){
      console.log("malformed message");
      this.emit('error', JSON.stringify({"errorDescription ":"malformed message"}));
      return;
    }

    if(weHaveStartedTesting){
      console.log("too late arrival");
      this.emit('too_late', JSON.stringify({"timeout ":"malformed message"}));
      return;
    }

    var newDevice = new TestDevice(this,presentObj.name,presentObj.os);

    if(presentObj.type == "unittest"){

      if(newDevice.getPlatform() == 'android') {
        unitTestsAndroid.addDevice(newDevice);
      }else{
        unitTestsIOS.addDevice(newDevice);
      }

      //the app is running unit tests
      this.on('setup_unit_test', function (msg) {
        var msgData = JSON.parse(msg);
        if(msgData.name == newDevice.getName()) {
          if(newDevice.getPlatform() == 'android') {
            unitTestsAndroid.addTest(newDevice, msgData.test);
          }else{
            unitTestsIOS.addTest(newDevice, msgData.test);
          }
        }
      });

      this.on('disconnect', function () {
        if(!weHaveStartedTesting){
          this.emit('error', JSON.stringify({"timeout ":"message not acceptable in current Test Server state"}));
          return;
        }

        if(newDevice.getPlatform() == 'android') {
          unitTestsAndroid.removeDevice(newDevice);
        }else{
          unitTestsIOS.removeDevice(newDevice);
        }
      });

      this.on('unit_test_done', function (msg) {
        if(!weHaveStartedTesting){
          this.emit('error', JSON.stringify({"timeout ":"message not acceptable in current Test Server state"}));
          return;
        }

        var msgData = JSON.parse(msg);
        if(msgData.name == newDevice.getName()) {
          if(newDevice.getPlatform() == 'android') {
            unitTestsAndroid.ClientStopEventReceived(msgData.name, msgData.test)
          }else{
            unitTestsIOS.ClientStopEventReceived(msgData.name, msgData.test)
          }
        }
      });
    }else{
      //the app is running performance tests
      if(newDevice.getPlatform() == 'android') {
        perfTestsAndroid.addDevice(newDevice);
      }else{
        perfTestsIOS.addDevice(newDevice);
      }

      this.on('disconnect', function () {
        if(!weHaveStartedTesting){
          this.emit('error', JSON.stringify({"timeout ":"message not acceptable in current Test Server state"}));
          return;
        }
        if(newDevice.getPlatform() == 'android') {
          perfTestsAndroid.removeDevice(newDevice.getName());
        }else{
          perfTestsIOS.removeDevice(newDevice.getName());
        }
      });

      this.on('test data', function (data) {
        if(!weHaveStartedTesting){
          this.emit('error', JSON.stringify({"timeout ":"message not acceptable in current Test Server state"}));
          return;
        }
        if(newDevice.getPlatform() == 'android') {
          perfTestsAndroid.ClientDataReceived(newDevice.getName(),data)
        }else{
          perfTestsIOS.ClientDataReceived(newDevice.getName(),data)
        }
      });
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

