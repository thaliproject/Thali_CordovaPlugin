'use strict';

var tape = require('../lib/thaliTape');
var PeerAction = require('thali/NextGeneration/thaliPeerPool/thaliPeerAction');
var inherits = require('util').inherits;
var connectionTypes =
  require('thali/NextGeneration/thaliMobileNativeWrapper').connectionTypes;
var ThaliPeerPoolOneAtATime = require('thali/NextGeneration/thaliPeerPool/thaliPeerPoolDefault');
var Agent = require('http').Agent;
var testUtils = require('../lib/testUtils');
var express = require('express');
var https = require('https');
var Promise = require('lie');
var makeIntoCloseAllServer =
  require('thali/NextGeneration/makeIntoCloseAllServer');
var thaliConfig = require('thali/NextGeneration/thaliConfig');

var peerIdentifier = 'foo';
var connectionType = connectionTypes.MULTI_PEER_CONNECTIVITY_FRAMEWORK;
var actionType = 'bar';
var pskIdentity = 'Look at me';
var pskKey = new Buffer('I\'m as happy as a bluebird');

var testThaliPeerPoolOneAtATime = null;
var testServer = null;

var test = tape({
  setup: function (t) {
    testThaliPeerPoolOneAtATime = new ThaliPeerPoolOneAtATime();
    t.end();
  },
  teardown: function (t) {
    (testServer ? testServer.closeAllPromise() : Promise.resolve())
      .catch(function (err) {
        return t.fail(err);
      })
      .then(function () {
        testServer = null;
        t.end();
      });
  }
});

// I have to refer to TestPeerAction before it is defined in order to get
// to the super constructor
/* jshint -W003 */
function TestPeerAction(peerIdentifier, connectionType, actionType, t) {
  TestPeerAction.super_.call(this, peerIdentifier, connectionType, actionType,
                             pskIdentity, pskKey);
  this.t = t;
}
/* jshint +W003 */

inherits(TestPeerAction, PeerAction);

TestPeerAction.prototype.t = null;
TestPeerAction.prototype.httpAgentPool = null;
TestPeerAction.prototype.startPromise = null;

TestPeerAction.prototype.start = function (httpAgentPool) {
  this.t.ok(httpAgentPool instanceof Agent, 'is an agent');
  this.httpAgentPool = httpAgentPool;
  this.startPromise =
    TestPeerAction.super_.prototype.start.call(this, httpAgentPool);
  return this.startPromise;
};

test('#ThaliPeerPoolOneAtATime - single action', function (t) {
  var testPeerAction = new TestPeerAction(peerIdentifier, connectionType,
    actionType, t);
  testThaliPeerPoolOneAtATime.start();
  t.doesNotThrow(
    function () {
      testThaliPeerPoolOneAtATime.enqueue(testPeerAction);
    },
    'enqueue is fine'
  );
  testPeerAction.startPromise.then(function () {
    t.equal(Object.getOwnPropertyNames(
          testThaliPeerPoolOneAtATime._inQueue).length, 0,
          'Everything should be off the queue');
    t.end();
  }).catch(function (err) {
    t.fail(err);
    t.end();
  });
});

test('#ThaliPeerPoolOneAtATime - multiple actions', function (t) {
  var testPeerAction1 = new TestPeerAction(peerIdentifier, connectionType,
    actionType, t);
  var testPeerAction2 = new TestPeerAction(peerIdentifier, connectionType,
    actionType, t);
  testThaliPeerPoolOneAtATime.start();
  t.doesNotThrow(
    function () {
      testThaliPeerPoolOneAtATime.enqueue(testPeerAction1);
    },
    'first enqueue is fine'
  );
  t.doesNotThrow(
    function () {
      testThaliPeerPoolOneAtATime.enqueue(testPeerAction2);
    },
    'second enqueue is fine'
  );
  testPeerAction1.startPromise.then(function () {
    return testPeerAction2.startPromise;
  }).then(function () {
    t.notEqual(testPeerAction1.httpAgentPool, testPeerAction2.httpAgentPool,
      'everybody, even identical peers, get their own pool, although ' +
      'eventually we should make identical peers have a common pool.');
    t.equal(Object.getOwnPropertyNames(
      testThaliPeerPoolOneAtATime._inQueue).length, 0, 'Queue is empty');
    t.end();
  }).catch(function (err) {
    t.fail(err);
    t.end();
  });
});

