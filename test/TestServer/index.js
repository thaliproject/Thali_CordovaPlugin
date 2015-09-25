/*
Main entry point for Thali test frameworks coordinator server
 */
var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);


var TestDevice = require('./IPAddressToFile');
var TestDevice = require('./TestDevice');
var PerfTestFramework = require('./PerfTestFramework');
var UnitTestFramework = require('./UnitTestFramework');


/* // we might need to add this later
process.argv.forEach(function (val, index, array) {
  console.log("arguments : " + index + ': ' + val);
});
*/
app.get('/', function(req, res){
  console.log("HTTP get called");
  res.sendfile('index.html');
});

var perfTests = new PerfTestFramework();
var unitTests = new UnitTestFramework();


io.on('connection', function(socket) {
  console.log("got connection");

  socket.on('start_performance_testing', function(msg){
    var newDevice = new TestDevice(this,msg);
    perfTests.addDevice(newDevice);

    this.on('disconnect', function () {
      perfTests.removeDevice(newDevice.getName());
    });

    this.on('test data', function (data) {
      perfTests.ClientDataReceived(newDevice.getName(),data)
    });
  });

  socket.on('start_unit_testing', function(msg){
    var devName = JSON.parse(msg).name;
    var unitTestDevice = new TestDevice(this,devName);

    this.on('setup_unit_test', function (msg) {
      var msgData = JSON.parse(msg);
      if(msgData.name == unitTestDevice.getName()) {
        unitTests.addDevice(unitTestDevice, msgData.test);
      }
    });

    this.on('disconnect', function () {
      unitTests.removeDevice(unitTestDevice);
    });

    this.on('unit_test_done', function (msg) {
      var msgData = JSON.parse(msg);
      if(msgData.name == unitTestDevice.getName()) {
        unitTests.ClientStopEventReceived(msgData.name, msgData.test)
      }
    });
  });
});


http.listen(3000, function(){
  console.log('listening on *:3000');
});