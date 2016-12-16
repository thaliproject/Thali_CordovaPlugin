'use strict';

var Promise = require('lie');
var util = require('util');
var path = require('path');
var ThaliPeerAction = require('../thaliPeerPool/thaliPeerAction');
var actionState = ThaliPeerAction.actionState;
var assert = require('assert');
var thaliConfig = require('../thaliConfig');
var logger = require('../../ThaliLogger')('thaliReplicationPeerAction');
var LocalSeqManager = require('./localSeqManager');
var RefreshTimerManager = require('./utilities').RefreshTimerManager;
var Utils = require('../utils/common.js');

/** @module thaliReplicationPeerAction */

/* eslint-disable max-len */
/**
 * @classdesc Manages replicating information with a peer we have discovered
 * via notifications.
 *
 * @param {module:thaliNotificationClient.event:peerAdvertisesDataForUs} peerAdvertisesDataForUs
 * The notification that triggered this replication. This gives us the
 * information we need to create a connection as well the connection type we
 * need for the base class's constructor.
 * @param {PouchDB} PouchDB The PouchDB class constructor we are supposed to
 * use.
 * @param {string} dbName The name of the DB we will use both for local use as
 * well as remote use. Note that we will get the name for the remote database by
 * taking dbName and appending it to http://[hostAddress]:[portNumber]/[BASE_DB_PATH]/
 * [name] where hostAddress and portNumber are from the peerAdvertisesDataForUs
 * argument.
 * @param {Buffer} ourPublicKey The buffer containing our ECDH public key
 * @constructor
 */
function ThaliReplicationPeerAction(peerAdvertisesDataForUs,
                                    PouchDB,
                                    dbName,
                                    ourPublicKey) {
/* eslint-enable max-len */
  assert(ThaliReplicationPeerAction.MAX_IDLE_PERIOD_SECONDS * 1000 -
    ThaliReplicationPeerAction.PUSH_LAST_SYNC_UPDATE_MILLISECONDS >
    1000, 'Need at least a seconds worth of clearance to make sure ' +
    'that at least one sync update will have gone out before we time out.');
  assert(peerAdvertisesDataForUs, 'there must be peerAdvertisesDataForUs');
  assert(PouchDB, 'there must be PouchDB');
  assert(dbName, 'there must be dbName');
  assert(ourPublicKey, 'there must be an ourPublicKey');

  ThaliReplicationPeerAction.super_.call(this, peerAdvertisesDataForUs.keyId,
    peerAdvertisesDataForUs.connectionType,
    ThaliReplicationPeerAction.ACTION_TYPE,
    peerAdvertisesDataForUs.pskIdentifyField,
    peerAdvertisesDataForUs.psk);

  this._peerAdvertisesDataForUs = peerAdvertisesDataForUs;
  this._PouchDB = PouchDB;
  this._dbName = dbName;
  this._ourPublicKey = ourPublicKey;
  this._localSeqManager = null;
  this._cancelReplication = null;
  this._resolve = null;
  this._reject = null;
  this._refreshTimerManager = null;
  this._completed = false;
}

util.inherits(ThaliReplicationPeerAction, ThaliPeerAction);

/**
 * The actionType we will use when calling the base class's constructor.
 *
 * @public
 * @readonly
 * @type {string}
 */
ThaliReplicationPeerAction.ACTION_TYPE = 'ReplicationAction';

/**
 * The number of seconds we will wait for an existing live replication to have
 * no changes before we terminate it.
 *
 * @public
 * @readonly
 * @type {number}
 */
ThaliReplicationPeerAction.MAX_IDLE_PERIOD_SECONDS = 3;

/**
 * The number of milliseconds to wait between updating `_Local/<peer ID>` on the
 * remote machine. See
 * http://thaliproject.org/ReplicationAcrossDiscoveryProtocol/.
 *
 * @public
 * @readonly
 * @type {number}
 */
ThaliReplicationPeerAction.PUSH_LAST_SYNC_UPDATE_MILLISECONDS = 200;

ThaliReplicationPeerAction.prototype.getPeerAdvertisesDataForUs = function () {
  return this._peerAdvertisesDataForUs;
};

/**
 * Creates a new replication action with the same constructor arguments as
 * this replication action.
 * @public
 * @returns {ThaliReplicationPeerAction}
 */
