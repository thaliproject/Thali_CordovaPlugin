'use strict';

var PeerAction = require('./thaliPeerAction');
var assert = require('assert');

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
 * Tracks what actions are still somewhere in this object. Each object is
 * added as a member of the inQueue object using its ID as the key.
 * @type {Object}
 * @private
 */
ThaliPeerPoolInterface.prototype._inQueue = null;

// jscs:disable jsDoc
/**
 * Adds a request to run the specified peerAction.
 *
 * If there is already an entry either in the queue or currently running with
 * the same peerAction object then the "Object already in use" error MUST be
 * returned and no further action taken.
 *
 * If peerAction is null or not a peerAction object then a "Bad peerAction"
 * error MUST be returned.
 *
 * If a peerAction is submitted that is not in CREATED state then an error MUST
 * be returned with the message "Object not in created".
 *
 * When an action is submitted the pool MUST override the action's kill method
 * so as to be able to intercept it. When kill is called if the action has
 * not started yet then it will just be removed from the queue and the action's
 * own kill method called just for completeness sake (it should be a NOOP). If
 * kill is called and the action has started then first the action's kill
 * method MUST be called and then the action must be removed from running and
 * discarded.
 *
 * @public
 * @param {module:thaliPeerAction~PeerAction} peerAction
 * @returns {?Error} Null unless there is a problem in which case Error is
 * returned.
 */
// jscs:enable jsDoc
ThaliPeerPoolInterface.prototype.enqueue = function (peerAction) {
  var self = this;
  if (!peerAction || !(peerAction instanceof PeerAction)) {
    return new Error(ThaliPeerPoolInterface.BAD_PEER_ACTION);
  }
  if (peerAction.getActionState() !== PeerAction.actionState.CREATED) {
    return new Error(ThaliPeerPoolInterface.OBJECT_NOT_IN_CREATED);
  }
  if (self._inQueue[peerAction.getId()]) {
    return new Error(ThaliPeerPoolInterface.OBJECT_ALREADY_ENQUEUED);
  }
  if (!peerAction._poolScratch) {
    peerAction._poolScratch = {};
  }
  peerAction._poolScratch.kill = peerAction.kill;
  peerAction.kill = function () {
    assert(self._inQueue[peerAction.getId()] === peerAction, 'Items should ' +
      'not escape the queue without going through kill');
    delete self._inQueue[peerAction.getId()];
    this._poolScratch.kill.call(peerAction);
  };
  self._inQueue[peerAction.getId()] = peerAction;
  return null;
};

/**
 * Error message returned when enqueue is called with a null or bad object.
 * @type {string}
 * @readonly
 */
ThaliPeerPoolInterface.BAD_PEER_ACTION = 'Bad peerAction';

/**
 * Error message returned when enqueue is called with an action that is already
 * in the queue.
 * @type {string}
 */
ThaliPeerPoolInterface.OBJECT_ALREADY_ENQUEUED = 'Object already in use';

ThaliPeerPoolInterface.OBJECT_NOT_IN_CREATED = 'Object not in created';

module.exports = ThaliPeerPoolInterface;
