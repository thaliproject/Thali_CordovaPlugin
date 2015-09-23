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

TRMMock.states = {
  NotStarted: "notStarted",
  Started: "started",
  Stopped: "stopped"
};

TRMMock.prototype.deviceIdentity = null;
TRMMock.prototype._emitter = null;
TRMMock.prototype.t = null;
TRMMock.prototype.expectedStartPort = null;
TRMMock.prototype.expectedDbName = null;
TRMMock.prototype.friendlyName = null;
TRMMock.prototype.state = TRMMock.states.NotStarted;

function TRMMock(deviceIdentity, t, expectedStartPort, expectedDbName, friendlyName) {
  EventEmitter.call(this);
  this.deviceIdentity = deviceIdentity;
  this.t = t;
  this.expectedStartPort = expectedStartPort;
  this.expectedDbName = expectedDbName;
  this.friendlyName = friendlyName;
  this._emitter = new ThaliEmitterMock();
}
TRMMock.prototype.start = function(port, dbName, deviceName) {
  this.state = TRMMock.states.Started;
  if (this.t) {
    this.t.equal(port, this.expectedStartPort);
    this.t.equal(dbName, this.expectedDbName);
    this.t.equal(deviceName, this.deviceIdentity + ";" + this.friendlyName);
  }
  this.emit(ThaliReplicationManager.events.STARTED);
};
TRMMock.prototype.stop = function() {
  this.state = TRMMock.states.Stopped;
  this.emit(ThaliReplicationManager.events.STOPPED);
};
TRMMock.prototype.getDeviceIdentity = function(cb) {
  cb(null, this.deviceIdentity);
};

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

test('make sure startIdentityExchange sets things up properly', function(t) {
  var myFriendlyName = "Matt";
  var trmMock = new TRMMock(smallHash.toString('base64'), t, thaliServer.address().port, "dbName", myFriendlyName);
  var identityExchange = new IdentityExchange(thaliApp, thaliServer.address().port, trmMock, "dbName");
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
      t.equal(trmMock.state, TRMMock.states.Started);
      t.end();
    }
  });
});

test('make sure we get an error if we call start and then immediately call stop', function(t) {
  var myFriendlyName = "Toby";
  var trmMock = new TRMMock(smallHash.toString('base64'), t, thaliServer.address().port, "dbName", myFriendlyName);
  var identityExchange = new IdentityExchange(thaliApp, thaliServer.address().port, trmMock, "dbName");
  identityExchange.startIdentityExchange(myFriendlyName, function(err) {
    t.equal(err, null);
  });
  t.throws(function() { identityExchange.stopExecutingIdentityExchange();})
  t.end();
});

test('Make sure stop is clean from start', function(t) {
  var myFriendlyName = "Luke";
  var trmMock = new TRMMock(smallHash.toString('base64'), t, thaliServer.address().port, "dbName", myFriendlyName);
  var identityExchange = new IdentityExchange(thaliApp, thaliServer.address().port, trmMock, "dbName");
  identityExchange.on(IdentityExchange.Events.PeerIdentityExchange, function(peer) {
    t.fail();
  });
  identityExchange.startIdentityExchange(myFriendlyName, function(err) {
    t.notOk(err);
    identityExchange.stopIdentityExchange(function(err) {
      t.notOk(err);
      trmMock._emitter.emit(ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, { peerName: "abc;123" });
      t.equal(trmMock.state, TRMMock.states.Stopped);
      t.end();
    })
  })
});

test('Make sure stop is clean from stop execute identity exchange', function(t) {
  var myFriendlyName = "Jukka";
  var trmMock = new TRMMock(smallHash.toString('base64'), t, thaliServer.address().port, "dbName", myFriendlyName);
  var identityExchange = new IdentityExchange(thaliApp, thaliServer.address().port, trmMock, "dbName");
  identityExchange.on(IdentityExchange.Events.PeerIdentityExchange, function() {
    t.fail();
  });
  identityExchange.startIdentityExchange(myFriendlyName, function(err) {
    t.notOk(err);
    identityExchange.executeIdentityExchange("foo", bigHash.toString('base64'), function() {t.fail()});
    identityExchange.stopExecutingIdentityExchange();
    identityExchange.stopIdentityExchange(function(err) {
      t.notOk(err);
      trmMock._emitter.emit(ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, { peerName: "abc;123" });
      t.equal(trmMock.state, TRMMock.states.Stopped);
      t.end();
    })
  })
});

