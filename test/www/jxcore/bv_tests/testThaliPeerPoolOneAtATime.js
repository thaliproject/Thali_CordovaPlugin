'use strict';

var tape = require('../lib/thaliTape');
var PeerAction = require('thali/NextGeneration/thaliPeerPool/thaliPeerAction');
var inherits = require('util').inherits;
var connectionTypes =
  require('thali/NextGeneration/thaliMobileNativeWrapper').connectionTypes;
var Agent = require('http').Agent;
var Promise = require('lie');
var thaliMobile = require('thali/NextGeneration/thaliMobile');
var proxyquire = require('proxyquire');
var networkTypes = require('thali/NextGeneration/thaliMobile').networkTypes;
var sinon = require('sinon');
var ThaliNotificationAction = require('thali/NextGeneration/notification/thaliNotificationAction');
var ThaliReplicationAction = require('thali/NextGeneration/replication/thaliReplicationPeerAction');

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
          }
    });
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
    portNumber: 23
  };
};
TestPeerAction.prototype.getPeerAdvertisesDataForUs = function () {
  return {
    portNumber: 99
  };
};

TestPeerAction.prototype.actionBeforeStartReturn = null;

TestPeerAction.prototype.start = function (httpAgentPool) {
  var self = this;
  self.t.ok(httpAgentPool instanceof Agent, 'is an agent');
  self.httpAgentPool = httpAgentPool;
  self.startPromise =
    TestPeerAction.super_.prototype.start.call(this, httpAgentPool)
      .then(function () {
        return self.actionBeforeStartReturn ?
          self.actionBeforeStartReturn() : Promise.resolve();
      })
      .then(self.resolve)
      .catch(self.reject);
  return self.startPromise;
};

TestPeerAction.prototype.killCallback = null;

TestPeerAction.prototype.kill = function () {
  this.killCallback && this.killCallback();
  return TestPeerAction.super_.prototype.kill.call(this);
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
  return global.NETWORK_TYPE !== networkTypes.NATIVE;
}, function (t) {
  didNotCall(t, connectionTypes.BLUETOOTH, 'blah',
    'Got unsupported action type: ');
});

test('One action on bluetooth',
  function () {
    return global.NETWORK_TYPE !== networkTypes.NATIVE;
  },
  function (t) {
    var action = new TestPeerAction('peerID', connectionTypes.BLUETOOTH,
        ThaliNotificationAction.ACTION_TYPE, t);
    var killSpy = sinon.spy(action, 'kill');
    testThaliPeerPoolOneAtATime.start();
    t.notOk(testThaliPeerPoolOneAtATime.enqueue(action), 'Got null');
    action.startPromise
      .then(function () {
        // FIXME: race condition, when startPromise resolved before action is
        // killed
        return new Promise(function (resolve) {
          setImmediate(resolve);
        });
      })
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
    return global.NETWORK_TYPE !== networkTypes.NATIVE;
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
        action1PromiseResolved = true;
        // FIXME: race condition, when startPromise resolved before action is
        // killed
        return new Promise(function (resolve) {
          setImmediate(resolve);
        });
      })
      .then(function () {
        t.ok(killSpy1.called, 'Action 1 killed at least once');
      })
      .catch(function (err) {
        t.fail('Unexpected err ' + err);
      });
    action2.startPromise
      .then(function () {
        // FIXME: race condition, when startPromise resolved before action is
        // killed
        return new Promise(function (resolve) {
          setImmediate(resolve);
        });
      })
      .then(function () {
        t.ok(action1PromiseResolved, 'Action 1 went first');
        t.ok(killSpy2.called, 'Action 2 killed at least once');
      })
      .catch(function (err) {
        t.fail('Unexpected err on 2 ' + err);
      })
      .then(function () {
        t.end();
      });
  });

