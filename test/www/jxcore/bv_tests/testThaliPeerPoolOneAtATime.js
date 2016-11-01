'use strict';

var tape = require('../lib/thaliTape');
var PeerAction = require('thali/NextGeneration/thaliPeerPool/thaliPeerAction');
var inherits = require('util').inherits;
var connectionTypes =
  require('thali/NextGeneration/thaliMobileNativeWrapper').connectionTypes;
var ThaliPeerPoolOneAtATime = require('thali/NextGeneration/thaliPeerPool/thaliPeerPoolOneAtATime');
var Agent = require('http').Agent;
var testUtils = require('../lib/testUtils');
var express = require('express');
var https = require('https');
var Promise = require('lie');
var makeIntoCloseAllServer =
  require('thali/NextGeneration/makeIntoCloseAllServer');
var thaliConfig = require('thali/NextGeneration/thaliConfig');
var thaliMobile = require('thali/NextGeneration/thaliMobile');
var proxyquire = require('proxyquire');
var networkTypes = require('thali/NextGeneration/thaliMobile').networkTypes;
var sinon = require('sinon');
var ThaliNotificationAction = require('thali/NextGeneration/notification/thaliNotificationAction');

var peerIdentifier = 'foo';
var connectionType = connectionTypes.BLUETOOTH;
var actionType = 'bar';
var pskIdentity = 'Look at me';
var pskKey = new Buffer('I\'m as happy as a bluebird');

var testThaliPeerPoolOneAtATime = null;
var testServer = null;

