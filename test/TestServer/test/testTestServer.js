var test = require('tape');
var uuid = require('node-uuid');
var io = require('socket.io-client');
var spawn = require('child_process').spawn;

test("test server - starts and stops", function(t) {
  var server = spawn('node', ['./index.js', '{"devices":{"ios":4}}']); 
  server.stderr.on('data', function(data) {
    t.fail("Should be no error output");
    console.log(new Buffer(data, 'utf8').toString()); 
  });
  server.stdout.on('data', function(data) {
    // Uncomment for debug of server
    console.log(new Buffer(data, 'utf8').toString()); 
    server.kill('SIGINT');
  });
  server.on('exit', function(code, signal) {
    t.equal(code, 130, "SIGINT handler should have terminated server");
    t.end();
  });
});

function startServer(t, testConfig) {

  if (!testConfig) {
    testConfig = "./TestPerfTestConfig.js";
  }

  var server = spawn(
    'node', 
    ['./index.js', '{"devices":{"ios":4, "android":4}, "configFile":"' + testConfig + '"}']
  );

  server.stderr.on('data', function(data) {
    t.fail("Should be no error output");
    console.log(new Buffer(data, 'utf8').toString()); 
  });
  server.stdout.on('data', function(data) {
    // Uncomment for debug of server
    console.log(new Buffer(data, 'utf8').toString()); 
  });
  server.on('exit', function(code, signal) {
    t.equal(code, 0, "Server should have terminated gracefully");
    t.end();
  });

  return server;
}

function presentDevice(client, name, uuid, os, type, tests) {
  client.emit('present', JSON.stringify({
    "os" : os,
    "name": name,
    "type": type,
    "tests": tests,
    "uuid": uuid
  }));
}

function shuffle(array) 
{
  var currentIndex = array.length, temporaryValue, randomIndex ;

  // While there remain elements to shuffle...
  while (0 !== currentIndex) {

    // Pick a remaining element...
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex -= 1;

    // And swap it with the current element.
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }

  return array;
}

test("test server - perf test framework", function(t) {

  var server = startServer(t);
 
  var numDevices = 4;
  var numStarts = 0;
  var numEnds = 0;

  var clients = [];
  for (var i = 0; i < numDevices; i++) {

    var client = io('http://127.0.0.1:3000/',
      { transports:['websocket'], 'force new connection': true } 
    );
 
    client.deviceName = clients.length;
    client.uuid = uuid.v4();
    clients.push(client);
 
    client.on('error', function() {
      t.fail();
    });

    client.on('connect', function () {

      this.on('start', function() {
        numStarts++;
        t.ok(numStarts <= numDevices, "Shouldn't get more starts than devices");
        if (numStarts == numDevices) {
          clients = shuffle(clients);
          clients.forEach(function(c) {
            c.emit('test data', JSON.stringify({
              "name:": "dev" + c.deviceName,
              "time": 0,
              "result": "ok",
              "sendList": []
            }));
          });
        }
      });

      this.on('end', function(data) {
        t.equal(numStarts, numDevices, "Shouldn't get events out of order");
        numEnds++;
        t.ok(numEnds <= numDevices, "Shouldn't get more ends than devices");
        // Cancel auto reconnect
        this.io.reconnection(false);
        this.emit("end_ack");
      });

      presentDevice(
        this,
        "dev" + this.deviceName,
        this.uuid,
        "ios", 
        "perftest", ["testSendData.js"]
      );
    });
  }
});

test("test server - perf test start timeout", function(t) {

  var server = startServer(t);
 
  var numDevices = 4;
  var numStarts = 0;
  var numEnds = 0;
  var numPresents = 0;

  var clients = [];
  for (var i = 0; i < numDevices; i++) {

    var client = io('http://127.0.0.1:3000/',
      { transports:['websocket'], 'force new connection': true } 
    );

    client.deviceName = clients.length; 
    client.uuid = uuid.v4();
    clients.push(client);

    client.on('error', function() {
      t.fail();
    });

    client.on('connect', function () {

      this.on('start', function() {
        numStarts++;
        t.ok(numStarts <= numDevices - 1, "Shouldn't get more starts than devices");
        if (numStarts == numDevices - 1) {
          clients = shuffle(clients);
          clients.forEach(function(c) {           
            c.emit('test data', JSON.stringify({
              "name:": "dev" + c.deviceName,
              "time": 0,
              "result": "ok",
              "sendList": []
            }));
          });
        }
      });

      this.on('end', function(data) {
        t.equal(numStarts, numDevices - 1, "Shouldn't get events out of order");
        numEnds++;
        t.ok(numEnds <= numDevices - 1, "Shouldn't get more ends than devices");
        this.io.reconnection(false);
        this.emit("end_ack");
        if (numEnds == numDevices - 1) {
          // There'll be one socket still hanging around
          clients.forEach(function(c) {
            c.disconnect();
          });
        }
      });

      if (numPresents++ < numDevices - 1) {
        // Present one less device than required
        presentDevice(
          this,
          "dev" + this.deviceName,
          this.uuid,
          "ios", 
          "perftest", ["testSendData.js"]
        );
      }  
    });
  }
});

