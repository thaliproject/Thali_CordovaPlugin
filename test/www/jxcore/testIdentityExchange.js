'use strict';

var tape = require('wrapping-tape');
var IdentityExchange = require('thali/identityExchange/identityexchange');
var identityExchangeTestUtils = require('./identityExchangeTestUtils');
var ThaliEmitter = require('thali/thaliemitter');
var request = require('supertest-as-promised');
var identityExchangeUtils = require('thali/identityExchange/identityExchangeUtils');
var inherits = require('util').inherits;
var EventEmitter = require('events').EventEmitter;
var ThaliReplicationManager = require('thali/thalireplicationmanager');


var thaliApp = null;
var thaliServer = null;
var smallHash = null;
var bigHash = null;

function setUpServer() {
  return identityExchangeTestUtils.createThaliAppServer()
      .then(function(appAndServer) {
        thaliApp = appAndServer.app;
        thaliServer = appAndServer.server;
      }).catch(function(err) {
        throw err;
      });
}

var test = tape({
  setup: function(t) {
    var smallAndBigHash = identityExchangeTestUtils.createSmallAndBigHash();
    smallHash = smallAndBigHash.smallHash;
    bigHash = smallAndBigHash.bigHash;
    setUpServer().then(function() {t.end()});
  },
  teardown: function(t) {
    if(thaliServer) {
      thaliServer.close();
      thaliServer = null;
      thaliApp = null;
    }
    t.end();
  }
});

inherits(ThaliEmitterMock, EventEmitter);
function ThaliEmitterMock() {
  EventEmitter.call(this);
}

inherits(TRMMock, EventEmitter);
TRMMock.prototype.deviceIdentity = null;
TRMMock.prototype._emitter = null;
function TRMMock(deviceIdentity) {
  EventEmitter.call(this);
  this.deviceIdentity = deviceIdentity;
  this._emitter = new ThaliEmitterMock();
}
TRMMock.prototype.start = function() {
  this.emit(ThaliReplicationManager.events.STARTED);
};
TRMMock.prototype.stop = function() {
  this.emit(ThaliReplicationManager.events.STOPPED);
};
TRMMock.prototype.getDeviceIdentity = function(cb) {
  cb(null, this.deviceIdentity);
};

// start with various bad friendly names
test('start with bad friendly names', function(t) {
  var badNames = ["", {}, null, "123456789012345678901"];
  badNames.forEach(function(badName) {
    var identityExchange = new IdentityExchange(thaliApp, null, null, null);
    identityExchange.startIdentityExchange(badName, function(err) {
      t.notEqual(err, null);
    });
  });
  t.end();
});

// after start make sure we get PeerIdentityExchange Events
//    then make sure we call start on replication manager with the correct discovery name
//    then make sure we get 400 NoIdentityExchange errors
//    then make sure we get callback.
test('make sure startIdentityExchange sets things up properly', function(t) {
  var trmMock = new TRMMock(smallHash.toString('base64'));
  var identityExchange = new IdentityExchange(thaliApp, thaliServer.address().port, trmMock, "dbName");
  var myFriendlyName = "Matt";
  var sawAbc = false;
  var sawDef = false;

  var peerAvailabilityEvents = [
    {
      peerName: "123;abc",
      foo: "bar1"
    },
    {
      peerName: "notlooking"
    },
    {
      peerName: "456;def",
      foo: "bar2"
    }
  ];

  request(thaliApp)
      .post(identityExchangeUtils.cbPath)
      .send({ foo: "bar"})
      .expect(404)
      .end(function(err, res) {
        t.notOk(err);

        identityExchange.startIdentityExchange(myFriendlyName, function(err) {
          t.notOk(err);

          request(thaliApp)
              .post(identityExchangeUtils.rnMinePath)
              .send({ foo: "bar"})
              .expect(400)
              .end(function(err, res) {
                t.notOk(err);

                trmMock._emitter.emit(ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, peerAvailabilityEvents);
              })
        });
      });

  identityExchange.on(IdentityExchange.Events.PeerIdentityExchange, function(peer) {
    if (peer.peerFriendlyName == "abc") {
      t.notOk(sawAbc);
      t.equals(peer.peerName, "123");
      t.equals(peer.foo, "bar1");
      sawAbc = true;
    }

    if (peer.peerFriendlyName == "def") {
      t.notOk(sawDef);
      t.equals(peer.peerName, "456");
      t.equals(peer.foo, "bar2");
      sawDef = true;
    }

    if (sawAbc && sawDef) {
      t.end();
    }
  });
});

// make sure we get an error if we call start and then immediately call stop

// after stop make sure we don't get PeerIdentityExchange events
//  make sure replication manager is stopped
//  make sure we get callback

// make sure we can't call onExecuteIdentityExchange without first calling start (try both from
//  constructor straight to onExecuteIdentityExchange as well as start -> stop -> onExecuteIdentityExchange
//  start -> stop -> onExecuteIdentityExchange -> stopExecuteIdentityExchange -> onExecuteIdentityExchange

// do an identity exchange where local device has smaller hash
//  make sure we get code

// do an identity exchange where local device has larger hash
//  set it up so we get two codes