var test = tape({
  setup: function (t) {
    var ProxyPool =
      proxyquire('thali/NextGeneration/thaliPeerPool/thaliPeerPoolOneAtATime',
        { '../thaliMobileNativeWrapper': {
          _getServersManager: function () {
            return {
              terminateOutgoingConnection: function () {
                return true;
              }
            };
          }
        }});
    testThaliPeerPoolOneAtATime = new ProxyPool();
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
  var self = this;
  TestPeerAction.super_.call(this, peerIdentifier, connectionType, actionType,
                             pskIdentity, pskKey);
  self.t = t;
  self.resolve = null;
  self.reject = null;
  self.killSpy = sinon.spy();
  self.startPromise = new Promise(function (resolve, reject) {
    self.resolve = resolve;
    self.reject = reject;
  });
}
/* jshint +W003 */

inherits(TestPeerAction, PeerAction);

TestPeerAction.prototype.t = null;
TestPeerAction.prototype.httpAgentPool = null;
TestPeerAction.prototype.startPromise = null;
TestPeerAction.prototype.getConnectionInformation = function () {
  return {
    getPortNumber: function () {
      return 23;
    }
  }
};

TestPeerAction.prototype.start = function (httpAgentPool) {
  var self = this;
  self.t.ok(httpAgentPool instanceof Agent, 'is an agent');
  self.httpAgentPool = httpAgentPool;
  self.startPromise =
    TestPeerAction.super_.prototype.start.call(this, httpAgentPool)
      .then(self.resolve)
      .catch(self.reject);
  return self.startPromise;
};

function didNotCall(t, connectionType, actionType, errMessagePrefix) {
  var action = new TestPeerAction('foo', connectionType, actionType, t);
  var startSpy = sinon.spy(action, 'start');
  var killSpy = sinon.spy(action, 'kill');
  testThaliPeerPoolOneAtATime.start();
  var enqueueResult = testThaliPeerPoolOneAtATime.enqueue(action);
  t.ok(enqueueResult.message.indexOf(errMessagePrefix) ===
    0, 'Got right error');
  t.notOk(startSpy.called, 'Start should not be called');
  t.ok(killSpy.called, 'Kill should have been called at least once');
  t.end();
}

test('We reject unrecognized connection type', function (t) {
  didNotCall(t, 'bar', 'blah', 'Got unrecognized connection type: ');
});

test('We reject unrecognized action type', function () {
  return global.NETWORK_TYPE != networkTypes.NATIVE;
}, function (t) {
  didNotCall(t, connectionTypes.BLUETOOTH, 'blah',
    'Got unsupported action type: ');
});

test('One action on bluetooth',
  function () {
    return global.NETWORK_TYPE != networkTypes.NATIVE;
  },
  function (t) {
    var action = new TestPeerAction('peerID', connectionTypes.BLUETOOTH,
        ThaliNotificationAction.ACTION_TYPE, t);
    var killSpy = sinon.spy(action, 'kill');
    testThaliPeerPoolOneAtATime.start();
    t.notOk(testThaliPeerPoolOneAtATime.enqueue(action), 'Got null');
    action.startPromise
      .then(function () {
        t.ok(killSpy.called, 'Got killed at least once');
      })
      .catch(function (err) {
        t.fail('Got unexpected error ' + err);
      })
      .then(function () {
        t.end();
      });
  });

test('Two notification actions',
  function () {
    return global.NETWORK_TYPE != networkTypes.NATIVE;
  }, function (t) {
    var action1 = new TestPeerAction('peerId1', connectionTypes.BLUETOOTH,
      ThaliNotificationAction.ACTION_TYPE, t);
    var killSpy1 = sinon.spy(action1, 'kill');
    var action2 = new TestPeerAction('peerId2', connectionTypes.BLUETOOTH,
      ThaliNotificationAction.ACTION_TYPE, t);
    var killSpy2 = sinon.spy(action2, 'kill');
    testThaliPeerPoolOneAtATime.start();
    t.notOk(testThaliPeerPoolOneAtATime.enqueue(action1), 'Got Null');
    t.notOk(testThaliPeerPoolOneAtATime.enqueue(action2), 'Got another null');

    var action1PromiseResolved = false;
    action1.startPromise
      .then(function () {
        t.ok(killSpy1.called, 'Action 1 killed at least once');
        action1PromiseResolved = true;
      })
      .catch(function (err) {
        t.fail('Unexpected err ' + err);
      });
    action2.startPromise
      .then(function () {
        t.ok(action1PromiseResolved, 'Action 1 went first');
        t.ok(killSpy2.called, 'Action 2 killed at least once');
      })
      .catch(function (err) {
        t.fail('Unxpected err on 2 ' + err);
      })
      .then(function () {
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

    t.equal(Object.getOwnPropertyNames(testThaliPeerPoolOneAtATime._inQueue)
        .length, 0, 'inQueue is empty');

    t.end();
  });
});

test('replicateThroughProblems', function (t) {
  function FakeReplication(failureResult, loggingDescription) {
    this._failureResult = failureResult;
    this._loggingDescription = loggingDescription;
    this._cloneCounter = 0;
  }

  FakeReplication.prototype.start = function () {
    return this._failureResult ?
      Promise.reject(this._failureResult) :
      Promise.resolve();
  };

  FakeReplication.prototype.loggingDescription = function () {
    return this._loggingDescription;
  };

  FakeReplication.prototype.kill = function () {
  };

  FakeReplication.prototype.cloneCounter = null;
  FakeReplication.prototype.clone = function () {
    ++this.cloneCounter;
    return new FakeReplication(null, 'clone!');
  };

  FakeReplication.prototype.getConnectionType = function () {
    return thaliMobile.connectionTypes.BLUETOOTH;
  };

  // Action returned successfully
  // .start, .loggingDescription
  var success = new FakeReplication(null, 'success');
  var noActivityTimeOut = new FakeReplication(new Error('No activity time out'),
                                        'noActivityTimeOut');
  var failureButNotAvailable = new FakeReplication(new Error('eeeek!'),
    'failureButNotAvailable');
  var failureButAvailable = new FakeReplication(new Error('eeeek!'),
    'failureButAvailable');
  testThaliPeerPoolOneAtATime._replicateThroughProblems(success, '23')
    .then(function (result) {
      t.notOk(result, 'should have gotten null');
      return testThaliPeerPoolOneAtATime.
      _replicateThroughProblems(noActivityTimeOut, '23');
    }).then(function (result) {
      t.notOk(result, 'Should have stopped nicely');
      return testThaliPeerPoolOneAtATime._replicateThroughProblems(
          failureButNotAvailable, '23');
    }).then(function (result) {
      t.notOk(result, 'Still looking for null');
      thaliMobile.
        _peerAvailabilities[failureButNotAvailable.getConnectionType()].fake =
            {};
      return testThaliPeerPoolOneAtATime._replicateThroughProblems(
          failureButAvailable, 'fake');
    }).then(function (result) {
      t.notOk(result, 'Yup, another null');
      t.equal(failureButAvailable.cloneCounter, 1, 'We cloned!');
    }).catch(function (err) {
      t.fail('Failed with ' + err);
    }).then(function () {
      delete thaliMobile.
        _peerAvailabilities[failureButNotAvailable.getConnectionType()].fake;
      t.end();
    });
});
