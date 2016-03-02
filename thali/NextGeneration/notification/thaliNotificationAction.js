'use strict';
var ThaliMobile = require('../thaliMobile');
var ThaliPeerAction = require('../thaliPeerPool/thaliPeerAction');
var inherits = require('util').inherits;

/** @module thaliNotificationAction */

/**
 * Creates a sub-type of the {@link module:thaliPeerPoolInterface~PeerAction}
 * class to represent actions for retrieving notifications. We MUST default
 * ActionState to queued. We are explicitly assuming that all created actions
 * will be added to the queue.
 *
 * @param {string} peerIdentifier
 * @param {module:thaliMobile.connectionTypes} connectionType
 * @param {Crypto.ECDH} ecdhForLocalDevice A Crypto.ECDH object initialized
 * with the local device's public and private keys.
 * @param {addressBookCallback} addressBookCallback An object used to validate
 * which peers we are interested in talking to.
 * @constructor
 * @implements {module:thaliPeerAction~PeerAction}
 * @fires module:thaliNotificationAction.event:Resolved
 */
/* jshint -W003 */
function ThaliNotificationAction(peerIdentifier, connectionType,
                            ecdhForLocalDevice, addressBookCallback) {

  ThaliNotificationAction.super_.call(this, peerIdentifier, connectionType,
    ThaliNotificationAction.ACTION_TYPE);

  this._ecdhForLocalDevice = ecdhForLocalDevice;
  this._addressBookCallback = addressBookCallback;

}
/* jshint +W003 */

inherits(ThaliNotificationAction, ThaliPeerAction);

/**
 * This is the action type that will be used by instances of this class when
 * registering with {@link
  * module:thaliPeerPoolInterface~ThaliPeerPoolInterface}.
 * @type {string}
 * @readonly
 */
ThaliNotificationAction.ACTION_TYPE = 'GetRequestBeacon';

/**
 * Once started we MUST make a HTTP GET request to
 * http://[hostAddress]:[portNumber]/NotificationBeacons. Make sure to set the
 * TCP/IP timeout using suggestedTCPTimeout.
 *
 * The logic for the GET request MUST asynchronous read the response to the
 * GET request and ensure that it is not beyond a prefixed maximum size. Note
 * that node does not validate that the length of a response body and the
 * content-length header match so we MUST read the response in chunks
 * asynchronously and if the total data read exceeds our predefined limit
 * then we MUST abort the request object.
 *
 * If we do get a successful beacon response then we MUST submit the beacon
 * stream along with ecdhForLocalDevice and addressBookCallback to the {@link
 * module:thaliNotificationBeacons.parseBeacons} method.
 *
 * When completed fire
 * {@link module:thaliNotificationAction.event:Resolved} with
 * whatever value makes the most sense.
 *
 * Note that if we receive a kill method while waiting for the response then we
 * MUST call abort the HTTP request, set our ActionState to KILLED and fire off
 * a Resolved event.
 *
 * __Open Issue:__ Is abort truly synchronous? In other words is it ever
 * possible to call abort, get back a response and then still have the response
 * object show up? I should hope not.
 */
ThaliNotificationAction.prototype.start = function () {

};

/**
 * In addition to the inherited behavior also make sure to fire the
 * {@link module:thaliNotificationAction.event:Resolved}
 * event.
 */
ThaliNotificationAction.prototype.kill = function () {

};

/**
 * Records the final outcome of the action.
 *
 * @readonly
 * @enum {string}
 */
ThaliNotificationAction.ActionResolution = {
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
 * @event module:thaliNotificationAction.event:Resolved
 * @param {ActionResolution} actionResolution Explains how the action was
 * completed.
 * @param {module:thaliNotificationBeacons~ParseBeaconsResponse} beacon
 * If actionResolution is BEACONS_RETRIEVED_AND_PARSED then this object will be
 * returned. If the beacons were parsed and there were no values directed at
 * this peer then the beacon object MUST be null.
 */

module.exports = ThaliNotificationAction;