test("test server - concurrent perf test runs", function(t) {

  var server = startServer(t);
 
  var numDevices = 8;
  var numStarts = 0;
  var numEnds = 0;

  var clients = [];
  for (var i = 0; i < numDevices; i++) {

    var client = io('http://127.0.0.1:3000/',
      { transports:['websocket'], 'force new connection': true } 
    );

    client.deviceName = clients.length; 
    client.uuid = uuid.v4();
    clients.push(client);

    client.on('error', function() {
      t.fail();
    });

    client.on('connect', function () {

      this.on('start', function() {
        numStarts++;
        t.ok(numStarts <= numDevices, "Shouldn't get more starts than devices");
        if (numStarts == numDevices) {
          clients = shuffle(clients);
          clients.forEach(function(c) {           
            c.emit('test data', JSON.stringify({
              "name:": "dev" + c.deviceName,
              "time": 0,
              "result": "ok",
              "sendList": []
            }));
          });
        }
      });

      this.on('end', function(data) {
        t.equal(numStarts, numDevices, "Shouldn't get events out of order");
        numEnds++;
        t.ok(numEnds <= numDevices, "Shouldn't get more ends than devices");
        this.io.reconnection(false);
        this.emit("end_ack");
      });

      presentDevice(
        this,
        "dev" + this.deviceName,
        this.uuid,
        this.deviceName % 2 == 0 ? "ios" : "android", 
        "perftest", ["testSendData.js"]
      );
    });
  }
});

test("test server - perf test framework handles disconnects", function(t) {

  var server = startServer(t);
 
  var numDevices = 4;
  var numStarts = 0;
  var numEnds = 0;

  var clients = [];
  for (var i = 0; i < numDevices; i++) {

    var client = io('http://127.0.0.1:3000/',
      { transports:['websocket'], 'force new connection': true } 
    );
 
    client.deviceName = clients.length;
    client.uuid = uuid.v4();
    clients.push(client);
 
    client.on('error', function() {
      t.fail();
    });

    client.on('connect', function () {

      this.removeAllListeners('start');
      this.on('start', function() {
        numStarts++;
        t.ok(numStarts <= numDevices, "Shouldn't get more starts than devices");
        if (numStarts == numDevices) {
          clients = shuffle(clients);
          console.log("disconnecting %s", clients[0].deviceName);
          clients[0].disconnect();
          clients[0].connect();
          clients.forEach(function(c) {
            c.emit('test data', JSON.stringify({
              "name:": "dev" + c.deviceName,
              "time": 0,
              "result": "ok",
              "sendList": []
            }));
          });
        }
      });

      // Disconnected client will come through here twice, don't add
      // multiple listeners
      this.removeAllListeners('end');
      this.on('end', function(data) {
        t.equal(numStarts, numDevices, "Shouldn't get events out of order");
        numEnds++;
        t.ok(numEnds <= numDevices, "Shouldn't get more ends than devices");
        this.io.reconnection(false);
        this.emit("end_ack");
      });

      presentDevice(
        this,
        "dev" + this.deviceName,
        this.uuid,
        "ios", 
        "perftest", ["testSendData.js"]
      );
    });
  }
});

test("test server - perf test framework handles server timeout", function(t) {

  var time = 0;
  var server = startServer(t, "./TestPerfTestConfig2.js");

  var numTests = 0; 
  var numDevices = 4;
  var numStarts = 0;
  var numEnds = 0;

  var clients = [];
  for (var i = 0; i < numDevices; i++) {

    var client = io('http://127.0.0.1:3000/',
      { transports:['websocket'], 'force new connection': true } 
    );
 
    client.deviceName = clients.length;
    client.uuid = uuid.v4();
    clients.push(client);
 
    client.on('error', function() {
      t.fail();
    });

    client.on('connect', function () {

      this.removeAllListeners('start');
      this.on('start', function() {
        numStarts++;
        t.ok(numStarts <= numDevices, "Shouldn't get more starts than devices");
        if (numStarts == numDevices) {
          clients = shuffle(clients);
          var numTestData = 0;
          clients.forEach(function(c) {
            numTestData++;
            // Send all but one test data reports the first time
            if (numTestData < numDevices || numTests == 1) {
              c.emit('test data', JSON.stringify({
                "device:": "dev" + c.deviceName,
                "test": "test" + numTests,
                "time": time++,
                "result": "ok",
                "sendList": []
              }));
            } else {
              // Convenient place to reset counters
              numStarts = 0;
              numTestData = 0;
              numTests++;
            }
          });
        }
      });

      this.on('timeout', function(data) {
      });

      this.on('end', function(data) {
        t.equal(numStarts, numDevices, "Shouldn't get events out of order");
        numEnds++;
        t.ok(numEnds <= numDevices, "Shouldn't get more ends than devices");
        this.io.reconnection(false);
        this.emit("end_ack");
      });

      // Note that we're sending two tests here.. 
      presentDevice(
        this,
        "dev" + this.deviceName,
        this.uuid,
        "ios", 
        "perftest", ["testSendData.js", "testFindPeers.js"]
      );
    });
  }
});