ThaliReplicationPeerAction.prototype.clone = function () {
  return new ThaliReplicationPeerAction(this._peerAdvertisesDataForUs,
    this._PouchDB, this._dbName, this._ourPublicKey);
};

/**
 * The replication timer is needed because by default we do live replications
 * which will keep a connection open to the remote server and send heartbeats
 * to keep things going. This means that our timers at lower levels in our
 * stack will see 'activity' and so won't time out a connection that isn't
 * actually doing useful work. This timer however is connected directly to the
 * changes feed and so can see if 'useful' work is happening and time out if it
 * is not.
 * @private
 */
ThaliReplicationPeerAction.prototype._replicationTimer = function () {
  var self = this;
  if (self._refreshTimerManager) {
    self._refreshTimerManager.stop();
  }
  self._refreshTimerManager = new RefreshTimerManager(
    ThaliReplicationPeerAction.MAX_IDLE_PERIOD_SECONDS * 1000,
    function() {
      self._complete([new Error('No activity time out')]);
    });
  self._refreshTimerManager.start();
};

/* eslint-disable max-len */
/**
 * When start is called we will start a replication with the remote peer using
 * the settings specified below. We will need to create the URL using the
 * hostAddress and portNumber from peerAdvertisesDataForUs. Also make sure to
 * set skip_setup to true.
 *
 * If we get an error that the database doesn't exist on the remote machine that
 * is fine, we're done. Although we should log a low priority error that we
 * tried to get to a database that doesn't exist. DO NOT log the peer ID.
 *
 * We then need to use db.replication.to with the remoteDB using the URL
 * specified in the constructor. This will be the local DB we will copy to. We
 * need to do things this way so we can set the AJAX options for PSK. We also
 * need to set both options.retry and options.live to true. See the changes
 * event below for some of the implications of this.
 *
 * We must hook these events from the replication object.
 *
 * paused - We need to log this with a very low priority log value just for
 * debugging purposes. But certainly nothing that would be recorded in
 * production.
 *
 * active - Log per the previous.
 *
 * denied - This is a genuine error, it should never happen so log with high
 * priority so we can investigate. Again, don't include any identifying
 * information, not even the DB name. It's a hint.
 *
 * complete - Return resolve(); if there was no error otherwise return Reject()
 * with an Error object with the string that either matches one of the {@link
 * module:thaliPeerAction~ThaliPeerAction.start} error strings or else something
 * appropriate. Even if there is an error we should always do a final write to
 * `_Local/<peer ID>` with the last_seq in the info object passed to complete.
 *
 * error - Log with reasonably high priority but with no identifying
 * information. Otherwise take no further action as the complete event should
 * also fire and we'll handle things there.
 *
 * __OPEN ISSUE:__ We actually need to investigate what kinds of err values come
 * back in order to determine if we can figure out if it was a connection error.
 * This is important for the thread pool to know. See the errors defined on
 * {@link module:thaliPeerAction~PeerAction.start}.
 *
 * change - If we don't see any changes on the replication for {@link
 * module:thaliReplicationPeerAction~ThaliReplicatonPeerAction.MAX_IDLE_PERIOD_SECONDS}
 * seconds then we will end the replication. The output from this event also
 * provides us with the current last_seq we have synch'd from the remote peer.
 * Per http://thaliproject.org/ReplicationAcrossDiscoveryProtocol/ we need to
 * update the remote `_Local/<peer ID>` document every {@link
 * module:thaliReplicationPeerAction~ThaliReplicationPeerAction.PUSH_LAST_SYNC_UPDATE_MILLISECONDS}
 *
 * Make sure to keep the cancel object returned by the replicate call. Well
 * need it for kill.
 *
 * @param {http.Agent} httpAgentPool This is the HTTP connection pool to use
 * when creating HTTP requests related to this action. Note that this is where
 * the PSK related settings are specified.
 * @returns {Promise<?Error>}
 */
