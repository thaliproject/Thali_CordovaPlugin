'use strict';
var inherits = require('util').inherits;
var Promise = require('lie');
var assert = require('assert');
var https = require('https');
var PeerAction = require('../thaliPeerPool/thaliPeerAction');
var NotificationBeacons = require('./thaliNotificationBeacons');
var EventEmitter = require('events').EventEmitter;
var thaliConfig = require('../thaliConfig');
var ThaliMobile = require('../thaliMobile');

/** @module thaliNotificationAction */

/**
 * @typedef {Object} PeerConnectionInformation
 * @property {string} hostAddress
 * @property {number} portNumber
 * @property {number} suggestedTCPTimeout timeout in milliseconds
 */

/**
 * Creates a sub-type of the {@link module:thaliPeerPoolInterface~PeerAction}
 * class to represent actions for retrieving notifications.
 *
 * @param {object} peer
 * @param {string} peer.peerIdentifier
 * @param {number} peer.generation
 * @param {module:ThaliMobileNativeWrapper.connectionTypes} peer.connectionType
 * @param {Crypto.ECDH} ecdhForLocalDevice A Crypto.ECDH object initialized
 * with the local device's public and private keys.
 * @param {addressBookCallback} addressBookCallback A callback used to validate
 * which peers we are interested in talking to.
 * @constructor
 * @implements {module:thaliPeerAction~PeerAction}
 * @fires module:thaliNotificationAction.event:Resolved
 */
/* jshint -W003 */
function ThaliNotificationAction(peer,
                                 ecdhForLocalDevice,
                                 addressBookCallback) {

  assert(peer, 'peer must not be null or undefined');
  assert(peer.peerIdentifier, 'peer.peerIdentifier must be set');
  assert(peer.connectionType, 'peer.connectionType must be set');
  assert(typeof peer.generation === 'number',
    'peer.generation must be a number');
  assert(ecdhForLocalDevice,
    'ecdhForLocalDevice must not be null or undefined');
  assert(addressBookCallback,
    'addressBookCallback must not be null or undefined');

  ThaliNotificationAction.super_.call(this, peer.peerIdentifier,
    peer.connectionType,
    ThaliNotificationAction.ACTION_TYPE,
    thaliConfig.BEACON_PSK_IDENTITY,
    thaliConfig.BEACON_KEY);

  this.eventEmitter = new EventEmitter();

  this._peerGeneration = peer.generation;
  this._ecdhForLocalDevice = ecdhForLocalDevice;
  this._addressBookCallback = addressBookCallback;

  this._peerConnection = null;
  this._httpRequest = null;
  this._resolution = null;
  this._resolve = null;
  this._reject = null;
}

/* jshint +W003 */

inherits(ThaliNotificationAction, PeerAction);

ThaliNotificationAction.prototype.getResolution = function () {
  return this._resolution;
};

ThaliNotificationAction.prototype.getPeerGeneration = function () {
  return this._peerGeneration;
};


/**
 * NotificationAction's event emitter
 *
 * @public
 * @type {EventEmitter}
 */
ThaliNotificationAction.prototype.eventEmitter = null;