function PskTestPeerAction(t, port) {
  PskTestPeerAction.super_.call(this, peerIdentifier, connectionType,
    actionType, t);
  this.t = t;
  this.port = port;
}

inherits(PskTestPeerAction, TestPeerAction);

PskTestPeerAction.prototype.start = function (httpAgentPool) {
  var self = this;
  self.startPromise =
    PskTestPeerAction.super_.prototype.start.call(self, httpAgentPool)
    .then(function () {
      return testUtils.getWithAgent('127.0.0.1', self.port, '/return10',
                                    httpAgentPool);
    })
    .then(function (responseBody) {
      self.t.equal(responseBody, '10', 'Got expected response');
    })
    .catch(function (err) {
      return self.t.fail(err);
    });
  return self.startPromise;
};


test('#ThaliPeerPoolOneAtATime - PSK Pool works', function (t) {
  /*
  Set up a server like thaliMobile and make sure it is listening on PSK
  Then set up a default route for 'return10' that returns the number 10
  Listen on server
  Make a get request to the server when calling start
   */

  testThaliPeerPoolOneAtATime.start();

  var app = express();
  app.get('/return10', function (req, res) {
    res.send('10');
  });
  var gotPskCallBack = false;

  testServer = makeIntoCloseAllServer(https.createServer({
    ciphers: thaliConfig.SUPPORTED_PSK_CIPHERS,
    pskCallback : function (id) {
      t.equal(id, pskIdentity, 'Identity should match');
      gotPskCallBack = true;
      return pskKey;
    },
    key: thaliConfig.BOGUS_KEY_PEM,
    cert: thaliConfig.BOGUS_CERT_PEM
  }, app));

  testServer.listen(0, function () {
    var pskTestPeerAction =
      new PskTestPeerAction(t, testServer.address().port);
    t.doesNotThrow(
      function () {
        testThaliPeerPoolOneAtATime.enqueue(pskTestPeerAction);
      },
      'good enqueue'
    );
    pskTestPeerAction.startPromise.then(function () {
      t.ok(gotPskCallBack, 'Got psk call back');
      t.end();
    });
  });
});

test('#ThaliPeerPoolOneAtATime - stop', function (t) {
  var testAction1 = new TestPeerAction(peerIdentifier, connectionType,
    actionType, t);
  var testAction2 = new TestPeerAction(peerIdentifier, connectionType,
    actionType, t);
  testThaliPeerPoolOneAtATime.start();

  t.doesNotThrow(
    function () {
      testThaliPeerPoolOneAtATime.enqueue(testAction1);
    },
    'enqueue worked'
  );
  t.doesNotThrow(
    function () {
      testThaliPeerPoolOneAtATime.enqueue(testAction2);
    },
    'enqueue 2 worked'
  );

  testThaliPeerPoolOneAtATime.stop()
  .then(function () {
    t.throws(
      function () {
        testThaliPeerPoolOneAtATime.enqueue(testAction1);
      },
      new RegExp(ThaliPeerPoolOneAtATime.ERRORS.ENQUEUE_WHEN_STOPPED),
      'enqueue is not available when stopped'
    );

    t.equal(testAction1.getActionState(), PeerAction.actionState.KILLED,
    'start action is killed');
    t.equal(testAction2.getActionState(), PeerAction.actionState.KILLED,
    'killed action is still killed');

    t.equal(Object.getOwnPropertyNames(testThaliPeerPoolOneAtATime._inQueue).length,
      0, 'inQueue is empty');

    t.end();
  })
});
