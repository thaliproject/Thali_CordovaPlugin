var test = require('tape');
var ThaliEmitter = require('../thali/thaliemitter');

var express = require('express');

test('ThaliEmitter can call startBroadcasting and endBroadcasting without error', function (t) {
  var e = new ThaliEmitter();

  console.log('about to call startBroadcasting');
  e.startBroadcasting((+ new Date()).toString(), 5000, function (err1) {
    t.notOk(err1);

    console.log('about to call stop broadcasting');
    e.stopBroadcasting(function (err2) {
      t.notOk(err2);
      t.end();
    });
  });
});

test('ThaliEmitter can call startBroadcasting and endBroadcasting without error', function (t) {
  var e = new ThaliEmitter();

  e.stopBroadcasting(function (err) {
    t.assert(err, err.message);
    t.end();
  });

});

test('ThaliEmitter calls startBroadcasting twice with error', function (t) {
  var e = new ThaliEmitter();

  e.startBroadcasting((+ new Date()).toString(), 5000, function (err1) {
    t.notOk(err1);

    e.startBroadcasting((+ new Date()).toString(), 5000, function (err2) {

      t.assert(!!err2, err2.message);

      e.stopBroadcasting(function (err3) {
        t.notOk(err3);
        t.end();
      });
    });
  });
});

test('ThaliEmitter throws on connection to bad peer', function (t) {
  var e = new ThaliEmitter();

  e.startBroadcasting((+ new Date()).toString(), 5000, function (err1) {
    t.notOk(err1);

    e.connect('foobar', function (err2, port) {
      t.assert(!!err2, err2.message);

      e.stopBroadcasting(function (err3) {
        t.notOk(err3);
        t.end();
      });
    });
  });
});

test('ThaliEmitter throws on disconnect to bad peer', function (t) {
  var e = new ThaliEmitter();

  e.startBroadcasting((+ new Date()).toString(), 5000, function (err1) {
    t.notOk(err1);

    e.disconnect('foobar', function (err2, port) {
      t.assert(err2, err2.message);

      e.stopBroadcasting(function (err3) {
        t.notOk(err3);
        t.end();
      });
    });
  });
});