test('illegal method combinations', function(t) {
  var myFriendlyName = "David";
  var trmMock = new TRMMock(smallHash.toString('base64'), t, thaliServer.address().port, "dbName", myFriendlyName);
  var identityExchange = new IdentityExchange(thaliApp, thaliServer.address().port, trmMock, "dbName");
  t.throws(function() { identityExchange.executeIdentityExchange("foo", "bar", function() {t.fail()})});
  t.throws(function() { identityExchange.stopExecutingIdentityExchange()});
  t.throws(function() { identityExchange.stopIdentityExchange(function() {t.fail()})});
  identityExchange.startIdentityExchange(myFriendlyName, function(err) {
    t.notOk(err);
    t.throws(function() { identityExchange.startIdentityExchange(myFriendlyName, function() {t.fail()})});
    t.throws(function() { identityExchange.stopExecutingIdentityExchange("foo", "bar", function() {t.fail()})});
    identityExchange.stopIdentityExchange(function(err) {
      t.notOk(err);
      t.throws(function() { identityExchange.stopExecutingIdentityExchange()});
      t.throws(function() { identityExchange.executeIdentityExchange("foo", "bar", function() {t.fail()})});
      identityExchange.startIdentityExchange(myFriendlyName, function(err) {
        t.notOk(err);
        identityExchange.executeIdentityExchange("foo", bigHash.toString('base64'), function() {t.fail()});
        t.throws(function() { identityExchange.executeIdentityExchange("foo", "bar", function() {t.fail()})});
        t.throws(function() { identityExchange.stopIdentityExchange(function() {t.fail()})});
        t.throws(function() { identityExchange.startIdentityExchange(myFriendlyName, function() {t.fail()})});
        identityExchange.stopExecutingIdentityExchange();
        t.throws(function() { identityExchange.stopExecutingIdentityExchange()});
        t.throws(function() { identityExchange.startIdentityExchange(myFriendlyName, function() {t.fail()})});
        t.end();
      });
    })
  })
});

function runToCompletion(t, identityExchange, myFriendlyName, trmMock, secondIdentityExchange, secondFriendlyName,
                          secondTrmMock, secondThaliServer) {
  var firstPeerId = "foo";
  var secondPeerId = "bar";

  function checkCode(code) {
    t.ok(typeof code === "number" && code >= 0 && code < 1000000);
  }

  return new Promise(function(resolve, reject) {
    var firstCode = null;
    var secondCode = null;

    function checkFinish() {
      if (firstCode && secondCode) {
        t.equal(firstCode, secondCode);
        identityExchange.stopExecutingIdentityExchange();
        identityExchange.stopIdentityExchange(function(err) {
          t.notOk(err);
          secondIdentityExchange.stopExecutingIdentityExchange();
          secondIdentityExchange.stopIdentityExchange(function(err) {
            t.notOk(err);
            resolve();
          })
        });
      }
    }

    identityExchange.startIdentityExchange(myFriendlyName, function(err) {
      t.notOk(err);
      identityExchange.executeIdentityExchange(secondPeerId, bigHash.toString('base64'), function(err, code) {
        t.notOk(err);
        checkCode(code);
        firstCode = code;
        checkFinish();
      });

      secondIdentityExchange.startIdentityExchange(secondFriendlyName, function(err) {
        t.notOk(err);
        secondIdentityExchange.executeIdentityExchange(firstPeerId, smallHash.toString('base64'), function(err, code) {
          t.notOk(err);
          checkCode(code);
          secondCode = code;
          checkFinish();
        });

        // Just for chuckles, this shouldn't do anything
        secondTrmMock.emit(ThaliReplicationManager.events.CONNECTION_SUCCESS, { peerIdentifier: firstPeerId,
          muxPort: thaliServer.address().port,
          time: Date.now()});
        trmMock.emit(ThaliReplicationManager.events.CONNECTION_SUCCESS, { peerIdentifier: secondPeerId,
          muxPort: secondThaliServer.address().port,
          time: Date.now()});
      });
    });
  });
}

test('do an identity exchange and get code multiple times to make sure we do not hork state', function(t) {
  var secondFriendlyName = "Srikanth";
  var secondThaliApp = null;
  var secondThaliServer = null;
  var secondTrmMock = null;
  var secondIdentityExchange = null;

  var myFriendlyName = "John";
  var trmMock = new TRMMock(smallHash.toString('base64'), t, thaliServer.address().port, "dbName", myFriendlyName);
  var identityExchange = new IdentityExchange(thaliApp, thaliServer.address().port, trmMock, "dbName");

  identityExchangeTestUtils.createThaliAppServer()
      .then(function(appAndServer) {
        secondThaliApp = appAndServer.app;
        secondThaliServer = appAndServer.server;

        secondTrmMock = new TRMMock(bigHash.toString('base64'), t, secondThaliServer.address().port, "anotherDbName",
            secondFriendlyName);
        secondIdentityExchange = new IdentityExchange(secondThaliApp, secondThaliServer.address().port, secondTrmMock,
            "anotherDbName");
        function runIt() {
          return runToCompletion(t, identityExchange, myFriendlyName, trmMock, secondIdentityExchange, secondFriendlyName,
              secondTrmMock, secondThaliServer);
        }

        var testPromise = runIt();

        for (var i = 0; i < 10; ++i) {
          testPromise = testPromise.then(function () {
            return runIt();
          });
        }

        return testPromise;
      }).then(function() {
        secondThaliServer.close();
        t.end();
      }).catch(function(err) {
        t.fail(err);
      });
});


//test('Now do an identity Exchange with the real live system!', function(t) {
//  if (!jxcore.utils.OSInfo().isMobile) {
//    t.comment("Skipping test because we aren't running on a mobile platform");
//    t.end();
//    return;
//  }
//
//
//});