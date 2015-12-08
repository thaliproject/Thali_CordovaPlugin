'use strict';

var Promise = require('lie');

/** @module thaliPeerPoolInterface */

/**
 * Interface for a class that can manage communications with remote peers.
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
 * the same peerAction object then the "Object already in use" Error MUST be
 * returned.
 *
 * If peerAction is null or not a peerAction object then a "Bad peerAction"
 * Error MUST be returned.
 *
 * @public
 * @param {thaliPeerPoolInterface~ThaliPeerPoolInterface.PeerAction} peerAction
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
 * @param {thaliPeerPoolInterface~ThaliPeerPoolInterface.PeerAction} peerAction
 * @returns {?Error} Null will be returned if the kill succeeded otherwise an
 * Error object will be returned.
 */
ThaliPeerPoolInterface.prototype.kill = function (peerAction) {
  return null;
};

/**
 * An action that has been given to the pool to manage.
 *
 * @public
 * @interface PeerAction
 * @constructor
 * @param {string} peerIdentifier
 * @param {module:thaliMobile.connectionTypes} connectionType
 * @param {string} actionType
 */
ThaliPeerPoolInterface.PeerAction = function (peerIdentifier, connectionType,
                                              actionType) {
  this.peerIdentifier = peerIdentifier;
  this.connectionType = connectionType;
  this.actionType = actionType;
};

ThaliPeerPoolInterface.PeerAction.prototype.getPeerIdentifier = function () {
  return this.peerIdentifier;
};

ThaliPeerPoolInterface.PeerAction.prototype.getConnectionType = function () {
  return this.connectionType;
};

ThaliPeerPoolInterface.PeerAction.prototype.getActionType = function () {
  return this.actionType;
};

/**
 * Tells the action to begin processing. When the action has completed it
 * MUST fire off the KILLED event. This logic MUST be implemented by the
 * class that implements this interface. Once the returned promise resolves
 * then the pool MUST stop tracking this action. Errors from the promise
 * results SHOULD be logged.
 *
 * Start is idempotent so multiple calls MUST NOT directly cause a state change.
 * That is, if the action hasn't started then the first call to start will
 * start it and further calls will accomplish nothing.
 *
 * @public
 * @param {http.Agent}  httpAgentPool The HTTP client connection pool to
 * use when making requests to the requested peer.
 * @returns {Promise<?Error>} returns a promise that will resolve when the
 * action is done. Note that if kill is called on an action then it MUST still
 * return success with null. After all, kill doesn't reflect a failure
 * of the action but a change in outside circumstances.
 */
ThaliPeerPoolInterface.PeerAction.prototype.start = function (httpAgentPool) {
  return Promise.resolve();
};

/**
 * Tells an action to stop executing immediately and synchronously.
 *
 * If the action is already dead then there is no error. If the action isn't
 * dead then once it is killed off it MUST return null to its promise as defined
 * above.
 *
 * This method is idempotent so multiple calls MUST NOT directly cause a state
 * change.
 *
 * @public
 * @returns {?Error}
 */
ThaliPeerPoolInterface.PeerAction.prototype.kill = function () {
  return null;
};

module.exports = ThaliPeerPoolInterface;