/**
 * Tells the action to start processing. This action makes a HTTP GET request
 * to '/NotificationBeacons' path at a host address and a port number
 * specified in the peerIdentifier object which is passed to the constructor.
 *
 * When the action is completed it will resolve the returned promise
 * successfully with a null value. Also when the action is completed, it fires
 * {@link module:thaliNotificationAction.event:Resolved} event with a value
 * from {@link module:thaliNotificationAction~ActionResolution}.
 *
 * Error codes
 *
 * If start is called on an action that is already started then a
 * 'Only call start once' error is returned.
 *
 * If start is called on an action that has completed, successfully or not, then
 * the returned promised is resolved with an error with the value
 * 'action has completed'.
 *
 * 'Could not establish TCP connection' - DNS resolution, TCP level,
 * HTTP protocol error or network timeout causes this.
 *
 * @public
 * @param {http.Agent} httpAgentPool The HTTP client connection pool to
 * be used to establish HTTP connection to the target peer.
 * @returns {Promise<?Error>} returns a promise that will resolve when the
 * action is done. Note that if kill is called on an action then it MUST still
 * return success with null. After all, kill doesn't reflect a failure
 * of the action but a change in outside circumstances.
*/
ThaliNotificationAction.prototype.start = function (httpAgentPool) {
  var self = this;

  var p = ThaliNotificationAction.super_.prototype.start
    .call(this, httpAgentPool);

  return p
    .then(function () {
      return ThaliMobile.getPeerHostInfo(
        self.getPeerIdentifier(),
        self.getConnectionType()
      )
      .catch(function (error) {
        self._complete(ThaliNotificationAction.ActionResolution.BAD_PEER);
        return Promise.reject(error);
      });
    })
    .then(function (peerHostInfo) {
      self._peerConnection = {
        hostAddress: peerHostInfo.hostAddress,
        portNumber: peerHostInfo.portNumber,
        suggestedTCPTimeout: peerHostInfo.suggestedTCPTimeout
      };
      return new Promise(function (resolve, reject) {
        // Check if kill is called before entering into this promise
        if (self.getActionState() === PeerAction.actionState.KILLED) {
          return resolve(null);
        }

        self._resolve = resolve;
        self._reject = reject;

        var options = {
          method: 'GET',
          hostname: self._peerConnection.hostAddress,
          port: self._peerConnection.portNumber,
          path: thaliConfig.NOTIFICATION_BEACON_PATH,
          agent: httpAgentPool,
          family: 4
        };

        self._httpRequest = https.request(options,
          self._responseCallback.bind(self));

        // Error event handler is fired on DNS resolution, TCP protocol,
        // or HTTP protocol errors. Or if the httpRequest.abort is called.
        // The httpRequest is aborted when http request timeout
        // happens or the kill function is called. However abort coming
        // from kill is ignored at this point and it is not causing
        // anything in the _complete function because it is the second call to
        // _complete.
        self._httpRequest.on('error', function () {
          self._complete(
            ThaliNotificationAction.ActionResolution.NETWORK_PROBLEM,
            null, 'Could not establish TCP connection');
        });
        self._httpRequest.end();
      });
    });
};

/**
 * This synchronous function tells an action to stop executing immediately.
 * It aborts ongoing HTTP request and fires KILLED event.
 *
 * @public
 */
ThaliNotificationAction.prototype.kill = function () {
  ThaliNotificationAction.super_.prototype.kill.call(this);
  this._complete(ThaliNotificationAction.ActionResolution.KILLED);
};

/**
 * Used primarily by peer pool managers who have decided to kill this
 * notification action for a particular peerID on a particular connection
 * type in favor of a newer one.
 *
 * @public
 */
ThaliNotificationAction.prototype.killSuperseded = function () {
  ThaliNotificationAction.super_.prototype.kill.call(this);
  this._complete(
    ThaliNotificationAction.ActionResolution.KILLED_SUPERSEDED);
};

/**
 * This synchronous function returns a connection information.
 *
 * @public
 * @returns {PeerConnectionInformation}
 * Connection parameters to connect to peer.
 */
ThaliNotificationAction.prototype.getConnectionInformation = function () {
  return this._peerConnection;
};

/**
 * This callback function processes incoming HTTP response. It validates
 * that the content type is 'application/octet-stream',
 * and size of the response stays under MAX_CONTENT_SIZE.
 *
 * @private
 * @param {http.IncomingMessage} res Response object to HTTP request
 * @returns {Function} returns a function that http.request can use
 */
ThaliNotificationAction.prototype._responseCallback = function (res) {
  var self = this;
  var data = [];
  var totalReceived = 0;

  if (res.statusCode !== 200 ||
    res.headers['content-type'] !== 'application/octet-stream') {

    return self._complete(
      ThaliNotificationAction.ActionResolution.HTTP_BAD_RESPONSE);
  }

  res.on('data', function (chunk) {
    totalReceived += chunk.length;
    if (totalReceived >= ThaliNotificationAction.MAX_CONTENT_SIZE_IN_BYTES) {
      return self._complete(
        ThaliNotificationAction.ActionResolution.HTTP_BAD_RESPONSE);
    }
    data.push(chunk);
  });

  res.on('end', function () {
    var unencryptedKeyId = null;
    var buffer = Buffer.concat(data);

    try {
      // Try to parse beacons from the message body
      unencryptedKeyId = NotificationBeacons.parseBeacons(buffer,
        self._ecdhForLocalDevice, self._addressBookCallback);
    } catch (err) {
      return self._complete(
        ThaliNotificationAction.ActionResolution.BEACONS_RETRIEVED_BUT_BAD);
    }
    self._complete(
      ThaliNotificationAction.ActionResolution.BEACONS_RETRIEVED_AND_PARSED,
      unencryptedKeyId);
  });

};

