'use strict';

var tape = require('../lib/thaliTape');
var IdentityExchange = require('thali/identityExchange/identityexchange');
var identityExchangeTestUtils = require('./identityExchangeTestUtils');
var ThaliEmitter = require('thali/thaliemitter');
var request = require('supertest-as-promised');
var identityExchangeUtils = require('thali/identityExchange/identityExchangeUtils');
var inherits = require('util').inherits;
var EventEmitter = require('events').EventEmitter;
var ThaliReplicationManager = require('thali/thalireplicationmanager');
var Promise = require('lie');
var urlSafeBase64 = require('urlsafe-base64');


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
    setUpServer().then(function() {
      t.end();
    });
  },
  teardown: function(t) {
    thaliServer = null;
    thaliApp = null;
    if (thaliServer) {
      thaliServer.close();
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
  NotStarted: 'notStarted',
  Started: 'started',
  Stopped: 'stopped'
};

TRMMock.prototype.deviceIdentity = null;
TRMMock.prototype._emitter = null;
TRMMock.prototype.t = null;
TRMMock.prototype.expectedStartPort = null;
TRMMock.prototype.expectedDbName = null;
TRMMock.prototype.friendlyName = null;
TRMMock.prototype.state = TRMMock.states.NotStarted;
TRMMock.prototype.callBeforeStart = null;

function TRMMock(deviceIdentity, t, expectedStartPort, expectedDbName, friendlyName, callBeforeStart) {
  EventEmitter.call(this);
  this.deviceIdentity = deviceIdentity;
  this.t = t;
  this.expectedStartPort = expectedStartPort;
  this.expectedDbName = expectedDbName;
  this.friendlyName = friendlyName;
  this.callBeforeStart = callBeforeStart;
  this._emitter = new ThaliEmitterMock();
}
TRMMock.prototype.start = function(port, dbName, deviceName) {
  var self = this;
  if (self.state != TRMMock.states.NotStarted && self.state != TRMMock.states.Stopped) {
    self.t.fail("Start was called on TRMMock when it wasn't in the right state.");
  }
  var localCallBeforeStart = this.callBeforeStart;
  if (!localCallBeforeStart) {
    localCallBeforeStart = function(port, dbName, deviceName, cb) {
      cb();
    };
  }
  localCallBeforeStart(port, dbName, deviceName, function() {
    self.state = TRMMock.states.Started;
    if (self.t) {
      self.t.equal(port, self.expectedStartPort);
      self.t.equal(dbName, self.expectedDbName);
      self.t.equal(deviceName, self.deviceIdentity + ';' + self.friendlyName);
    }
    self.emit(ThaliReplicationManager.events.STARTED);
  });
};
TRMMock.prototype.stop = function() {
  if (this.state != TRMMock.states.Started) {
    this.t.fail("Stop was called on TRMock when it wasn't in the start state.");
  }
  this.state = TRMMock.states.Stopped;
  this.emit(ThaliReplicationManager.events.STOPPED);
};
TRMMock.prototype.getDeviceIdentity = function(cb) {
  cb(null, this.deviceIdentity);
};

test('start with bad friendly names', function(t) {
  var badNames = ['', {}, null, '123456789012345678901'];
  badNames.forEach(function(badName) {
    var identityExchange = new IdentityExchange(thaliApp, null, null, null);
    identityExchange.startIdentityExchange(badName, function(err) {
      t.notEqual(err, null);
    });
  });
  t.end();
});

test('make sure startIdentityExchange sets things up properly', function(t) {
  var myFriendlyName = 'Matt';
  var trmMock = new TRMMock(urlSafeBase64.encode(smallHash), t, thaliServer.address().port, 'dbName', myFriendlyName);
  var identityExchange = new IdentityExchange(thaliApp, thaliServer.address().port, trmMock, 'dbName');
  var sawAbc = false;
  var sawDef = false;

  var peerAvailabilityEvents = [
    {
      peerName: '123;abc',
      foo: 'bar1'
    },
    {
      peerName: 'notlooking'
    },
    {
      peerName: '456;def',
      foo: 'bar2'
    }
  ];

  request(thaliApp)
    .post(identityExchangeUtils.cbPath)
    .send({ foo: 'bar'})
    .expect(404)
    .end(function(err, res) {
      t.notOk(err);

      identityExchange.startIdentityExchange(myFriendlyName, function(err) {
        t.notOk(err);

        request(thaliApp)
          .post(identityExchangeUtils.rnMinePath)
          .send({ foo: 'bar'})
          .expect(400)
          .end(function(err, res) {
            t.notOk(err);

            trmMock._emitter.emit(ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, peerAvailabilityEvents);
          });
      });
    });

  identityExchange.on(IdentityExchange.Events.PeerIdentityExchange, function(peer) {
    if (peer.peerFriendlyName == 'abc') {
      t.notOk(sawAbc);
      t.equals(peer.peerName, '123');
      t.equals(peer.foo, 'bar1');
      sawAbc = true;
    }

    if (peer.peerFriendlyName == 'def') {
      t.notOk(sawDef);
      t.equals(peer.peerName, '456');
      t.equals(peer.foo, 'bar2');
      sawDef = true;
    }

    if (sawAbc && sawDef) {
      t.equal(trmMock.state, TRMMock.states.Started);
      t.end();
    }
  });
});

test('make sure we get an error if we call start and then immediately call stop', function(t) {
  var myFriendlyName = 'Toby';
  var trmMock = new TRMMock(urlSafeBase64.encode(smallHash), t, thaliServer.address().port, 'dbName', myFriendlyName);
  var identityExchange = new IdentityExchange(thaliApp, thaliServer.address().port, trmMock, 'dbName');
  identityExchange.startIdentityExchange(myFriendlyName, function(err) {
    t.equal(err, null);
  });
  t.throws(function() { identityExchange.stopExecutingIdentityExchange();});
  t.end();
});

test('Make sure stop is clean from start', function(t) {
  var myFriendlyName = 'Luke';
  var trmMock = new TRMMock(urlSafeBase64.encode(smallHash), t, thaliServer.address().port, 'dbName', myFriendlyName);
  var identityExchange = new IdentityExchange(thaliApp, thaliServer.address().port, trmMock, 'dbName');
  identityExchange.on(IdentityExchange.Events.PeerIdentityExchange, function(peer) {
    t.fail('Should not have been called on PeerIdentityExchange');
  });
  identityExchange.startIdentityExchange(myFriendlyName, function(err) {
    t.notOk(err, 'Should not have gotten error on startIdentityExchange');
    identityExchange.stopIdentityExchange(function(err) {
      t.notOk(err, 'Should not have gotten error on stopIdentityExchange');
      trmMock._emitter.emit(ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, { peerName: 'abc;123' });
      t.equal(trmMock.state, TRMMock.states.Stopped, 'State should be Stopped');
      t.end();
    });
  });
});

test('Make sure stop is clean from stop execute identity exchange', function(t) {
  var myFriendlyName = 'Jukka';
  var trmMock = new TRMMock(urlSafeBase64.encode(smallHash), t, thaliServer.address().port, 'dbName', myFriendlyName);
  var identityExchange = new IdentityExchange(thaliApp, thaliServer.address().port, trmMock, 'dbName');
  identityExchange.on(IdentityExchange.Events.PeerIdentityExchange, function() {
    t.fail();
  });
  identityExchange.startIdentityExchange(myFriendlyName, function(err) {
    t.notOk(err);
    identityExchange.executeIdentityExchange('foo', urlSafeBase64.encode(bigHash), function() { t.fail(); });
    identityExchange.stopExecutingIdentityExchange();
    identityExchange.stopIdentityExchange(function(err) {
      t.notOk(err);
      trmMock._emitter.emit(ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, { peerName: 'abc;123' });
      t.equal(trmMock.state, TRMMock.states.Stopped);
      t.end();
    });
  });
});


test('make sure we do not have a race condition between startIdentityExchange and executeIdentityExchange',
  function(t) {
    var myFriendlyName = 'Doug';
    var base64BigHash = urlSafeBase64.encode(bigHash);
    var peerAvailabilityChangedEvents = [
      { peerName: base64BigHash+';abc'},
      { peerName: 'efg'},
      { peerName: base64BigHash+';def'}
    ];
    var trmMock = new TRMMock(urlSafeBase64.encode(smallHash), t, thaliServer.address().port, 'dbName', myFriendlyName,
      function(port, dbName, deviceName, cb) {
        peerAvailabilityChangedEvents.forEach(function(peer) {
          trmMock._emitter.emit(ThaliEmitter.events.PEER_AVAILABILITY_CHANGED, peer);
        });
        cb();
      });
    var identityExchange = new IdentityExchange(thaliApp, thaliServer.address().port, trmMock, 'dbName');
    var sawAbc = false;
    var sawDef = false;
    var gotStartCallBack = false;
    function checkAllDone(){
      if (sawAbc && sawDef && gotStartCallBack) {
        t.end();
      }
    }
    identityExchange.on(IdentityExchange.Events.PeerIdentityExchange, function(peer) {
      if (peer.peerFriendlyName == 'abc') {
        t.notOk(sawAbc);
        sawAbc = true;
        t.doesNotThrow(function() {
          identityExchange.executeIdentityExchange(peer.peerFriendlyName, peer.peerName, function() {
            t.fail();
          });
        });
        checkAllDone();
        return;
      }

      if (peer.peerFriendlyName == 'def') {
        t.notOk(sawDef);
        sawDef = true;
        checkAllDone();
        return;
      }

      t.fail('We got an event we should not have');
    });
    identityExchange.startIdentityExchange(myFriendlyName, function(err) {
      t.notOk(err);
      gotStartCallBack = true;
      checkAllDone();
    });
  });


test('illegal method combinations', function(t) {
  var myFriendlyName = 'David';
  var trmMock = new TRMMock(urlSafeBase64.encode(smallHash), t, thaliServer.address().port, 'dbName', myFriendlyName);
  var identityExchange = new IdentityExchange(thaliApp, thaliServer.address().port, trmMock, 'dbName');
  t.throws(function() { identityExchange.executeIdentityExchange('foo', 'bar', function() {t.fail(); }); });
  t.throws(function() { identityExchange.stopExecutingIdentityExchange(); });
  t.throws(function() { identityExchange.stopIdentityExchange(function() {t.fail(); }); });
  identityExchange.startIdentityExchange(myFriendlyName, function(err) {
    t.notOk(err);
    t.throws(function() { identityExchange.startIdentityExchange(myFriendlyName, function() {t.fail(); }); });
    t.throws(function() { identityExchange.stopExecutingIdentityExchange('foo', 'bar', function() {t.fail(); }); });
    identityExchange.stopIdentityExchange(function(err) {
      t.notOk(err);
      t.throws(function() { identityExchange.stopExecutingIdentityExchange(); });
      t.throws(function() { identityExchange.executeIdentityExchange('foo', 'bar', function() {t.fail(); }); });
      identityExchange.startIdentityExchange(myFriendlyName, function(err) {
        t.notOk(err);
        identityExchange.executeIdentityExchange('foo', urlSafeBase64.encode(bigHash), function() {t.fail(); });
        t.throws(function() { identityExchange.executeIdentityExchange('foo', 'bar', function() {t.fail(); }); });
        t.throws(function() { identityExchange.stopIdentityExchange(function() {t.fail(); }); });
        t.throws(function() { identityExchange.startIdentityExchange(myFriendlyName, function() {t.fail(); }); });
        identityExchange.stopExecutingIdentityExchange();
        t.throws(function() { identityExchange.stopExecutingIdentityExchange(); });
        t.throws(function() { identityExchange.startIdentityExchange(myFriendlyName, function() {t.fail(); }); });
        t.end();
      });
    });
  });
});

function runToCompletion(t, identityExchange, myFriendlyName, trmMock, secondIdentityExchange, secondFriendlyName,
                         secondTrmMock, secondThaliServer) {
  var firstPeerId = 'foo';
  var secondPeerId = 'bar';

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
          });
        });
      }
    }

    identityExchange.startIdentityExchange(myFriendlyName, function(err) {
      t.notOk(err);
      identityExchange.executeIdentityExchange(secondPeerId, urlSafeBase64.encode(bigHash), function(err, code) {
        t.notOk(err);
        identityExchangeTestUtils.checkCode(t, code);
        firstCode = code;
        checkFinish();
      });

      secondIdentityExchange.startIdentityExchange(secondFriendlyName, function(err) {
        t.notOk(err);
        secondIdentityExchange.executeIdentityExchange(firstPeerId, urlSafeBase64.encode(smallHash), function(err, code) {
          t.notOk(err);
          identityExchangeTestUtils.checkCode(t, code);
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
  var secondFriendlyName = 'Srikanth';
  var secondThaliApp = null;
  var secondThaliServer = null;
  var secondTrmMock = null;
  var secondIdentityExchange = null;

  var myFriendlyName = 'John';
  var trmMock = new TRMMock(urlSafeBase64.encode(smallHash), t, thaliServer.address().port, 'dbName', myFriendlyName);
  var identityExchange = new IdentityExchange(thaliApp, thaliServer.address().port, trmMock, 'dbName');

  identityExchangeTestUtils.createThaliAppServer()
    .then(function(appAndServer) {
      secondThaliApp = appAndServer.app;
      secondThaliServer = appAndServer.server;

      secondTrmMock = new TRMMock(urlSafeBase64.encode(bigHash), t, secondThaliServer.address().port, 'anotherDbName',
        secondFriendlyName);
      secondIdentityExchange = new IdentityExchange(secondThaliApp, secondThaliServer.address().port, secondTrmMock,
        'anotherDbName');
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
