var test = require('tape');
var ThaliEmitter = require('../thali/thaliemitter');
var express = require('express');

var app = express();
app.disable('x-powered-by');

app.listen(9001, function () {
  console.log('Listening on port 9001');
});

test('ThaliEmitter can call startBroadcasting and endBroadcasting without error', { timeout: 5000 }, function (t) {
  var e = new ThaliEmitter();

  t.plan(2);

  e.startBroadcasting(String(Date.now), 9001, function (err1) {
    t.err(err1);

    e.stopBroadcasting(function (err2) {
      t.err(err2);
    });
  });
});

test('ThaliEmitter can call startBroadcasting and endBroadcasting without error', { timeout: 5000 }, function (t) {
  var e = new ThaliEmitter();

  t.plan(1);

  e.stopBroadcasting(function (err) {
    t.assert(err, err.message);
  });

});

test('ThaliEmitter calls startBroadcasting twice with error', { timeout: 5000 }, function (t) {
  var e = new ThaliEmitter();

  t.plan(3);

  e.startBroadcasting(String(Date.now), 9001, function (err1) {
    t.err(err1);

    e.startBroadcasting(String(Date.now), 9001, function (err2) {

      t.assert(!!err2, err2.message);

      e.stopBroadcasting(function (err3) {
        t.err(err2);
      });
    });
  });
});

test('ThaliEmitter throws on connection to bad peer', { timeout: 5000 }, function (t) {
  var e = new ThaliEmitter();

  t.plan(3);

  e.startBroadcasting(String(Date.now), 9001, function (err1) {
    t.err(err1);

    e.connect('foobar', function (err2, port) {
      t.assert(!!err2, err2.message);

      e.stopBroadcasting(function (err3) {
        t.err(err3);
      });
    });
  });
});

test('ThaliEmitter throws on disconnect to bad peer', { timeout: 5000 }, function (t) {
  var e = new ThaliEmitter();

  t.plan(3);

  e.startBroadcasting(String(Date.now), 9001, function (err1) {
    t.err(err1);

    e.disconnect('foobar', function (err2, port) {
      t.assert(err2, err2.message);

      e.stopBroadcasting(function (err3) {
        t.err(err3);
      });
    });
  });
});
