'use strict';

var PeerAction = require('./thaliPeerAction');
var assert = require('assert');
var Promise = require('lie');

/** @module thaliPeerPoolInterface */

/**
 * @classdesc Interface for a class that can manage communications with remote
 * peers. All requests to communicate with remote peers are submitted as action
 * class instances to a pool who decides how many actions of which types to
 * allow.
 *
 * __Open Issue:__ One suspects that it will turn out that Bluetooth has a fixed
 * limit for how many connections it can have regardless of who initiated them.
 * But this has not been proved yet. Once it is we will need to specify that the
 * pool has to manage the fixed sum of ingoing and outgoing connections.
 *
 * __Open Issue:__ Have we found a practical limit to how many simultaneous
 * sessions MPCF can handle? One suspects the behavior will be different over
 * Bluetooth vs Apple's proprietary variant of Wifi Direct vs a Wifi AP point.
 * We will have to consider the answer to the question of connection limits when
 * creating an instance of this interface.
 *
 * This is created as an interface in order to allow us to experiment with
 * different approaches for managing bandwidth and to make it easy for third
 * parties to create their own drop in managers.
 *
 * Amongst other things the pool must limit:
 *
 * + How many simultaneous HTTP requests we have outstanding.
 *  + Typically this will be a global pool for Wifi and a per peer pool for
 *  non-TCP transports.
 * + How many incoming peers are allowed to simultaneously have incoming
 * connections over non-TCP transports.
 *
 * @public
 * @interface
 * @constructor
 */
function ThaliPeerPoolInterface() {
  this._inQueue = {};
}

/**
 * Tracks what actions are still somewhere in this object.
 * Each object is added as a member of the inQueue object
 * using its ID as the key.
 * @private
 * @type {Object}
 */
ThaliPeerPoolInterface.prototype._inQueue = null;

/**
 * Adds a request to run the specified 'peerAction'.
 *
 * If peer action is null or not a 'PeerAction' object then
 * the 'Bad peerAction' error MUST be thrown.
 *
 * If there is already an entry either in the queue then
 * the 'Object already in use' error MUST be thrown.
 *
 * If a peer action is submitted that is not in CREATED state then
 * 'Object not in created' error MUST be thrown.
 *
 * We must add peer action to the queue.
 * We must remove peer action from the queue when it will become 'killed'.
 *
 * @public
 * @param {module:thaliPeerAction~PeerAction} peerAction
 * @returns {null}
 * @throws {Error}
 */
ThaliPeerPoolInterface.prototype.enqueue = function (peerAction) {
  if (!peerAction || !(peerAction instanceof PeerAction)) {
    throw new Error(ThaliPeerPoolInterface.ERRORS.BAD_PEER_ACTION);
  }
  if (peerAction.getActionState() !== PeerAction.actionState.CREATED) {
    throw new Error(ThaliPeerPoolInterface.ERRORS.OBJECT_NOT_IN_CREATED);
  }
  var peerActionId = peerAction.getId();
  if (this._inQueue[peerActionId]) {
    throw new Error(ThaliPeerPoolInterface.ERRORS.OBJECT_ALREADY_ENQUEUED);
  }
  this._inQueue[peerActionId] = peerAction;

  // Remove peer action from the queue if it become 'killed'.
  peerAction.once('killed', function () {
    assert(
      this._inQueue[peerActionId] === peerAction,
      'peerAction shouldn\'t escape the queue without going through kill'
    );
    delete this._inQueue[peerActionId];
  }.bind(this));

  return null;
};


/**
 * Error messages.
 * @public
 * @enum {string}
 * @readonly
 */
ThaliPeerPoolInterface.ERRORS = {
  BAD_PEER_ACTION: 'Bad peerAction',
  OBJECT_ALREADY_ENQUEUED: 'Object already in use',
  OBJECT_NOT_IN_CREATED: 'Object not in created',
  QUEUE_IS_NOT_EMPTY: 'Queue should be empty before start'
};

ThaliPeerPoolInterface.prototype.start = function () {
  assert(
    Object.getOwnPropertyNames(this._inQueue).length === 0,
    ThaliPeerPoolInterface.ERRORS.QUEUE_IS_NOT_EMPTY
  );
};

/**
 * Kills all peer actions in the queue.
 * @public
 * @returns {Promise} Returns a promise that indicates via resolve or reject
 * if stop worked properly.
 */
ThaliPeerPoolInterface.prototype.stop = function () {
  var self = this;

  var promises = [];
  Object.getOwnPropertyNames(this._inQueue)
  .forEach(function (peerActionId) {
    var peerAction = self._inQueue[peerActionId];
    peerAction.kill();
    promises.push(peerAction.waitUntilKilled());
  });
  assert(
    Object.getOwnPropertyNames(this._inQueue).length === 0,
    ThaliPeerPoolInterface.ERRORS.QUEUE_IS_NOT_EMPTY
  );

  return Promise.all(promises);
};

module.exports = ThaliPeerPoolInterface;
