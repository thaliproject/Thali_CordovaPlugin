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
