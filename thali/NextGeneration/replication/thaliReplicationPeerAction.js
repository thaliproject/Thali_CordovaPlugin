'use strict';

var Promise = require('lie');
var util = require('util');
var ThaliPeerAction = require('../thaliPeerPool/thaliPeerAction');
var actionState = ThaliPeerAction.actionState;
var assert = require('assert');
var thaliConfig = require('../thaliConfig');
var logger = require('../../thalilogger')('thaliReplicationPeerAction');

/** @module thaliReplicationPeerAction */

/**
 * @classdesc Manages replicating information with a peer we have discovered
 * via notifications.
 *
 * @param {Buffer} peerIdentifier A buffer containing the public key identifying
 * the peer who we are to replicate with.
 * @param {module:thaliNotificationClient.event:peerAdvertisesDataForUs} peerAdvertisesDataForUs
 * The notification that triggered this replication. This gives us the
 * information we need to create a connection as well the connection type
 * we need for the base class's constructor.
 * @param {PouchDB} PouchDB The PouchDB class constructor we are supposed to
 * use.
 * @param {string} dbName The name of the DB we will use both for local use as
 * well as remote use. Note that we will get the name for the remote database by
 * taking dbName and appending it to http://[hostAddress]:[portNumber]/db/
 * [name] where hostAddress and portNumber are from the peerAdvertisesDataForUs
 * argument.
 * @constructor
 */
function ThaliReplicationPeerAction(peerIdentifier,
                                    peerAdvertisesDataForUs,
                                    PouchDB,
                                    dbName) {
  assert(peerIdentifier, 'there must be a peerIdentifier');
  assert(peerAdvertisesDataForUs, 'there must be peerAdvertisesDataForUs');
  assert(PouchDB, 'there must be PouchDB');
  assert(dbName, 'there must be dbName');

  ThaliReplicationPeerAction.super_.call(this, peerIdentifier,
    peerAdvertisesDataForUs.connectionType,
    ThaliReplicationPeerAction.actionType,
    peerAdvertisesDataForUs.pskIdentifyField,
    peerAdvertisesDataForUs.psk);

  this._peerAdvertisesDataForUs = peerAdvertisesDataForUs;
  this._PouchDB = PouchDB;
  this._dbName = dbName;
  this._lastWrittenSeq = 0;
  this._seqWriteTiemout = null;
  this._cancelReplication = null;
  this._resolveStart = null;
  this._rejectStart = null;
}

util.inherits(ThaliReplicationPeerAction, ThaliPeerAction);

/**
 * The actionType we will use when calling the base class's constructor.
 *
 * @private
 * @type {string}
 */
ThaliReplicationPeerAction.actionType = 'ReplicationAction';

/**
 * The number of seconds we will wait for an existing live replication to have
 * no changes before we terminate it.
 *
 * @private
 * @type {number}
 */
ThaliReplicationPeerAction.maxIdlePeriodSeconds = 30;

/**
 * The number of milliseconds to wait between updating `_Local/<peer ID>` on the
 * remote machine. See
 * http://thaliproject.org/ReplicationAcrossDiscoveryProtocol/.
 *
 * @private
 * @type {number}
 */
ThaliReplicationPeerAction.pushLastSyncUpdateMilliseconds = 200;

ThaliReplicationPeerAction.prototype._writeSeq = function (seq) {
  // Seq should only go up but if there is a problem it's because we got
  // bad data from the remote server.
  if (seq <= this._lastWrittenSeq) {
    logger.debug('Got a bad seq, submitted seq ' + seq + ', lastWrittenSeq: ' +
      this._lastWrittenSeq);
    return;
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
  //This is called when replication starts. It starts a timer. The timer is
  //reset every time this function is called. If the timer expires then we call
  //complete and shut down
};

ThaliReplicationPeerAction.prototype._complete =
  function (sendLastUpdate, error) {
    //Cancel replication
    //Cancel replicationTimer
    //If sendLastUpdate is true then force out an immediate writeSeq and once
    //it is done then resolve or reject. Otherwise resolve/reject immediately.
    //Make sure to call kill on super since that will set state to killed
  };

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
 * with a Error object with the string that either matches one of the {@link
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
 * module:thaliReplicationPeerAction~ThaliReplicatonPeerAction.maxIdlePeriodSeconds}
 * seconds then we will end the replication. The output from this event also
 * provides us with the current last_seq we have synch'd from the remote peer.
 * Per http://thaliproject.org/ReplicationAcrossDiscoveryProtocol/ we need to
 * update the remote `_Local/<peer ID>` document every
 * {@link module:thaliReplicationPeerAction~ThaliReplicationPeerAction.pushLastSyncUpdateMilliseconds}
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
  var self = this;

  ThaliReplicationPeerAction.super_.prototype.start.call(this, httpAgentPool)
    .then(function () {
      var ajaxOptions = {
        ajax : {
          rejectUnauthorized: false,
          ciphers: thaliConfig.SUPPORTED_PSK_CIPHERS,
          pskIdentity: self.getPskIdentity(),
          pskKey: self.getPskKey()
        },
        live: true,
        retry: true,
        skip_setup: true// jscs:ignore requireCamelCaseOrUpperCaseIdentifiers
      };
      var remoteUrl = 'https://' + self._peerAdvertisesDataForUs.hostAddress +
        ':' + self._peerAdvertisesDataForUs.portNumber + '/db/' + self._dbName;

      var remoteDB = new self._PouchDB(remoteUrl, ajaxOptions);
      var errorHappened = false;
      self._replicationTimer();
      return new Promise(function (resolve, reject) {
        self._resolveStart = resolve;
        self._rejectStart = reject;
        self._cancelReplication = remoteDB.replicate.to(self._dbName)
          .on('paused', function (err) {
            logger.debug('Got paused with ' + JSON.stringify(err));
          })
          .on('active', function () {
            logger.debug('Replication resumed');
          })
          .on('denied', function (err) {
            logger.warn('We got denied on a PouchDB access, this really should ' +
              'not happen - ' + JSON.stringify(err));
            errorHappened = true;
          })
          .on('complete', function (info) {
            self._complete(errorHappened, info);
          })
          .on('error', function (err) {
            logger.warn('Got error on replication - ' + JSON.stringify(err));
            errorHappened = true;
          })
          .on('change', function (info) {
            self._replicationTimer();
            // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
            self._writeSeq(info.last_seq);
            // jscs:enable requireCamelCaseOrUpperCaseIdentifiers
          });
      });
    });
};

/**
 * Check the base class for the core functionality but in our case the key thing
 * is that we call the cancel object we got on the replication.
 *
 */
ThaliReplicationPeerAction.prototype.kill = function () {
  ThaliReplicationPeerAction.super_.prototype.kill.call(this);

};

module.exports = ThaliReplicationPeerAction;
