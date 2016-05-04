'use strict';

var logger = require('../../thalilogger')('localSeqManager');
var Promise = require('lie');
var https = require('https');
var thaliConfig = require('../thaliConfig');
var thaliNotificationBeacons = require('../notification/thaliNotificationBeacons');
var urlsafeBase64 = require('urlsafe-base64');

function LocalSeqManager(maximumUpdateInterval,
                         remotePouchDB, ourPublicKey) {
  this._maximumUpdateInterval = maximumUpdateInterval;
  this._remotePouchDB = remotePouchDB;

  var ourPublicKeyHash =
    urlsafeBase64.encode(
      thaliNotificationBeacons.createPublicKeyHash(ourPublicKey));

  this._localId = '/_local/thali_' + this._ourPublicKeyHash;

  this._lastUpdate = 0;
  this._cancelTimeoutToken = null;
  this._seqDocRev = null;
  this._currentHttpRequest = null;
  this._nextSeqValueToSend = -1;
}

/*
 To grab the seq document we first have to do a get if we haven't gotten its
 rev before. If the seq doesn't exist on the remote db then we will get a
 catch on the get with a 'status' set to 404. Otherwise we can pull
 '_rev' out of the successfull response.
 */

/*
 If we haven't yet created a timer for write seq then we should immediately
 fire off a GET request to see if we have ever written to this DB before and
 then use the result to first off a PUT. This should all be wrapped in a
 promise so we can make sure to serialize our next action.

 We would then start a timer

 So the logic goes:
 If we haven't sent an update in longer than the allowed interval then
 immediately fire off an update
 */


//This will take a sequence and first see if it's time to send a new
//sequence. If not it will just update the sequence we want to write out
//and return. When time is up we will do the PUT. But I don't think we
//should fail if there is an error, so long as we can pull down data
//its good.
//This function returns a promise that will resolve when this particular
//write request is done.
//If kill is called we have to find all the outstanding promises and nuke
//them.

LocalSeqManager.prototype._setRemoteLastSeqDoc = function () {
  return new Promise(function (resolve, reject) {
    // Has to write rev to seqDocRev
    // Has to swallow any errors and log them
    // It has to deal with cases where it has the wrong rev ID and retry
    // But we have to make sure that we limit the get to once and then give up
    // Has to update _lastUpdate;
    // This sends _nextSeqValueToSend
  });
};

LocalSeqManager.prototype._doImmediateSeqUpdate = function () {
  var self = this;

  function getRevOrNull() {
    return self._remotePouchDB.get(self._localId)
      .catch(function (err) {
        if (err.status === 404) {
          return null;
        }
        return Promise.reject(err);
      })
      .then(function (response) {
        return response._rev;
      });
  }

  return (self._seqDocRev ? Promise.resolve(self._seqDocRev) : getRevOrNull())
    .then(function (rev) {

    });

};

LocalSeqManager.prototype.update = function (seq, immediate) {
  var self = this;

  if (seq <= this._nextSeqValueToSend) {
    logger.debug('Got a bad seq, submitted seq ' + seq +
      ', _nextSeqValueToSend: ' + this._nextSeqValueToSend);
    return;
  }


  self._nextSeqValueToSend = seq;
  if (immediate ||
      Date.now() - self._lastUpdate >= self._maximumUpdateInterval) {
    self._doImmediateSeqUpdate();
    return;
  }

  !self._cancelTimeoutToken && setTimeout(function () {
    self._doImmediateSeqUpdate();
  }, Date.now() - self._lastUpdate > self._maximumUpdateInterval ?
      self._maximumUpdateInterval : Date.now() - self._lastUpdate);
};
