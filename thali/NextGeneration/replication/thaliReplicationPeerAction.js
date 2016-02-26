'use strict';

var Promise = require('lie');
var util = require('util');
var PeerAction = require('thaliPeerAction').PeerAction;
var actionState = require('thaliPeerAction').actionState;

/** @module thaliReplicationPeerAction */

/**
 * @classdesc Manages replicating information with a peer we have discovered
 * via notifications.
 * @private
 * @param {buffer} peerId A buffer containing the public key identifying the
 * peer who we are to replicate with.
 * @param {module:thaliNotificationClient.event:peerAdvertisesDataForUs} peerAdvertisesDataForUs
 * The notification that triggered this replication. This gives us the
 * information we need to create a connection as well the connection type
 * we need for the base class's constructor.
 * @param {PouchDB} pouchDB The pouchDB database we will use to replicate into.
 * Note that we will get the name for the remote database by taking this
 * database's name and appending it to http://[hostAddress]:[portNumber]/db/
 * [name] where hostAddress and portNumber are from the previous argument.
 * @constructor
 */
function ThaliReplicationPeerAction(peerId,
                                    peerAdvertisesDataForUs,
                                    pouchDB) {
  // remember to call the base class's constructor
}

util.inherits(ThaliReplicationPeerAction, PeerAction);

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

ThaliReplicationPeerAction.prototype.resultPromise = null;

/**
 * When start is called we will start a replication with the remote peer using
 * the settings specified below. We need to set the ajax option in order to set
 * the psk related values from peerAdvertisesDataForUs. We will need to create
 * the URL using the hostAddress and portNumber from peerAdvertisesDataForUs.
 * Also make sure to set skip_setup to true.
 *
 * If we get an error that the database doesn't exist on the remote machine that
 * is fine, we're done. Although we should log a low priority error that we
 * tried to get to a database that doesn't exist. DO NOT log the peer ID.
 *
 * We then need to use db.replication.to with the remoteDB using the URL
 * specified in the constructor. This will be the local DB we
 * will copy to. We need to do things this way so we can set the AJAX
 * options for PSK. We also need to set both options.retry and options.live
 * to true. See the changes event below for some of the implications of this.
 *
 * __OPEN ISSUE:__ I'm only sure that the options.ajax works on the PouchDB
 * constructor. I have no idea if we can submit options.ajax on a replication.
 * If not then we will need to accept a PouchDB constructor object with a DB
 * name and create everything from scratch.
 *
 * __OPEN ISSUE:__ One suspects we need to play around with
 * options.back_off_function to find something that works well for P2P
 * transports.
 *
 * We must hook these events from the replication object.
 *
 * paused - We need to log this with a very low priority log value just for
 * debugging purposes. But certainly nothing that would be recorded in
 * production.
 *
 * active - Log per the previous.
 *
 * denied - This is a genuine error, it should never happen to log with high
 * priority so we can investigate. Again, don't include any identifying
 * information, not even the DB name. It's a hint.
 *
 * complete - Return resolve(); if there was no error otherwise return
 * Reject() with a Error object with the string that either matches one of the
 * {@link module:thaliPeerAction~ThaliPeerAction.start} error strings or
 * else something appropriate. Even if there is an error we should always do a
 * final write to `_Local/<peer ID>` with the last_seq in the info object
 * passed to complete.
 *
 * error - Log with reasonably high priority but with no identifying
 * information. Otherwise take no further action as the complete event
 * should also fire and we'll handle things there.
 *
 * __OPEN ISSUE:__ We actually need to investigate what kinds of err values
 * come back in order to determine if we can figure out if it was a connection
 * error. This is important for the thread pool to know. See the errors defined
 * on {@link module:thaliPeerAction~PeerAction.start}.
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
 * when creating HTTP requests related to this action.
 * @returns {Promise<?Error>}
 */
ThaliReplicationPeerAction.prototype.start = function (httpAgentPool) {
  switch(this.getActionType()) {
    case actionState.CREATED: {
      this.actionState = module.exports.actionState.STARTED;
      this.resultPromise = new Promise(function (resolve, reject) {

      });
      return this.resultPromise;
    }
    case actionState.STARTED: {
      return this.resultPromise;
    }
    case actionState.KILLED: {
      return Promise.reject(new Error('action has completed'));
    }
    default: {
      /*
      __Open Issue__: How do we want to handle this? We either should panic and
      throw an exception since this really should never happen or we can
      more mutely panic and log this and then kill the replication.
       */
    }
  }
};

/**
 * Check the base class for the core functionality but in our case the key thing
 * is that we call the cancel object we got on the replication.
 *
 */
ThaliReplicationPeerAction.prototype.kill = function () {

};

module.exports = ThaliReplicationPeerAction;
