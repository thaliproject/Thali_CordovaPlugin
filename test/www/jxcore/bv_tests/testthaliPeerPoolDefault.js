'use strict';

var tape = require('../lib/thaliTape');
var PeerAction = require('thali/NextGeneration/thaliPeerPool/thaliPeerAction');
var inherits = require('util').inherits;
var connectionTypes =
  require('thali/NextGeneration/thaliMobile').connectionTypes;
var ThaliPeerPoolDefault = require('thali/NextGeneration/thaliPeerPool/thaliPeerPoolDefault');
var Agent = require('http').Agent;

var peerIdentifier = 'foo';
var connectionType = connectionTypes.MULTI_PEER_CONNECTIVITY_FRAMEWORK;
var actionType = 'bar';

var testThaliPeerPoolDefault = null;

var test = tape({
  setup: function (t) {
    testThaliPeerPoolDefault = new ThaliPeerPoolDefault();
    t.end();
  },
  teardown: function (t) {
    t.end();
  }
});

/*
  Enqueue a few items
  Make sure they are all started and have a timer run and have it call kill
  and make sure the queue is empty
 */

// I have to refer to TestPeerAction before it is defined in order to get
// to the super constructor
/* jshint -W003 */
function TestPeerAction(peerIdentifier, connectionType, actionType, t) {
  TestPeerAction.super_.call(this, peerIdentifier, connectionType, actionType);
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

test('#ThaliPeerPoolDefault - single action', function (t) {
  var testPeerAction = new TestPeerAction(peerIdentifier, connectionType,
    actionType, t);
  t.equal(testThaliPeerPoolDefault.enqueue(testPeerAction), null,
    'enqueue is fine');
  testPeerAction.startPromise.then(function () {
    t.equal(Object.getOwnPropertyNames(
          testThaliPeerPoolDefault._inQueue).length, 0,
          'Everything should be off the queue');
    t.end();
  }).catch(function (err) {
    t.fail(err);
    t.end();
  });
});

test('#ThaliPeerPoolDefault - multiple actions', function (t) {
  var testPeerAction1 = new TestPeerAction(peerIdentifier, connectionType,
    actionType, t);
  var testPeerAction2 = new TestPeerAction(peerIdentifier, connectionType,
    actionType, t);
  t.equal(testThaliPeerPoolDefault.enqueue(testPeerAction1), null, '' +
    'first enqueue is fine');
  t.equal(testThaliPeerPoolDefault.enqueue(testPeerAction2), null,
    'second enqueue is fine');
  testPeerAction1.startPromise.then(function () {
    return testPeerAction2.startPromise;
  }).then(function () {
    t.notEqual(testPeerAction1.httpAgentPool, testPeerAction2.httpAgentPool,
      'everybody, even identical peers, get their own pool, although ' +
      'eventually we should make identical peers have a common pool.');
    t.equal(Object.getOwnPropertyNames(
      testThaliPeerPoolDefault._inQueue).length, 0, 'Queue is empty');
    t.end();
  }).catch(function (err) {
    t.fail(err);
    t.end();
  });
});
