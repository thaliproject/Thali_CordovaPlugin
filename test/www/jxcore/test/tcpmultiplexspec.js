'use strict';

var tcpmultiplex = require('../thali/tcpmultiplex');
var test = require('tape');
var net = require('net');

test('serverMuxBridge can mux data', function (t) {
  var server = net.createServer(function (socket) {
    socket.pipe(socket);
  });

  server.listen(5001, function () {
    var muxServerBridge = tcpmultiplex.muxServerBridge(5001);
    muxServerBridge.listen(5000, function () {

      var clientSocket = net.createConnection( { port: 5001 }, function () {
        clientSocket.write(Buffer('hello'));
        clientSocket.write(Buffer('world'));
      });

      clientSocket.on('data', function (data) {
        muxServerBridge.close();
        server.close();

        t.equal('helloworld', data.toString(), 'Should send helloworld');
        t.end();
      });
    });
  });
});

test('serverMuxBridge can handle errors', function (t) {
  var server = net.createServer(function (socket) {
    socket.destroy(new Error('woops'));
  });

  server.listen(5001, function () {
    var muxServerBridge = tcpmultiplex.muxServerBridge(5001);
    muxServerBridge.listen(5000, function () {

      server.on('error', function (err) {
        muxServerBridge.close();
        t.ok(err, 'Server closed should throw with error ' + err);
        t.end();
      });

      var clientSocket = net.createConnection( { port: 5001 }, function () {
        clientSocket.write(Buffer('hello'));
        clientSocket.write(Buffer('world'));
      });

      clientSocket.on('error', function (err) {
        muxServerBridge.close();
        t.ok(err, 'Server closed should throw with error ' + err);
        t.end();
      });
    });
  });
});
