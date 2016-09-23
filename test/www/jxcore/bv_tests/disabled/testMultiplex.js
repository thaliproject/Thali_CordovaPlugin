'use strict';

var tcpmultiplex = require('thali/tcpmultiplex');
var tape = require('../../lib/thaliTape');
var net = require('net');
var randomstring = require('randomstring');
var multiplex = require('multiplex');

var test = tape({
  setup: function(t) {
    t.end();
  },
  teardown: function(t) {
    t.end();
  }
});

test('multiplex can send data', function (t) {
  var len = 200;
  var testMessage = randomstring.generate(len);

  var server = net.createServer(function (socket) {
    var plex1 = multiplex(function (stream) {
      stream.on('data', function (data) {
        t.equal(testMessage, String(data), 'String should be length:' + testMessage.length);
        t.end();

        socket.destroy();
        server.close();
      });
    });

    socket.pipe(plex1).pipe(socket);
  });

  server.listen(0, function () {
    var serverPort = server.address().port;
    var socket = net.createConnection({port: serverPort}, function () {
      var plex2 = multiplex();
      var stream = plex2.createStream();
      stream.write(new Buffer(testMessage));

      plex2.pipe(socket).pipe(plex2);
    });
  });
});
/*
test('muxServerBridge', function (t) {
  var len = 200;
  var testMessage = randomstring.generate(len);

  var testServer = net.createServer(function (socket) {
    socket.pipe(socket);
  });

  testServer.listen(0, function () {
    var testServerPort = testServer.address().port;
    var muxServerBridge = tcpmultiplex.muxServerBridge(testServerPort);
    muxServerBridge.listen(function () {
      var serverPort = muxServerBridge.address().port;

      var muxClientBridge = tcpmultiplex.muxClientBridge(serverPort, function (err) {

        muxClientBridge.listen(function () {
          var clientPort = muxClientBridge.address().port;

          var socket = net.createConnection({port: clientPort}, function () {
            socket.end(new Buffer(testMessage));
          });

          socket.on('data', function (data) {
            t.equal(testMessage, String(data), 'String should be length:' + testMessage.length);
            t.end();

            muxClientBridge.on('close', function () {
              console.log('closed');
            });

            muxClientBridge.close();
            muxServerBridge.close();
            server.close();
          });
        });
      });
    });
  });
});
*/
