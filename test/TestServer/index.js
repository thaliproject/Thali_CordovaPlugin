var app = require('express')();
var http = require('http').Server(app);
var io = require('socket.io')(http);


var TestDevice = require('./IPAddressToFile');
var TestDevice = require('./TestDevice');
var TestFramework = require('./TestFramework');


app.get('/', function(req, res){
  console.log("HTTP get called");
  res.sendfile('index.html');
});

var TestFramework = new TestFramework();

io.on('connection', function(socket) {
  console.log("got connection");

  socket.on('identify device', function(msg){
    var newDevice = new TestDevice(this,msg);
    TestFramework.addDevice(newDevice);

    this.on('disconnect', function () {
      TestFramework.removeDevice(newDevice.getName());
    });

    this.on('test data', function (data) {
      TestFramework.ClientDataReceived(newDevice.getName(),data)
    });
  });
});


http.listen(3000, function(){
  console.log('listening on *:3000');
});