'use strict';

var tcpmultiplex = require('./thali/tcpmultiplex');
var test = require('tape');
var net = require('net');
var randomstring = require('randomstring');

test('serverMuxBridge can mux data', function (t) {
  var len = 200;
  var testMessage = randomstring.generate(len);

  var server = net.createServer(function (socket) {
    socket.pipe(socket);
  });

  server.listen(5001, function () {
    var muxServerBridge = tcpmultiplex.muxServerBridge(5001);
    muxServerBridge.listen(5000, function () {

      var clientSocket = net.createConnection( { port: 5001 }, function () {
        clientSocket.write(Buffer(testMessage));
      });

      clientSocket.on('data', function (data) {
        t.equal(testMessage, data.toString(), 'Should send ' + testMessage.length + ' characters');
        t.end();

        muxServerBridge.close();
        server.close();
      });
    });
  });
});

test('clientMuxBridge can mux data', function (t) {
  var len = 200;
  var testMessage = randomstring.generate(len);

  var server = net.createServer(function (socket) {
    socket.pipe(socket);
  });

  server.listen(5001, function () {
    var muxClientBridge = tcpmultiplex.muxClientBridge(5001);
    muxClientBridge.listen(5000, function () {

      var clientSocket = net.createConnection( { port: 5001 }, function () {
        clientSocket.write(Buffer(testMessage));
      });

      clientSocket.on('data', function (data) {
        t.equal(testMessage, data.toString(), 'Should send ' + testMessage.length + ' characters');
        t.end();

        muxClientBridge.close();
        server.close();
      });
    });
  });
});
