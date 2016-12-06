'use strict';

var logger = require('../../ThaliLogger')('localSeqManager');
var Promise = require('lie');
var assert = require('assert');
var urlSafeBase64 = require('urlsafe-base64');
var thaliConfig = require('../thaliConfig');

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

  var outBase64PublicKeyHash =
    urlSafeBase64.encode(ourPublicKey);

  this._localId = '_local/' + thaliConfig.LOCAL_SEQ_POINT_PREFIX +
        outBase64PublicKeyHash;

  this._lastUpdateTime = 0;
  this._stopCalled = false;

  this._cancelTimeoutToken = null;
  this._timerPromise = null;
  this._timerReject = null;
  this._seqDocRev = null;

  // We use this to serialize requests so we don't have puts trying to run
  // over each other's revs and causing update failures
  this._currentUpdateRequest = Promise.resolve();
  this._blockedUpdateRequest = null;
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

  if (this._stopCalled) {
    return Promise.reject(new Error('Stop Called'));
  }

  self._lastUpdateTime = Date.now();

  function getLocalIdRevOrNull() {
    if (self._seqDocRev) {
      return Promise.resolve(self._seqDocRev);
    }
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

  return getLocalIdRevOrNull()
    .then(function (rev) {
      if (self._stopCalled) {
        var error = new Error('Stop Called');
        error.onPut = true; // Helps testing
        return Promise.reject(error);
      }
      return self._remotePouchDB.put({
        _id: self._localId,
        _rev: rev,
        lastSyncedSequenceNumber: seq
      });
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
 * to true. We also won't push out an update until we get confirmation that
 * any previous updates have been processed, this prevents race conditions
 * where the sequence number can end up wrong along with the rev we have
 * to track for the remote doc (we have to have that rev in order to push an
 * update).
 *
 * @param {number} seq Value to update lastSyncedSequenceNumber to
 * @param {boolean} [immediate] If true we should update the sequence number
 * immediately even if the normally required wait interval hasn't passed
 * @returns {Promise<Null|Error>} Returns null if the updated request is
 * successful otherwise an error.
 */
LocalSeqManager.prototype.update = function (seq, immediate) {
  var self = this;

  if (this._stopCalled) {
    return Promise.reject(new Error('Stop Called'));
  }

  function cancelTimer(reject) {
    clearTimeout(self._cancelTimeoutToken);
    self._cancelTimeoutToken = null;
    self._timerPromise = null;
    reject && self._timerReject &&
      self._timerReject(new Error('Timer Cancelled'));
    self._timerReject = null;
  }

  function runUpdate() {
    self._blockedUpdateRequest = new Promise(function (resolve, reject) {
      return self._currentUpdateRequest
        .catch(function () {
          // We don't care if the current request ended in an error, we depend
          // on the replication logic to handle errors, we will continue to
          // send updates.
        })
        .then(function () {
          self._blockedUpdateRequest = null;
          self._currentUpdateRequest =
            self._doImmediateSeqUpdate(self._nextSeqValueToSend);
          return self._currentUpdateRequest;
        })
        .then(function (result) {
          resolve(result);
        })
        .catch(function (err) {
          reject(err);
        });
    });
    return self._blockedUpdateRequest ? self._blockedUpdateRequest :
            self._currentUpdateRequest;
  }

  if (seq <= self._nextSeqValueToSend) {
    logger.debug('Got a bad seq, submitted seq ' + seq +
      ', _nextSeqValueToSend: ' + self._nextSeqValueToSend);
    return Promise.reject(new Error('Bad Seq'));
  }

  self._nextSeqValueToSend = seq;

  if (self._blockedUpdateRequest) {
    return self._blockedUpdateRequest;
  }

  var millisecondsUntilNextUpdate = self._maximumUpdateInterval -
    (Date.now() - self._lastUpdateTime);

  if (immediate || millisecondsUntilNextUpdate <= 0) {
    cancelTimer(true);
    return runUpdate()
      .then(function () {
        return null;
      });
  }

  if (!self._cancelTimeoutToken) {
    self._timerPromise = new Promise(function (resolve, reject) {
      self._timerReject = reject;
      self._cancelTimeoutToken = setTimeout(function () {
        cancelTimer(false);
        runUpdate()
          .then(function () {
            resolve(null);
          })
          .catch(function (err) {
            reject(err);
          });
      }, millisecondsUntilNextUpdate);
    });
  }

  assert(self._timerPromise, 'We should not get here without a non-null ' +
    'timer promise');
  return self._timerPromise;
};

/**
 * Terminate any further operations.
 * @returns {null} null
 */
LocalSeqManager.prototype.stop = function () {
  this._stopCalled = true;
  clearTimeout(this._cancelTimeoutToken);
  if (this._timerReject) {
    this._timerReject(new Error('Timer Cancelled'));
  }
  return null;
};

LocalSeqManager.prototype.waitUntilStopped = function () {
  // We have just killed all requests.
  // We don't care if any request will end with an error.

  var promises = [];
  if (this._blockedUpdateRequest) {
    promises.push(
      this._blockedUpdateRequest
      .catch(function () {})
    );
  } else if (this._currentUpdateRequest) {
    promises.push(
      this._currentUpdateRequest
      .catch(function () {})
    );
  }

  if (this._timerPromise) {
    promises.push(
      this._timerPromise
      .catch(function () {})
    );
  }

  return Promise.all(promises);
};

module.exports = LocalSeqManager;
