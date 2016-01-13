'use strict';

var Promise = require('lie');

/** @module thaliPeerAction */

/**
 * Records the current state of the action.
 *
 * @public
 * @readonly
 * @enum {string}
 */
module.exports.actionState = {
  /** The action has been created but hasn't started or ended yet. */
  CREATED: 'created',
  /** The action is out of the queue and is currently running */
  STARTED: 'started',
  /** The action is not running and not in the queue */
  KILLED: 'killed'
};

/**
 * An action that has been given to the pool to manage.
 *
 * When an action is created its state MUST be CREATED.
 *
 * If either nonContentionLifeSpan or contentionLifeSpan are not numbers
 * or are any integer less than
 * {@link module:thaliPeerAction~PeerAction.MINIMUM_ACTION_LENGTH} then a
 * bad argument error MUST be returned.
 *
 * @public
 * @interface PeerAction
 * @constructor
 * @param {string} peerIdentifier
 * @param {module:thaliMobile.connectionTypes} connectionType
 * @param {string} actionType
 * @param {number} nonContentionLifeSpan The maximum number of milliseconds
 * to run the job before calling kill if there are no other jobs on the queue.
 * @param {number} contentionLifeSpan The maximum number of milliseconds to run
 * the job before calling kill if there are other jobs that are blocked by
 * this job.
 */
function PeerAction (peerIdentifier, connectionType, actionType,
                     nonContentionLifeSpan, contentionLifeSpan) {
  this.peerIdentifier = peerIdentifier;
  this.connectionType = connectionType;
  this.actionType = actionType;
  this.actionState = module.exports.actionState.STARTED;
  this.nonContentionLifeSpan = nonContentionLifeSpan;
  this.contentionLifeSpan = contentionLifeSpan;
}

/**
 * The minimum amount of time in milliseconds that a life span must be set to.
 * @type {number}
 */
PeerAction.MINIMUM_ACTION_LENGTH = 10;

/**
 * The remote peer this action targets
 * @private
 * @type {string}
 */
PeerAction.prototype.peerIdentifier = null;

PeerAction.prototype.getPeerIdentifier = function () {
  return this.peerIdentifier;
};

/**
 * The type of connection the requests will be sent over
 * @private
 * @type {module:thaliMobile.connectionTypes}
 */
PeerAction.prototype.connectionType = null;

PeerAction.prototype.getConnectionType = function () {
  return this.connectionType;
};

/**
 * The type of action that will be taken
 * @private
 * @type {string}
 */
PeerAction.prototype.actionType = null;

PeerAction.prototype.getActionType = function () {
  return this.actionType;
};

/**
 * The time in milliseconds to run the job before calling kill if there are no
 * other jobs in contention.
 * @private
 * @type {number}
 */
PeerAction.prototype.nonContentionLifeSpan = null;

PeerAction.prototype.getNonContentionLifeSpan = function () {
  return this.nonContentionLifeSpan;
};

/**
 * The time in milliseconds to run the job before calling kill if there are
 * other jobs being blocked by this job.
 * @private
 * @type {number}
 */
PeerAction.prototype.contentionLifeSpan = null;

PeerAction.prototype.getContentionLifeSpan = function () {
  return this.contentionLifeSpan;
};

/**
 * The current state of the action
 * @private
 * @type {module:thaliPeerAction.actionState}
 */
PeerAction.prototype.actionState = null;

PeerAction.prototype.getActionState = function () {
  return this.actionState;
};

/**
 * Tells the action to begin processing. When the action has completed it will
 * resolve the returned promise successfully with a null value. Once the
 * returned promise resolves then the pool MUST stop tracking this action.
 * Errors from the promise results SHOULD be logged.
 *
 * Start is idempotent so multiple calls MUST NOT directly cause a state change.
 * That is, if the action hasn't started then the first call to start will
 * start it and further calls will accomplish nothing.
 *
 * If start is called on an action that has completed, successfully or not, then
 * an error object MUST be returned with the value "action has completed."
 *
 * If the action fails due to a network issue it is important that this be
 * reported to the pool because it can use this information to decide how to
 * schedule things. The pool is expected to have subscribed for events like
 * {@link module:thaliMobile.event:networkChanged} and
 * {@link module:thaliMobile.event:discoveryAdvertisingStateUpdate} and so
 * understand when there are general connections failures. The action MUST use
 * the following error messages if the related errors occur.
 *
 * "Could not establish TCP connection" - This error indicates that the action
 * gave up because it got too many errors trying to connect over TCP to its
 * target peer.
 *
 * "Could establish TCP connection but couldn't keep it running" - In a HTTP
 * context this primarily to cases where a connection appears to exist but
 * all HTTP requests never seem to be able to successfully complete.
 *
 * When start returns the action's state MUST be STARTED.
 *
 * @public
 * @param {http.Agent}  httpAgentPool The HTTP client connection pool to
 * use when making requests to the requested peer.
 * @returns {Promise<?Error>} returns a promise that will resolve when the
 * action is done. Note that if kill is called on an action then it MUST still
 * return success with null. After all, kill doesn't reflect a failure
 * of the action but a change in outside circumstances.
 */
PeerAction.prototype.start = function (httpAgentPool) {
  this.actionState = module.exports.actionState.STARTED;
  return new Promise();
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
 * When kill returns the action's state MUST be set to KILLED.
 *
 * @public
 * @returns {?Error}
 */
PeerAction.prototype.kill = function () {
  this.actionState = module.exports.actionState.KILLED;
  return null;
};


/**
 *
 * @returns {*}
 */
PeerAction.prototype.getActionState = function () {
  return this.actionState;
};

module.exports.PeerAction = PeerAction;
