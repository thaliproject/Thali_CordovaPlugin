'use strict';

var logger = require('../../thalilogger')('localSeqManager');
var Promise = require('lie');
var https = require('https');
var thaliConfig = require('../thaliConfig');
var thaliNotificationBeacons = require('../notification/thaliNotificationBeacons');
var urlsafeBase64 = require('urlsafe-base64');

function LocalSeqManager(maximumUpdateInterval,
                         hostName, port, dbName, ourPublicKey, agentPool) {
  this._maximumUpdateInterval = maximumUpdateInterval;
  this._hostName = hostName;
  this._port = port;
  this._dbName = dbName;
  this._ourPublicKeyHash =
    urlsafeBase64.encode(
      thaliNotificationBeacons.createPublicKeyHash(ourPublicKey));
  this._agentPool = agentPool;

  this._lastUpdate = 0;
  this._cancelTimeoutToken = null;
  this._nextActionPromise = null;
  this._seqDocRev = null;
  this._currentHttpRequest = null;
  this._nextSeqValueToSend = null;
}

LocalSeqManager.prototype._baseHttpsRequestOptions = function (method,
                                                               contentType) {
  var options = {
    agent: this._agentPool,
    hostname: this._hostName,
    family: 4,
    method: method,
    port: this._port,
    path: thaliConfig.BASE_DB_PATH + '/' + this._dbName + '/_local/thali_' + 
          this._ourPublicKeyHash
  };
  if (contentType) {
    options.headers = { 'Content-Type': contentType};
  }
  return options;
};

LocalSeqManager.prototype._getRemoteLastSeqDoc = function () {
  var self = this;
  return new Promise(function (resolve, reject) {
    self._currentHttpRequest =
      https.request(self._baseHttpsRequestOptions('GET'));

    var currentData = new Buffer(0);
    var error = false;

    self._currentHttpRequest.on('response', function (res) {
      res.on('data', function (data) {
        Buffer.concat([currentData, data]);
      });
      res.on('error', function (err) {
        logger.debug('Got error in _getRemoteLastSeqDoc response - ' +
          JSON.stringify(err));
        error = true;
        reject(err);
      });
      res.on('close', function () {
        if (error) {
          return;
        }

        if (res.statusCode !== 200) {
          return reject(new Error('Did not get status code 200, got ' +
            res.statusCode));
        }

        try {
          var seqDoc = JSON.parse(currentData.toString('utf8'));
          if (!seqDoc._rev) {
            return reject(new Error('Did not get a rev'));
          }
          self._seqDocRev = seqDoc._rev;
          return resolve();
        } catch (err) {
          return reject(err);
        }
      });
    });
    self._currentHttpRequest.on('error', function (err) {
      error = true;
      return reject('Got error in _getRemoteLastSeqDoc request - ' + err);
    });
    self._currentHttpRequest.end();
  });
};

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
  this._cancelTimeoutToken && clearTimeout(this._cancelTimeoutToken);
  this._cancelTimeoutToken = null;
  this._currentHttpRequest && this._currentHttpRequest.abort();
  this._currentHttpRequest = null;
  (this._seqDocId ? Promise.resolve() : this._getRemoteLastSeqDoc)
    .then(function () {
      return this._setRemoteLastSeqDoc();
    })
    .catch(function (err) {

    });
};

LocalSeqManager.prototype.update = function (seq, immediate) {
  var self = this;
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
