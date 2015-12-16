var test = require('tape');
var uuid = require('node-uuid');
var io = require('socket.io-client');
var spawn = require('child_process').spawn;

test("test server starts and stops", function(t) {
  var server = spawn('node', ['./index.js', '{"devices":{"ios":4}}']); 
  server.stderr.on('data', function(data) {
    t.fail("Should be no error output");
  });
  server.stdout.on('data', function(data) {
    // Uncomment for debug of server
    //console.log(new Buffer(data, 'utf8').toString()); 
    server.kill('SIGINT');
  });
  server.on('exit', function(code, signal) {
    t.equal(code, 130);
    t.end();
  });
});

function startServer(t) {

  var server = spawn(
    'node', 
    ['./index.js', '{"devices":{"ios":4, "android":4}, "configFile":"./TestPerfTestConfig"}']
  );

  server.stderr.on('data', function(data) {
    t.fail("Should be no error output");
    console.log(new Buffer(data, 'utf8').toString()); 
  });
  server.stdout.on('data', function(data) {
    // Uncomment for debug of server
    //console.log(new Buffer(data, 'utf8').toString()); 
  });
  server.on('exit', function(code, signal) {
    t.equal(code, 130);
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


test("test perf test framework", function(t) {

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
        if (numEnds == numDevices) {
          setTimeout(function() {
            // Delay quit slightly to check we don't get stray messages
            clients.forEach(function(client) {
              client.close();
            });
            server.kill('SIGINT');
          }, 3000);
        }
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

test("test perf test start timeout", function(t) {

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
        if (numEnds == numDevices - 1) {
          setTimeout(function() {
            // Delay quit slightly to check we don't get stray messages
            clients.forEach(function(client) {
              client.close();
            });
            server.kill('SIGINT');
          }, 3000);
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

test("test concurrent perf test runs", function(t) {

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
        if (numEnds == numDevices) {
          setTimeout(function() {
            // Delay quit slightly to check we don't get stray messages
            clients.forEach(function(client) {
              client.close();
            });
            server.kill('SIGINT');
          }, 3000);
        }
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
