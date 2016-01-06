'use strict';

/** @module thaliPeerPoolInterface */

/**
 * Interface for a class that can manage communications with remote peers. All
 * requests to communicate with remote peers are submitted as action class
 * instances to a pool who decides how many actions of which types to allow.
 * The pool will also track how many incoming connections there are and turn
 * off advertising when necessary to keep the number of connections at an
 * acceptable limit.
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

}

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
 * @public
 * @param {module:thaliPeerAction~PeerAction} peerAction
 * @returns {?Error} Null unless there is a problem in which case Error is
 * returned.
 */
ThaliPeerPoolInterface.prototype.enqueue = function (peerAction) {
  return null;
};

/**
 * Requests that the identified action be killed. The exact meaning of kill
 * depends on the state of the action.
 *
 * If the action is still in the pool's queue then it MUST be removed from the
 * queue, the kill method called on the action and then the pool MUST stop
 * tracking that action.
 *
 * If the action was started by the pool and is in its started state but has not
 * finished yet then the kill method MUST be called on the action and the pool
 * MUST NOT track the action any further.
 *
 * If the action is not recognized then this is treated as a success and null is
 * returned.
 *
 * @param {module:thaliPeerAction~PeerAction} peerAction
 * @returns {?Error} Null will be returned if the kill succeeded otherwise an
 * Error object will be returned.
 */
ThaliPeerPoolInterface.prototype.kill = function (peerAction) {
  return null;
};

module.exports = ThaliPeerPoolInterface;
