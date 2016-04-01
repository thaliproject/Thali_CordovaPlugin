'use strict';

var tape = require('../lib/thaliTape');
var PeerAction = require('thali/NextGeneration/thaliPeerPool/thaliPeerAction');
var connectionTypes =
  require('thali/NextGeneration/thaliMobile').connectionTypes;
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

test('#ThaliPeerPoolInterface - bad enqueues', function (t) {
  var error = testThaliPeerPool.enqueue(null);
  t.equal(error.message, ThaliPeerPoolInterface.BAD_PEER_ACTION,
    'null arg');
  error = testThaliPeerPool.enqueue(testThaliPeerPool);
  t.equal(error.message, ThaliPeerPoolInterface.BAD_PEER_ACTION,
    'wrong arg type');
  testPeerAction.start();
  error = testThaliPeerPool.enqueue(testPeerAction);
  t.equal(error.message, ThaliPeerPoolInterface.OBJECT_NOT_IN_CREATED,
    'wrong state');
  t.end();
});

test('#ThaliPeerPoolInterface - do not allow same object type', function (t) {
  t.equal(testThaliPeerPool.enqueue(testPeerAction), null, 'good enqueue');
  var error = testThaliPeerPool.enqueue(testPeerAction);
  t.equal(error.message, ThaliPeerPoolInterface.OBJECT_ALREADY_ENQUEUED);
  t.end();
});

test('#ThaliPeerPoolInterface - make sure we catch kill and dequeue',
  function (t) {
    var testPeerAction2 =
      new TestPeerAction(peerIdentifier, connectionType, actionType);
    var killSpy = sinon.spy(testPeerAction, 'kill');
    t.equal(testThaliPeerPool.enqueue(testPeerAction), null, 'good enqueue');
    t.equal(testThaliPeerPool.enqueue(testPeerAction2), null,
      '2nd good enqueue');
    t.equal(testThaliPeerPool._inQueue[testPeerAction.getId()], testPeerAction,
      'we are in the pool');
    testPeerAction.kill();
    t.notOk(testThaliPeerPool._inQueue.hasOwnProperty(testPeerAction.getId()),
      'We are out of the pool');
    t.equal(testPeerAction.getActionState(), PeerAction.actionState.KILLED,
      'Action was killed');
    t.ok(killSpy.calledOnce, 'The original kill was called too');
    t.equal(testThaliPeerPool._inQueue[testPeerAction2.getId()],
      testPeerAction2, 'second item is still in queue');
    t.end();
  });

test('#ThaliPeerPoolInterface - make sure our changes to the action leave ' +
  'kill as idempotent', function (t) {
  t.equal(testThaliPeerPool.enqueue(testPeerAction), null, 'good enqueue');
  t.equal(testPeerAction.kill(), null, 'first kill');
  t.equal(testPeerAction.kill(), null, 'second NOOP kill');
  t.end();
});
