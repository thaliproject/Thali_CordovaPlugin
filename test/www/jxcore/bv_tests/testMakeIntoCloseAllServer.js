'use strict';

var net = require('net');
var tape = require('../lib/thali-tape');
var makeIntoCloseAllServer = require('thali/NextGeneration/makeIntoCloseAllServer');

var test = tape({
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    t.end();
  }
});

test('closeAll can close even when connections open', function (t) {
  var testServer = net.createServer(function (socket) {
    socket.pipe(socket);
  });
  testServer = makeIntoCloseAllServer(testServer);
  testServer.listen(0, function () {
    var testServerPort = testServer.address().port;
    var connection = net.connect(testServerPort, function () {
      testServer.closeAll(function () {
        connection = net.connect(testServerPort, function () {
          t.fail('connection should not succeed');
          t.end();
        });
        connection.on('error', function (error) {
          t.equals(error.code, 'ECONNREFUSED',
            'not possible to connect to the server anymore');
          t.end();
        });
      });
    });
    connection.on('error', function (error) {
      t.equals(error.code, 'ECONNRESET',
        'expect a specific error when the connection is closed');
    });
  });
});

test('closeAll with promise', function (t) {
  var testServer = net.createServer(function (socket) {
    socket.pipe(socket);
  });
  testServer = makeIntoCloseAllServer(testServer);
  testServer.listen(0, function () {
    var testServerPort = testServer.address().port;
    var connection = net.connect(testServerPort, function () {
      testServer.closeAllPromise()
        .then(function () {
          connection = net.connect(testServerPort, function () {
            t.fail('connection should not succeed');
            t.end();
          });
          connection.on('error', function (error) {
            t.equals(error.code, 'ECONNREFUSED',
              'not possible to connect to the server anymore');
            t.end();
          });
        }).catch(function (err) {
        t.fail(err);
        t.end();
      });
    });
    connection.on('error', function (error) {
      t.equals(error.code, 'ECONNRESET',
        'expect a specific error when the connection is closed');
    });
  });
});

test('closeAll properly throws when closing a non open server with ' +
  'eatNotRunning set to false', function (t) {
  var testServer = net.createServer(function () {

  });
  testServer = makeIntoCloseAllServer(testServer);
  testServer.closeAllPromise()
    .then(function () {
      t.fail('we should have gotten an error');
      t.end();
    })
    .catch(function (err) {
      t.ok(err instanceof Error && err.message === 'Not running',
        'Got the right error');
      t.end();
    })
});

test('closeAll works even with a server that is not listening yet with' +
  'eatNotRunning set to true',
  function (t) {
    var testServer = net.createServer(function () {

    });
    testServer = makeIntoCloseAllServer(testServer, true);
    testServer.closeAllPromise()
      .then(function () {
        t.end();
      })
      .catch(function (err) {
        t.fail(err);
        t.end();
      });
  });