/**
 * This function gets called when the HTTP response processing has been
 * completed, or HTTP request has failed at some point, or the kill
 * function is called.
 *
 * It emits the event to listeners, aborts potentially ongoing
 * HTTP client requests and resolves or rejects the promise
 * that was returned by the start function call.
 *
 * @private
 *
 * @param {ActionResolution} resolution Explains how the action was
 * was completed. This item will be emitted.
 * @param {?module:thaliNotificationBeacons~parseBeaconsResponse} beaconDetails
 * Null if none of the beacons could be validated as being targeted
 * at the local peer or if the beacon came from a remote peer the
 * local peer does not wish to communicate with. If not null then a
 * beacon has been identified to be targeted at the local peer.
 * @param {?string} error Error text which will be returned to reject
 */
ThaliNotificationAction.prototype._complete = function (resolution,
                                                        beaconDetails,
                                                        error) {
  if (!this._resolution) {
    this._resolution = resolution;
    this._httpRequest && this._httpRequest.abort();

    // Sets our state to KILLED now that we are done
    ThaliNotificationAction.super_.prototype.kill.call(this);

    this.eventEmitter.emit(
      ThaliNotificationAction.Events.Resolved,
      this,
      resolution,
      beaconDetails
    );

    if (error && this._reject) {
      this._reject(new Error(error));
    } else if (this._resolve) {
      this._resolve(null);
    }
  }
};

/**
 * Defines a maximum content size that is accepted as a response from
 * the server.
 *
 * @public
 * @readonly
 * @type {number}
 */
ThaliNotificationAction.MAX_CONTENT_SIZE_IN_BYTES = 4*1024;

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
   * A HTTP response other than 200 was returned. Or the response size exceeds
   * MAX_CONTENT_SIZE.
   */
  HTTP_BAD_RESPONSE: 'httpBadResponse',
  /**
   * Couldn't retrieve peer connection information because peer had become
   * unavailable or it has unsupported connection type
   */
  BAD_PEER: 'badPeer',
  /**
   * We weren't able to successfully create a network connection to the remote
   * peer or we were able to create a connection but we weren't able to complete
   * the beacon HTTP request.
   */
  NETWORK_PROBLEM: 'networkProblem',
  /**
   * The action was killed before it completed.
   */
  KILLED: 'killed',
  /**
   * The action was killed because it has been superseded by another
   * notification action and no further work on this action should occur.
   */
  KILLED_SUPERSEDED: 'killedSuperseded'
};

ThaliNotificationAction.Events = {
  Resolved: 'Resolved'
};

/**
 * This is the action type that will be used by instances of this class when
 * registering with {@link
  * module:thaliPeerPoolInterface~ThaliPeerPoolInterface}.
 * @type {string}
 * @readonly
 */
ThaliNotificationAction.ACTION_TYPE = 'GetRequestBeacon';

/**
 * When the action has completed this event MUST be fired. If the action
 * was able to retrieve the beacon
 *
 * @event module:thaliNotificationAction.event:Resolved
 * @param {string} peerIdentifier Action's peer identifier.
 * @param {ActionResolution} actionResolution Explains how the action was
 * completed.
 * @param {module:thaliNotificationBeacons~ParseBeaconsResponse} beacon
 * If actionResolution is BEACONS_RETRIEVED_AND_PARSED then this object will be
 * returned. If the beacons were parsed and there were no values directed at
 * this peer then the beacon object MUST be null.
 */

module.exports = ThaliNotificationAction;
