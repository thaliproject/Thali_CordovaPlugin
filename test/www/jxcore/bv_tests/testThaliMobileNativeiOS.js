'use strict';

// Issue #419
var ThaliMobile = require('thali/NextGeneration/thaliMobile');
var Platform = require('thali/NextGeneration/utils/platform');
var nodeUuid = require('node-uuid');
if (global.NETWORK_TYPE === ThaliMobile.networkTypes.WIFI ||
    !Platform.isIOS) {
  return;
}

var randomstring = require('randomstring');
var tape = require('../lib/thaliTape');

// jshint -W064

// A variable that can be used to store a server
// that will get closed in teardown.
var serverToBeClosed = null;

var test = tape({
  setup: function (t) {
    serverToBeClosed = {
      closeAll: function (callback) {
        callback();
      }
    };
    t.end();
  },
  teardown: function (t) {
    serverToBeClosed.closeAll(function () {
      Mobile('stopListeningForAdvertisements').callNative(function (err) {
        t.notOk(
          err,
          'Should be able to call stopListeningForAdvertisements in teardown'
        );
        Mobile('stopAdvertisingAndListening').callNative(function (err) {
          t.notOk(
            err,
            'Should be able to call stopAdvertisingAndListening in teardown'
          );
          t.end();
        });
      });
    });
  }
});

test('cannot call multiConnect when start listening for advertisements is ' +
  'not active', function (t) {
  var connectReturned = false;
  var syncValue = randomstring.generate();
  Mobile('multiConnectResolved').registerToNative(function (callback) {
    t.ok(connectReturned, 'Should only get called after multiConnect ' +
      'returned');
    t.equal(callback.syncValue, syncValue, 'SyncValue matches');
    t.equal(callback.error, 'startListeningForAdvertisements is not active',
      'Got right error');
    t.equal(callback.listeningPort, null, 'listeningPort is null');
    t.end();
  });
  Mobile('multiConnect').callNative('foo', syncValue, function (err) {
    t.equal(err, null, 'Got null as expected');
    connectReturned = true;
  });
});

test('cannot call multiConnect with illegal peerID', function (t) {
  var connectReturned = false;
  var syncValue = randomstring.generate();
  Mobile('multiConnectResolved').registerToNative(function (callback) {
    t.ok(connectReturned, 'Should only get called after multiConnect ' +
      'returned');
    t.equal(callback.syncValue, syncValue, 'SyncValue matches');
    t.equal(callback.error, 'Illegal peerID',
      'Got right error');
    t.equal(callback.listeningPort, null, 'listeningPort is null');
    t.end();
  });
  Mobile('startUpdateAdvertisingAndListening').callNative(4242,
    function (err) {
      t.equal(err, null, 'No error on starting');
      Mobile('multiConnect').callNative('foo', syncValue, function (err) {
        t.equal(err, null, 'Got null as expected');
        connectReturned = true;
      });
    });
});

test('multiConnect properly fails on legal but non-existent peerID',
  function (t) {
    var connectReturned = false;
    var syncValue = randomstring.generate();
    Mobile('multiConnectResolved').registerToNative(function (callback) {
      t.ok(connectReturned, 'Should only get called after multiConnect ' +
        'returned');
      t.equal(callback.syncValue, syncValue, 'SyncValue matches');
      t.equal(callback.error, 'Connection could not be established ',
        'Got right error');
      t.equal(callback.listeningPort, null, 'listeningPort is null');
      t.end();
    });
    Mobile('startUpdateAdvertisingAndListening').callNative(4242,
      function (err) {
        t.equal(err, null, 'No error on starting');
        var peerId = nodeUuid.v4() + ':' + 0;
        Mobile('multiConnect').callNative(peerId, syncValue, function (err) {
          t.equal(err, null, 'Got null as expected');
          connectReturned = true;
        });
      });
  });

test('disconnect doesn\'t fail on bad peer id', function (t) {
  Mobile('disconnect').callNative('foo', function(err) {
    t.equal(err, null, 'No error');
    // Giving failure callback a chance to mess things up
    setImmediate(function () {
      t.end();
    });
  });
  Mobile('multiConnectConnectionFailureCallback').registerToNative(
    function (callback) {
      t.fail('We shouldn\'t get a failure callback');
    });
});

test('disconnect doesn\'t fail on plausible but bogus peer ID', function (t) {
  var peerId = nodeUuid.v4() + ':' + 0;
  Mobile('disconnect').callNative(peerId, function(err) {
    t.equal(err, null, 'No error');
    // Giving failure callback a chance to mess things up
    setImmediate(function () {
      t.end();
    });
  });
  Mobile('multiConnectConnectionFailureCallback').registerToNative(
    function (callback) {
      t.fail('We shouldn\'t get a failure callback');
    });
});
