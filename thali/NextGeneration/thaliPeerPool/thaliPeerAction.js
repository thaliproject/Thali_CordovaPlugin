'use strict';

var EventEmitter = require('events').EventEmitter;

var Promise = require('lie');
var util = require('util');
var urlsafeBase64 = require('urlsafe-base64');

var logger = require('../../ThaliLogger')('thaliPeerAction');


/** @module thaliPeerAction */

/**
 * Used to give each PeerAction a unique ID to make it easier to match
 * equal ones.
 * @type {number}
 */
var peerActionCounter = 0;

/**
 * This event is emitted synchronously when action state is changed to STARTED.
 *
 * @event started
 * @public
 */

/**
 * This event is emitted synchronously when action state is changed to KILLED.
 *
 * @event killed
 * @public
 */

/**
 * An action that has been given to the pool to manage.
 *
 * When an action is created its state MUST be CREATED.
 *
 * BugBug: In a sane world we would have limits on how long an action can run
 * and we would even set up those limits as a config item. But for now we let
 * each action own the stage for as long as it would like.
 *
 * @public
 * @interface PeerAction
 * @constructor
 * @fires event:killed
 * @fires event:started
 * @param {string} peerIdentifier
 * @param {module:ThaliMobileNativeWrapper.connectionTypes} connectionType
 * @param {string} actionType
 * @param {string} pskIdentity
 * @param {Buffer} pskKey
 */
function PeerAction (peerIdentifier, connectionType, actionType, pskIdentity,
                     pskKey)
{
  EventEmitter.call(this);
  this._peerIdentifier = peerIdentifier;
  this._connectionType = connectionType;
  this._actionType = actionType;
  this._pskIdentity = pskIdentity;
  this._pskKey = pskKey;
  this._actionState = PeerAction.actionState.CREATED;
  this._id = peerActionCounter;
  ++peerActionCounter;
}

util.inherits(PeerAction, EventEmitter);

/**
 * Records the current state of the action.
 *
 * @public
 * @readonly
 * @enum {string}
 */
PeerAction.actionState = {
  /** The action has been created but hasn't started or ended yet. */
  CREATED: 'created',
  /** The action is out of the queue and is currently running */
  STARTED: 'started',
  /** The action is not running and not in the queue */
  KILLED: 'killed'
};

PeerAction.prototype.loggingDescription = function () {
  return util.format('Action ID: %d, Action Type: %s, Connection Type: %s, ' +
    'Peer Identifier: %s', this.getId(), this.getActionType(),
    this.getConnectionType(), urlsafeBase64.encode(this.getPeerIdentifier()));
};

/**
 * The remote peer this action targets
 * @private
 * @type {string}
 */
PeerAction.prototype._peerIdentifier = null;

PeerAction.prototype.getPeerIdentifier = function () {
  return this._peerIdentifier;
};

/**
 * The type of connection the requests will be sent over
 * @private
 * @type {module:ThaliMobileNativeWrapper.connectionTypes}
 */
PeerAction.prototype._connectionType = null;

PeerAction.prototype.getConnectionType = function () {
  return this._connectionType;
};

/**
 * The type of action that will be taken
 * @private
 * @type {string}
 */
PeerAction.prototype._actionType = null;

PeerAction.prototype.getActionType = function () {
  return this._actionType;
};

/**
 * The current state of the action
 * @private
 * @type {module:thaliPeerAction.actionState}
 */
PeerAction.prototype._actionState = null;

PeerAction.prototype.getActionState = function () {
  return this._actionState;
};

/**
 * The string value to use as the psk identity on any request, we need
 * this to initialize the pool agent
 * @type {string}
 * @private
 */
PeerAction.prototype._pskIdentity = null;

PeerAction.prototype.getPskIdentity = function () {
  return this._pskIdentity;
};

/**
 * The buffer to use as our pre-shared key, we need this to initialize the
 * pool agent
 * @type {Buffer}
 * @private
 */
PeerAction.prototype._pskKey = null;

PeerAction.prototype.getPskKey = function () {
  return this._pskKey;
};

/**
 * A unique ID that can be used to identify this instance. This allows us to
 * easily look up instances.
 * @type {number}
 */
PeerAction.prototype._id = null;

PeerAction.prototype.getId = function () {
  return this._id;
};

/**
 * Tells the action to begin processing. When the action has completed it will
 * resolve the returned promise successfully with a null value. Once the
 * returned promise resolves then the pool MUST stop tracking this action.
 * Errors from the promise results SHOULD be logged.
 *
 * Start is not idempotent. The first call to start will start the action and
 * any further calls to start if start has not yet finished MUST return a 'Only
 * call start once' error.
 *
 * If start is called on an action that has completed, successfully or not, then
 * the returned promised must be resolved with an error object MUST with the
 * value "action has completed".
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
  this._httpAgentPool = httpAgentPool;
  switch (this._actionState) {
    case PeerAction.actionState.CREATED: {
      this._actionState = PeerAction.actionState.STARTED;
      this.emit('started');
      return Promise.resolve();
    }
    case PeerAction.actionState.STARTED: {
      return Promise.reject(new Error(PeerAction.DOUBLE_START));
    }
    case PeerAction.actionState.KILLED: {
      return Promise.reject(new Error(PeerAction.START_AFTER_KILLED));
    }
    default: {
      throw new Error('Action State is in illegal value ' + this._actionState);
    }
  }
};

/**
 * Error message returned when start called twice in a row
 * @type {string}
 * @readonly
 */
PeerAction.DOUBLE_START = 'Only call start once';

/**
 * Error message returned when start is called after kill
 * @type {string}
 * @readonly
 */
PeerAction.START_AFTER_KILLED = 'action has completed';

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
 * It's fine to call kill on an action that has been submitted to a peer pool.
 * When the action is enqueued the peer pool will override the action's kill
 * method with its own kill method that will then call this kill method.
 *
 * @public
 * @returns {?Error}
 */
PeerAction.prototype.kill = function () {
  if (this._httpAgentPool) {
    if (typeof this._httpAgentPool.destroy === 'function') {
      this._httpAgentPool.destroy();
    } else {
      logger.debug('we couldn\'t destroy http agent explicitly');
    }
    this._httpAgentPool = null;
  }

  if (this._actionState !== PeerAction.actionState.KILLED) {
    this._actionState = PeerAction.actionState.KILLED;
    this.emit('killed');
  }
  return null;
};

PeerAction.prototype.waitUntilKilled = function () {
  return Promise.resolve();
};

module.exports = PeerAction;
