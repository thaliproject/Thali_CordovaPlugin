'use strict';

/** @module thaliNotificationAction */


/**
 * Creates a sub-type of the {@link module:thaliPeerPoolInterface~PeerAction}
 * class to represent actions for retrieving notifications.
 *
 * @param {string} peerIdentifier
 * @param {module:thaliMobile.connectionTypes} connectionType
 * @param {string} actionType
 * @constructor
 * @implements {module:thaliPeerPoolInterface~PeerAction}
 * @fires module:thaliNotificationAction~NotificationAction.event:Resolved
 */
function NotificationAction(peerIdentifier, connectionType, actionType) {
  this.actionState = NotificationAction.ActionState.QUEUED;
}

/**
 * When start is called for the first time the actionState MUST be set to
 * STARTED.
 *
 * Once started we MUST make a HTTP GET request to
 * http://[hostAddress]:[portNumber]/NotificationBeacons. Make sure to set the
 * TCP/IP timeout using suggestedTCPTimeout.
 *
 * If we do get a successful beacon response then we MUST submit the beacon
 * stream along with ecdhForLocalDevice and addressBookCallback to the {@link
 * module:thaliNotificationBeacons.parseBeacons} method on an instance of {@link
 * module:thaliNotificationBeacons} that we have created locally.
 *
 * Handle the results from above per {@link
 * module:thaliNotificationAction~ThaliNotificationAction.event:ActionState}.
 * Note that if we receive a kill method while waiting for the response then we
 * MUST call abort on the request, set our ActionState to KILLED and fire off a
 * Resolved event.
 *
 * __Open Issue:__ Is abort truly synchronous? In other words is it ever
 * possible to call abort, get back a response and then still have the response
 * object show up? I should hope not.
 */
NotificationAction.prototype.start = function () {

};

/**
 * If the action's state is enqueued then this call MUST result in it being
 * removed from the peer pool queue.
 *
 * If the action's state is waiting then the timer MUST be killed and no further
 * action taken.
 *
 * If the action's state is inProgress then any in flight HTTP requests MUST
 * be terminated and the peer pool's FinishedEnqueueCallback called.
 */
NotificationAction.prototype.kill = function () {

};

/**
 * Records the current state of the action.
 *
 * @readonly
 * @enum {{QUEUED: string, STARTED: string, KILLED: string}}
 */
NotificationAction.ActionState = {
  /** The action is in the peer pool's queue */
  QUEUED: 'queued',
  /** The action is out of the queue and is currently running */
  STARTED: 'started',
  /** The action is not running and not in the queue */
  KILLED: 'killed'
};

NotificationAction.prototype.getActionState = function () {
  return this.actionState;
};

/**
 * Records the final outcome of the action.
 *
 * @readonly
 * @enum {{BEACONS_RETRIEVED: string, NETWORK_PROBLEM: string, KILLED: string}}
 */
NotificationAction.ActionResolution = {
  /**
   * The beacon values were successfully retrieved and parsed.
   */
  BEACONS_RETRIEVED_AND_PARSED: 'beaconsRetrievedAndParsed',
  /**
   * A connection was successfully created to the remote peer and a HTTP request
   * was successfully delivered and responded to with a 200 but the beacons
   * were not parsable.
   */
  BEACONS_RETRIEVED_BUT_BAD: 'beaconsRetrievedButBad',
  /**
   * A HTTP response other than 200 was returned.
   */
  HTTP_BAD_RESPONSE: 'httpBadResponse',
  /**
   * We weren't able to successfully create a network connection to the remote
   * peer or we were able to create a connection but we weren't able to complete
   * the beacon HTTP request.
   */
  NETWORK_PROBLEM: 'networkProblem',
  /**
   * The action was killed before it completed.
   */
  KILLED: 'killed'
};

/**
 * When the action has completed this event MUST be fired. If the action
 * was able to retrieve the beacon
 *
 * @event module:thaliNotificationAction~NotificationAction.event:Resolved
 * @param {ActionResolution} actionResolution Explains how the action was
 * completed.
 * @param {module:thaliNotificationBeacons~ParseBeaconsResponse} beacon If
 * actionResolution is BEACONS_RETRIEVED_AND_PARSED then this object will be
 * returned. If the beacons were parsed and there were no values directed at
 * this peer then the beacon object MUST be null.
 */


module.exports = NotificationAction;