ThaliReplicationPeerAction.prototype.start = function (httpAgentPool) {
/* eslint-enable max-len */
  var self = this;
  this._completed = false;

  return ThaliReplicationPeerAction.super_.prototype.start
    .call(this, httpAgentPool)
    .then(function () {
      var remoteUrl = 'https://' + self._peerAdvertisesDataForUs.hostAddress +
        ':' + self._peerAdvertisesDataForUs.portNumber +
        path.join(thaliConfig.BASE_DB_PATH, self._dbName);
      var ajaxOptions = {
        ajax : {
          agent: httpAgentPool
        },
        skip_setup: true// jscs:ignore requireCamelCaseOrUpperCaseIdentifiers
      };

      var remoteDB = new self._PouchDB(remoteUrl, ajaxOptions);
      self._localSeqManager = new LocalSeqManager(
        ThaliReplicationPeerAction.PUSH_LAST_SYNC_UPDATE_MILLISECONDS,
        remoteDB, self._ourPublicKey);
      self._replicationPromise = new Promise(function (resolve, reject) {
        self._resolve = resolve;
        self._reject = reject;
        self._replicationTimer();
        self._cancelReplication = remoteDB.replicate.to(self._dbName, {
          live: true
        })
        .on('paused', function (err) {
          logger.debug(
            'Got paused with - ',
            Utils.serializePouchError(err)
          );
        })
        .on('active', function () {
          logger.debug('Replication resumed');
        })
        .on('denied', function (err) {
          logger.warn(
            'We got denied on a PouchDB access, this really should ' +
            'not happen - ',
            Utils.serializePouchError(err)
          );
        })
        .on('complete', function (info) {
          self._complete(info.errors);
        })
        .on('error', function (err) {
          logger.debug(
            'Got error on replication - ',
            Utils.serializePouchError(err)
          );
          self._complete([err]);
        })
        .on('change', function (info) {
          self._replicationTimer();
          // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
          self._localSeqManager
            .update(info.last_seq)
            .catch(function (err) {
              logger.debug(
                'Got error in update, waiting for main loop to ' +
                'detect and handle - ',
                Utils.serializePouchError(err)
              );
            });
          // jscs:enable requireCamelCaseOrUpperCaseIdentifiers
        });
      });
      return self._replicationPromise;
    });
};

/**
 * Check the base class for the core functionality but in our case the key thing
 * is that we call the cancel object we got on the replication.
 * @returns {null}
 */
ThaliReplicationPeerAction.prototype.kill = function () {
  if (this.getActionState() === actionState.KILLED) {
    return null;
  }
  ThaliReplicationPeerAction.super_.prototype.kill.call(this);

  if (this._refreshTimerManager) {
    this._refreshTimerManager.stop();
    this._refreshTimerManager = null;
  }
  if (this._cancelReplication) {
    this._cancelReplication.cancel();
  }
  if (this._localSeqManager) {
    this._localSeqManager.stop();
  }

  return null;
};

function printErrorArray(errors) {
  var result = '';
  errors.forEach(function (error) {
    result += 'error: ' + error.message + ' ';
  });
  return result;
}

/**
 * @param {Array.<Error>} errors
 * @returns {null}
 * @private
 */
ThaliReplicationPeerAction.prototype._complete =
  function (errors) {
    var self = this;
    if (self._completed) {
      logger.debug('We called _complete with ' + printErrorArray(errors) +
      ' but this is a second call and so we ignored it');
      return null;
    }
    self._completed = true;
    logger.debug('We called _complete with ' + printErrorArray(errors) +
    ' and it caused us to complete');

    self.kill();

    assert(self._resolve, 'resolve should exist');
    assert(self._reject, 'reject should exist');
    var returnError = null;

    if (!errors || errors.length === 0) {
      self._resolve();
    } else {
      var isErrorResolved = errors.some(function (error) {
        switch (error.code) {
          case 'ECONNREFUSED': {
            returnError = new Error('Could not establish TCP connection');
            returnError.status = error.status;
            returnError.code = error.code;
            self._reject(returnError);
            return true;
          }
          case 'ECONNRESET': {
            returnError = new Error('Could establish TCP connection but ' +
              'couldn\'t keep it running');
            returnError.status = error.status;
            returnError.code = error.code;
            self._reject(returnError);
            return true;
          }
        }
        return false;
      });
      if (!isErrorResolved) {
        self._reject(errors[0]);
      }
    }

    self._resolve = null;
    self._reject  = null;
    return null;
  };

ThaliReplicationPeerAction.prototype.waitUntilKilled = function () {
  // We have just killed all requests.
  // We don't care if any request will end with an error.

  var promises = [];
  if (this._replicationPromise) {
    promises.push(
      this._replicationPromise.catch(function () {})
    );
  }
  if (this._localSeqManager) {
    promises.push(this._localSeqManager.waitUntilStopped());
  }
  return Promise.all(promises);
};

module.exports = ThaliReplicationPeerAction;
