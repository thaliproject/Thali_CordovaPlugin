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
 * @param {string} peerId A base64 encoded public key identifying the peer who
 * we are to replicate with.
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
ThaliReplicationPeerAction.actionType = "ReplicationAction";

ThaliReplicationPeerAction.prototype.resultPromise = null;

/**
 * When start is called we will start a replication with the remote peer using
 * the settings specified below. We need
 * to set the ajax option in order to set the psk related values from
 * peerAdvertisesDataForUs. We will need to create the URL using the
 * hostAddress and portNumber from peerAdvertisesDataForUs. Also make sure to
 * set skip_setup to true.
 *
 * If we get an error that the database doesn't exist on the remote machine that
 * is fine, we're done. Although we should log a low priority error that we
 * tried to get to a database that doesn't exist. DO NOT log the peer ID.
 *
 * We then need to use db.replication.to with the remoteDB using the URL
 * specified in the constructor.. This will be the local DB we
 * will copy to. We need to do things this way so we can set the AJAX
 * options for PSK.
 *
 * __OPEN ISSUE:__ I'm only sure that the options.ajax works on the PouchDB
 * constructor. I have no idea if we can submit options.ajax on a replication.
 * If not then we will need to accept a PouchDB constructor object with a DB
 * name and create everything from scratch.
 *
 * For replication options.retry = true. options.live will equal the value of
 * liveReplication on the database's entry in notificationSubscriptions.
 *
 * __OPEN ISSUE:__ One suspects we need to play around with
 * options.back_off_function to find something that works well for P2P
 * transports.
 *
 * We must hook the paused, active, denied, complete and error events.
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
 * complete - Go to the next DB if there is one. If there isn't one and this
 * isn't a response to an error then return resolve(); If this is after an
 * error and there are no more DBs to replicate then return reject() with
 * an Error object with the string that either matches one of the
 * {@link module:thaliPeerAction~ThaliPeerAction.start} error strings or
 * else something appropriate.
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
 * Make sure to keep the cancel object returned by the replicate call. Well
 * need it for kill.
 *
 * @param httpAgentPool
 * @returns {Promise<?error>}
 */
ThaliReplicationPeerAction.prototype.start = function(httpAgentPool) {
  switch(this.getActionType()) {
    case actionState.CREATED: {
      this.actionState = module.exports.actionState.STARTED;
      this.resultPromise = new Promise(function(resolve, reject) {

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


// Kill - What do we do if we are killed before finishing? We need to let the
// system know that we have to schedule another job if the peer is still
// around.




module.exports = ThaliReplicationPeerAction;
