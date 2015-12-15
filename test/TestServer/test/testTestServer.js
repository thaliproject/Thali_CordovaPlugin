var test = require('tape');
var io = require('socket.io-client');
var spawn = require('child_process').spawn;

test("test server starts and stops", function(t) {
  var server = spawn('node', ['./index.js', '{"devices":{"ios":4}}']); 
  server.stderr.on('data', function(data) {
    t.fail("Should be no error output");
  });
  server.stdout.on('data', function(data) {
    console.log(new Buffer(data, 'utf8').toString()); 
    server.kill('SIGINT');
  });
  server.on('exit', function(code, signal) {
    t.equal(code, 130);
    t.end();
  });
});

function startServer(t) {

  var server = spawn('node', ['./index.js', '{"devices":{"ios":4}}']); 
  server.stderr.on('data', function(data) {
    t.fail("Should be no error output");
    console.log(new Buffer(data, 'utf8').toString()); 
  });
  server.stdout.on('data', function(data) {
    console.log(new Buffer(data, 'utf8').toString()); 
  });
  server.on('exit', function(code, signal) {
    console.log("Server exited");
    t.equal(code, 130);
    t.end();
  });

  return server;
}

function presentDevice(client, name, os, type, tests) {
  client.emit('present', JSON.stringify({
    "os" : os,
    "name": name,
    "type": type,
    "tests": tests
  }));
}

test("test perf test framework", function(t) {

  var server = startServer(t);
  var client = io('http://127.0.0.1:3000/',{ transports:['websocket'] });
 
  client.on('error', function() {
    console.log("Emitting");
    t.fail();
  });

  var numDevices = 4;

  var numStarts = 0;
  var numEnds = 0;
  client.on('connect', function () {

    client.on('start', function() {
      numStarts++;
      t.ok(numStarts <= numDevices, "Shouldn't get more starts than devices");
      if (numStarts == numDevices) {
        // We're taking advantage of the fact that this will emit
        // the event numDevices times on the server.. 
        client.emit('test data', JSON.stringify({
          "name:": "",
          "time": 0,
          "result": "ok",
          "sendList": []
        }));
      }
    });

    client.on('end', function() {
      t.equal(numStarts, numDevices, "Shouldn't get events out of order");
      numEnds++;
      t.ok(numEnds <= numDevices, "Shouldn't get more ends than devices");
      if (numEnds == numDevices) {
        client.close();
        server.kill('SIGINT');
      }
    });

    for (var i = 0; i < numDevices; i++) {
      presentDevice(client, "dev" + i, "ios", "perftest", ["testSendData.js"]);
    }
  });
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
 
    clients.push(client);
 
    client.on('error', function() {
      t.fail();
    });

    client.on('connect', function () {

      this.on('start', function() {
        numStarts++;
        t.ok(numStarts <= numDevices - 1, "Shouldn't get more starts than devices");
        if (numStarts == numDevices - 1) {
          this.emit('test data', JSON.stringify({
            "name:": "",
            "time": 0,
            "result": "ok",
            "sendList": []
          }));
        }
      });

      this.on('end', function(data) {
        t.equal(numStarts, numDevices - 1, "Shouldn't get events out of order");
        numEnds++;
        t.ok(numEnds <= numDevices - 1, "Shouldn't get more ends than devices");
        if (numEnds == numDevices - 1) {
          clients.forEach(function(client) {
            client.close();
          });
          server.kill('SIGINT');
        }
      });

      if (numPresents < numDevices - 1) {
        // Deliberately present less devices than expected to force a timeout start
        presentDevice(client, "dev" + numPresents++, "ios", "perftest", ["testSendData.js"]);
      }
    });
  }
});
