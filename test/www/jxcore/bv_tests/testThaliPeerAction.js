'use strict';

var tape = require('../lib/thaliTape');
var PeerAction = require('thali/NextGeneration/thaliPeerPool/thaliPeerAction');
var connectionTypes =
  require('thali/NextGeneration/thaliMobile').connectionTypes;
var inherits = require('util').inherits;
var globalAgent = require('http').globalAgent;

var testPeerAction = null;
var peerIdentifier = 'foo';
var connectionType = connectionTypes.MULTI_PEER_CONNECTIVITY_FRAMEWORK;
var actionType = 'bar';
var pskIdentity = 'I\'m a little tea cup';
var pskKey = new Buffer('Short and stout');

var test = tape({
  setup: function (t) {
    testPeerAction = new TestPeerAction(peerIdentifier, connectionType,
                                        actionType, pskIdentity, pskKey);
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
  TestPeerAction.super_.call(this, peerIdentifier, connectionType, actionType, pskIdentity, pskKey);
}
/* jshint +W003 */

inherits(TestPeerAction, PeerAction);


test('#testThaliPeerAction - test getters', function (t) {
  t.equal(testPeerAction.getPeerIdentifier(), peerIdentifier,
              'getPeerIdentifier');
  t.equal(testPeerAction.getConnectionType(), connectionType,
              'getConnectionType');
  t.equal(testPeerAction.getActionType(), actionType, 'getActionType');
  t.equal(testPeerAction.getActionState(), PeerAction.actionState.CREATED,
          'getActionState');
  t.equal(testPeerAction.getPskIdentity(), pskIdentity, 'getPskIdentity');
  t.ok(Buffer.compare(pskKey, testPeerAction.getPskKey()) === 0,
        'getPskKey')
  t.end();
});

test('#testThaliPeerAction - start and kill', function (t) {
  t.equal(testPeerAction.getActionState(), PeerAction.actionState.CREATED,
    'initial state');
  testPeerAction.start(globalAgent)
    .then(function () {
      t.equal(testPeerAction.getActionState(), PeerAction.actionState.STARTED,
        'after start');
      testPeerAction.kill();
      t.equal(testPeerAction.getActionState(), PeerAction.actionState.KILLED,
        'after kill');
      t.end();
    }).catch(function (err) {
      t.fail('uncaught exception ' + err);
      t.end();
    });
});

test('#testThaliPeerAction - double start', function (t) {
  testPeerAction.start(globalAgent)
    .then(function () {
      return testPeerAction.start(globalAgent);
    }).then(function () {
      t.fail('second start should have failed');
      t.end();
    }).catch(function (err) {
      t.equal(err.message, PeerAction.DOUBLE_START);
      t.end();
    });
});

test('#testThaliPeerAction - start after kill', function (t) {
  testPeerAction.start(globalAgent)
    .then(function () {
      t.equal(testPeerAction.kill(), null, 'clean kill');
      return testPeerAction.start(globalAgent);
    }).then(function () {
      t.fail('start after kill should have failed');
      t.end();
    }).catch(function (err) {
      t.equals(err.message, PeerAction.START_AFTER_KILLED);
      t.end();
    });
});

test('#testThaliPeerAction - make sure ids are unique', function (t) {
  var testPeerAction2 =
  new TestPeerAction(peerIdentifier, connectionType, actionType);
  t.notEqual(testPeerAction.getId(), testPeerAction2.getId());
  t.end();
});