test('replicateThroughProblems', function (t) {
  function FakeReplication(failureResult, loggingDescription, peerId) {
    this._failureResult = failureResult;
    this._loggingDescription = loggingDescription;
    this._cloneCounter = 0;
    this._peerId = peerId;
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

  FakeReplication.prototype._cloneCounter = null;
  FakeReplication.prototype.clone = function () {
    ++this._cloneCounter;
    return new FakeReplication(null, 'clone!');
  };

  FakeReplication.prototype.getConnectionType = function () {
    return connectionTypes.BLUETOOTH;
  };

  FakeReplication.prototype.getPskIdentity = function () {
    return 'foo';
  };

  FakeReplication.prototype.getPskKey = function () {
    return 'bar';
  };

  FakeReplication.prototype.getPeerAdvertisesDataForUs = function () {
    return {
      peerId: this._peerId
    };
  };

  // Action returned successfully
  // .start, .loggingDescription
  var success = new FakeReplication(null, 'success');
  var noActivityTimeOut = new FakeReplication(new Error('No activity time out'),
    'noActivityTimeOut', '23');
  var failureButNotAvailable = new FakeReplication(new Error('eeeek!'),
    'failureButNotAvailable', '23');
  var failureButAvailable = new FakeReplication(new Error('eeeek!'),
    'failureButAvailable', 'fake');
  testThaliPeerPoolOneAtATime._replicateThroughProblems(success)
    .then(function (result) {
      t.notOk(result, 'should have gotten null');
      return testThaliPeerPoolOneAtATime.
      _replicateThroughProblems(noActivityTimeOut);
    }).then(function (result) {
    t.notOk(result, 'Should have stopped nicely');
    return testThaliPeerPoolOneAtATime._replicateThroughProblems(
      failureButNotAvailable);
  }).then(function (result) {
    t.notOk(result, 'Still looking for null');
    thaliMobile.
      _peerAvailabilities[failureButNotAvailable.getConnectionType()].fake =
    {};
    return testThaliPeerPoolOneAtATime._replicateThroughProblems(
                                      failureButAvailable);
  }).then(function (result) {
    t.notOk(result, 'Yup, another null');
    t.equal(failureButAvailable._cloneCounter, 1, 'We cloned!');
  }).catch(function (err) {
    t.fail('Failed with ' + err);
  }).then(function () {
    delete thaliMobile.
      _peerAvailabilities[failureButNotAvailable.getConnectionType()].fake;
    t.end();
  });
});


test('Replication goes first',
  function () {
    return global.NETWORK_TYPE !== networkTypes.NATIVE;
  }, function (t) {
    var notificationAction = new TestPeerAction('notificationAction',
      connectionTypes.BLUETOOTH, ThaliNotificationAction.ACTION_TYPE, t);
    notificationAction.actionBeforeStartReturn = function () {
      t.notOk(testThaliPeerPoolOneAtATime.enqueue(replicationAction), 'Null 3');
      return Promise.resolve();
    };
    var replicationAction = new TestPeerAction('replicationAction',
      connectionTypes.BLUETOOTH, ThaliReplicationAction.ACTION_TYPE, t);
    var notificationAction2 = new TestPeerAction('notificationAction',
      connectionTypes.BLUETOOTH, ThaliNotificationAction.ACTION_TYPE, t);

    testThaliPeerPoolOneAtATime.start();
    t.notOk(testThaliPeerPoolOneAtATime.enqueue(notificationAction), 'Null 1');
    t.notOk(testThaliPeerPoolOneAtATime.enqueue(notificationAction2, 'null 2'));
    var notificationResolved = false;
    var replicationResolved = false;
    var notification2Resolved = false;
    notificationAction.startPromise
      .then(function () {
        t.notOk(replicationResolved, 'Replication not yet called');
        t.notOk(notification2Resolved, 'Notification 2 not yet called');
        notificationResolved = true;
      })
      .catch(function (err) {
        t.fail('Unexpected error on notification 1 ' + err);
      });
    replicationAction.startPromise
      .then(function () {
        t.ok(notificationResolved, 'Notification went first');
        t.notOk(notification2Resolved, 'Notification 2 not called yet');
        replicationResolved = true;
      })
      .catch(function (err) {
        t.fail('Unexpected error on replication ' + err);
      });
    notificationAction2.startPromise
      .then(function () {
        t.ok(notificationResolved, 'Notification finished');
        t.ok(replicationResolved, 'Replication finished');
        notification2Resolved = true;
        killed();
      })
      .catch(function (err) {
        t.fail('Unexpected error on notification 2 ' + err);
      });
    var notification1Killed = false;
    var replicationKilled = false;
    var notification2Killed = false;
    var killedDone = false;
    function killed() {
      if (killedDone) {
        return;
      }
      if (notification1Killed && replicationKilled && notification2Killed &&
            notificationResolved && replicationResolved &&
            notification2Resolved) {
        t.end();
        killedDone = true;
      }
    }
    notificationAction.killCallback = function () {
      notification1Killed = true;
      killed();
    };
    replicationAction.killCallback = function () {
      replicationKilled = true;
      killed();
    };
    notificationAction2.killCallback = function () {
      notification2Killed = true;
      killed();
    };
  });

test('wifi allows many parallel non-replication actions', function (t) {
  var action1 = new TestPeerAction('1', connectionTypes.TCP_NATIVE, 'foo', t);
  var action2 = new TestPeerAction('2', connectionTypes.TCP_NATIVE, 'foo', t);
  var action1Started = false;
  var action2Started = false;
  var action1Killed = false;
  var action2Killed = false;
  var killedDone = false;
  function killed() {
    if (killedDone) {
      return;
    }
    console.log('' + action1Started + action2Started + action1Killed +
      action2Killed);
    if (action1Started && action2Started && action1Killed && action2Killed) {
      t.end();
      killedDone = true;
    }
  }
  var proveParallel = function () {
    return new Promise(function (resolve) {
      function test() {
        if (action1Started && action2Started) {
          resolve(true);
        }
        setTimeout(function () {
          test();
        }, 10);
      }
      test();
    });
  };

  action1.actionBeforeStartReturn = function () {
    action1Started = true;
    return proveParallel();
  };
  action2.actionBeforeStartReturn = function () {
    action2Started = true;
    return proveParallel();
  };

  action1.killCallback = function () {
    action1Killed = true;
    killed();
  };

  action2.killCallback = function () {
    action2Killed = true;
    killed();
  };

  testThaliPeerPoolOneAtATime.start();
  t.notOk(testThaliPeerPoolOneAtATime.enqueue(action1), 'First null');
  t.notOk(testThaliPeerPoolOneAtATime.enqueue(action2), 'Second null');
  action1.startPromise
    .then(function () {
      return action2.startPromise;
    })
    .then(function () {
      killed();
    })
    .catch(function (err) {
      t.fail('Got unexpected err ' + err);
    });
});

test('wifi allows no more than 2 simultaneous replication actions for same ' +
  'peerID', function (t) {
  var action1 = new TestPeerAction('1', connectionTypes.TCP_NATIVE,
    ThaliReplicationAction.ACTION_TYPE, t);
  var action2 = new TestPeerAction('1', connectionTypes.TCP_NATIVE,
    ThaliReplicationAction.ACTION_TYPE, t);
  var action3 = new TestPeerAction('1', connectionTypes.TCP_NATIVE,
    ThaliReplicationAction.ACTION_TYPE, t);

  var action1Started = false;
  var action2Started = false;
  var action3Started = false;
  var action1Killed = false;
  var action2Killed = false;
  var action3Killed = false;
  var goOnKilledDone = false;
  var goOnKilled = new Promise(function (resolve) {
      function check() {
        if (goOnKilledDone) {
          return;
        }
        if (action1Started && action2Started && !action3Started &&
            !action1Killed && !action2Killed && action3Killed) {
          resolve(true);
          goOnKilledDone = true;
          return;
        }
        setTimeout(function () {
          check();
        }, 100);
      }
      check();
    });

  action1.actionBeforeStartReturn = function () {
    action1Started = true;
    return goOnKilled;
  };
  action2.actionBeforeStartReturn = function () {
    action2Started = true;
    return goOnKilled;
  };
  action3.actionBeforeStartReturn = function () {
    action3Started = true;
    return Promise.resolve(true);
  };

  var cleanUpCheckDone = false;
  function cleanUpCheck() {
    if (cleanUpCheckDone) {
      return;
    }
    if (goOnKilledDone && action1Killed && action2Killed) {
      cleanUpCheckDone = true;
      t.end();
    }
  }

  action1.killCallback = function () {
    action1Killed = true;
    cleanUpCheck();
  };
  action2.killCallback = function () {
    action2Killed = true;
    cleanUpCheck();
  };
  action3.killCallback = function () {
    action3Killed = true;
  };

  testThaliPeerPoolOneAtATime.start();
  t.notOk(testThaliPeerPoolOneAtATime.enqueue(action1), 'First null');
  t.notOk(testThaliPeerPoolOneAtATime.enqueue(action2), 'second null');
  t.notOk(testThaliPeerPoolOneAtATime.enqueue(action3), 'third null');

});
