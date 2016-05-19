'use strict';

var logger = require('../../thalilogger')('localSeqManager');
var Promise = require('lie');
var https = require('https');
var thaliConfig = require('../thaliConfig');
var thaliNotificationBeacons = require('../notification/thaliNotificationBeacons');
var urlsafeBase64 = require('urlsafe-base64');

/**
 * Handles updating the remote sequence number for Thali's distributed
 * replication protocol, see
 * http://thaliproject.org/ReplicationAcrossDiscoveryProtocol/
 * for details.
 * @param {number} maximumUpdateInterval Number of miliseconds to wait before
 * sending another update
 * @param {PouchDB} remotePouchDB The PouchDB object we should use to access
 * the remote peer
 * @param {Buffer} ourPublicKey The buffer containing our ECDH public key
 * @constructor
 */
function LocalSeqManager(maximumUpdateInterval,
                         remotePouchDB, ourPublicKey) {
  this._maximumUpdateInterval = maximumUpdateInterval;
  this._remotePouchDB = remotePouchDB;

  var ourPublicKeyHash =
    urlsafeBase64.encode(
      thaliNotificationBeacons.createPublicKeyHash(ourPublicKey));

  this._localId = '_local/thali_' + ourPublicKeyHash;

  this._lastUpdateTime = 0;
  this._stopCalled = false;

  this._cancelTimeoutToken = null;
  this._seqDocRev = null;

  // We use this to serialize requests so we don't have puts trying to run
  // over each other's revs and causing update failures
  this._currentUpdateRequest = Promise.resolve();
  this._nextSeqValueToSend = -1;
}

/**
 * Figures out the rev for the remote sequence doc in local and then updates it
 * with the supplied value.
 * @param {number} seq Value to update lastSyncedSequenceNumber to
 * @returns {Promise<string|Error>} Returns the rev that we got when we
 * successfully updated the doc (this is really just for testing) or
 * returns an Error object
 * @private
 */
LocalSeqManager.prototype._doImmediateSeqUpdate = function (seq) {
  var self = this;

  if (self._stopCalled) {
    return Promise.reject(new Error('Stop Called'));
  }

  self._lastUpdateTime = Date.now();

  function getRevOrNull() {
    return self._remotePouchDB.get(self._localId)
      .then(function (response) {
        return response._rev;
      })
      .catch(function (err) {
        if (err.status === 404) {
          return null;
        }
        return Promise.reject(err);
      });
  }

  return (self._seqDocRev ? Promise.resolve(self._seqDocRev) : getRevOrNull())
    .then(function (rev) {
      if (self._stopCalled) {
        var error = new Error('Stop Called');
        error.onPut = true; // Helps testing
        return Promise.reject(error);
      }
      return self._remotePouchDB.put({
          lastSyncedSequenceNumber: seq
        }, self._localId, rev);
    })
    .then(function (putResponse) {
      self._seqDocRev = putResponse.rev;
      return self._seqDocRev;
    })
    .catch(function (err) {
      logger.debug('Got an error trying to update seq ' + JSON.stringify(err));
      return Promise.reject(err);
    });
};

/**
 * Instructs the system to update lastSyncedSequenceNumber on the remote
 * machine. By default we will only push out an update no more than every
 * maximumUpdateInterval as provided on the constructor unless immediate is set
 * to true.
 *
 * @param {number} seq Value to update lastSyncedSequenceNumber to
 * @param {boolean} immediate If true we should update the sequence number
 * immediately even if the normally required wait interval hasn't passed
 * @returns {Promise<Null|Error>} Returns null if the updated request is
 * succesfull otherwise an error.
 */
LocalSeqManager.prototype.update = function (seq, immediate) {
  var self = this;

  if (self._stopCalled) {
    return Promise.reject(new Error('Stop Called'));
  }

  if (seq <= this._nextSeqValueToSend) {
    logger.debug('Got a bad seq, submitted seq ' + seq +
      ', _nextSeqValueToSend: ' + this._nextSeqValueToSend);
    return Promise.reject(new Error('Bad Seq'));
  }

  self._nextSeqValueToSend = seq;

  var millisecondsSinceLastUpdate = Date.now() - self._lastUpdateTime;

  if (immediate ||
      millisecondsSinceLastUpdate >= self._maximumUpdateInterval) {
    clearTimeout(self._cancelTimeoutToken);
    self._cancelTimeoutToken = null;
    return self._currentUpdateRequest
      .catch(function () {
        // We don't care if there is an error, we are going to continue on
        // We rely on the replication logic run in parallel with this logic
        // to detect when we have lost contact with a peer
      })
      .then(function () {
        self._currentUpdateRequest = self._doImmediateSeqUpdate(seq);
        return self._currentUpdateRequest;
      })
      .then(function () {
        return null;
      })
  }

  if (!self._cancelTimeoutToken) {
    return new Promise(function (resolve, reject) {
      self._cancelTimeoutToken = setTimeout(function () {
        self._cancelTimeoutToken = null;
        self._currentUpdateRequest = self._doImmediateSeqUpdate(seq);
        self._currentUpdateRequest
          .then(function () {
            resolve(null);
          })
          .catch(function (err) {
            reject(err);
          });
      }, self._maximumUpdateInterval - millisecondsSinceLastUpdate);
    });
  }


};

/**
 * Terminate any further operations.
 */
LocalSeqManager.prototype.stop = function () {
  this._stopCalled = true;
  clearTimeout(this._cancelTimeoutToken);
};

module.exports = LocalSeqManager;
