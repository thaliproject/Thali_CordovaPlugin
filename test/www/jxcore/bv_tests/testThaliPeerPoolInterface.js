'use strict';

var tape = require('../lib/thaliTape');
var PeerAction = require('thali/NextGeneration/thaliPeerPool/thaliPeerAction');
var connectionTypes =
  require('thali/NextGeneration/thaliMobileNativeWrapper').connectionTypes;
var inherits = require('util').inherits;
var ThaliPeerPoolInterface = require('thali/NextGeneration/thaliPeerPool/thaliPeerPoolInterface');
var sinon = require('sinon');

var testPeerAction = null;
var peerIdentifier = 'foo';
var connectionType = connectionTypes.MULTI_PEER_CONNECTIVITY_FRAMEWORK;
var actionType = 'bar';

var testThaliPeerPool = null;

var test = tape({
  setup: function (t) {
    testPeerAction = new TestPeerAction(peerIdentifier, connectionType,
      actionType);
    testThaliPeerPool = new TestThaliPeerPool();
    t.end();
  },
  teardown: function (t) {
    t.end();
  }
});


// I have to refer to TestPeerAction before it is defined in order to get
// to the super constructor
/* jshint -W003 */
function TestPeerAction(peerIdentifier, connectionType, actionType) {
  TestPeerAction.super_.call(this, peerIdentifier, connectionType, actionType);
}
/* jshint +W003 */

inherits(TestPeerAction, PeerAction);

function TestThaliPeerPool() {
  TestThaliPeerPool.super_.call(this);
}

inherits(TestThaliPeerPool, ThaliPeerPoolInterface);

test(
  '#ThaliPeerPoolInterface - make sure that start verifies queue length',
  function (t) {
    t.doesNotThrow(
      function () {
        testThaliPeerPool.start();
      },
      'good start'
    );
    t.doesNotThrow(
      function () {
        testThaliPeerPool.enqueue(testPeerAction);
      },
      'good enqueue'
    );
    t.throws(
      function () {
        testThaliPeerPool.start();
      },
      new RegExp(ThaliPeerPoolInterface.ERRORS.QUEUE_IS_NOT_EMPTY),
      'queue is not empty'
    );
    testThaliPeerPool.stop()
    .then(function () {
      t.end();
    });
  }
);

test('#ThaliPeerPoolInterface - bad enqueues', function (t) {
  testThaliPeerPool.start();
  t.throws(
    function () {
      testThaliPeerPool.enqueue(null);
    },
    new RegExp(ThaliPeerPoolInterface.ERRORS.BAD_PEER_ACTION), 'null arg'
  );
  t.throws(
    function () {
      testThaliPeerPool.enqueue(testThaliPeerPool);
    },
    new RegExp(ThaliPeerPoolInterface.ERRORS.BAD_PEER_ACTION), 'wrong arg type'
  );

  testPeerAction.start();
  t.throws(
    function () {
      testThaliPeerPool.enqueue(testPeerAction);
    },
    new RegExp(ThaliPeerPoolInterface.ERRORS.OBJECT_NOT_IN_CREATED), 'wrong arg type'
  );

  t.end();
});

test('#ThaliPeerPoolInterface - do not allow same object type', function (t) {
  testThaliPeerPool.start();
  t.doesNotThrow(
    function () {
      testThaliPeerPool.enqueue(testPeerAction);
    },
    'good enqueue'
  );
  t.throws(
    function () {
      testThaliPeerPool.enqueue(testPeerAction);
    },
    new RegExp(ThaliPeerPoolInterface.ERRORS.OBJECT_ALREADY_ENQUEUED), 'already enqueued'
  );

  t.end();
});

test(
  '#ThaliPeerPoolInterface - make sure we catch kill and dequeue',
  function (t) {
    testThaliPeerPool.start();
    var testPeerAction2 = new TestPeerAction(
      peerIdentifier, connectionType, actionType
    );
    var killSpy = sinon.spy(testPeerAction, 'kill');
    t.doesNotThrow(
      function () {
        testThaliPeerPool.enqueue(testPeerAction);
      },
      'good enqueue'
    );
    t.doesNotThrow(
      function () {
        testThaliPeerPool.enqueue(testPeerAction2);
      },
      '2nd good enqueue'
    );

    t.equal(
      testThaliPeerPool._inQueue[testPeerAction.getId()],
      testPeerAction, 'we are in the pool'
    );
    testPeerAction.kill();
    t.notOk(
      testThaliPeerPool._inQueue.hasOwnProperty(testPeerAction.getId()),
      'We are out of the pool'
    );

    t.equal(
      testPeerAction.getActionState(),
      PeerAction.actionState.KILLED, 'Action was killed'
    );
    t.ok(killSpy.calledOnce, 'The original kill was called too');
    t.equal(
      testThaliPeerPool._inQueue[testPeerAction2.getId()],
      testPeerAction2, 'second item is still in queue'
    );

    t.end();
  }
);

test(
  '#ThaliPeerPoolInterface - make sure our changes to the action leave ' +
  'kill as idempotent',
  function (t) {
    testThaliPeerPool.start();
    t.doesNotThrow(
      function () {
        testThaliPeerPool.enqueue(testPeerAction);
      },
      'good enqueue'
    );
    t.equal(testPeerAction.kill(), null, 'first kill');
    t.equal(testPeerAction.kill(), null, 'second NOOP kill');
    t.end();
  }
);

test(
  '#ThaliPeerPoolInterface - make sure that stop removes all actions',
  function (t) {
    testThaliPeerPool.start();
    var testPeerAction2 = new TestPeerAction(
      peerIdentifier, connectionType, actionType
    );
    t.doesNotThrow(
      function () {
        testThaliPeerPool.enqueue(testPeerAction);
      },
      '1st good enqueue'
    );
    t.doesNotThrow(
      function () {
        testThaliPeerPool.enqueue(testPeerAction2);
      },
      '2nd good enqueue'
    );

    t.equal(
      testThaliPeerPool._inQueue[testPeerAction.getId()],
      testPeerAction, '1st action is in the pool'
    );
    t.equal(
      testThaliPeerPool._inQueue[testPeerAction2.getId()],
      testPeerAction2, '2nd action is in the pool'
    );

    testThaliPeerPool.stop()
    .then(function () {
      t.notOk(
        testThaliPeerPool._inQueue.hasOwnProperty(testPeerAction.getId()),
        '1st action is out of the pool'
      );
      t.notOk(
        testThaliPeerPool._inQueue.hasOwnProperty(testPeerAction2.getId()),
        '2st action is out of the pool'
      );
      t.equal(
        Object.getOwnPropertyNames(testThaliPeerPool._inQueue).length,
        0, 'pool is empty'
      );

      t.end();
    });
  }
);
