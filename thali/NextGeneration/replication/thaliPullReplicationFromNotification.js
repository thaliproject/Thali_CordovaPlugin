'use strict';

var ThaliNotificationClient = require('../notification/thaliNotificationClient');

/** @module thaliPullReplicationFromNotification */

/**
 * @classdesc This class will listen for
 * {@link module:thaliNotificationClient.event:peerAdvertisesDataForUs} events
 * and then schedule replications.
 *
 * If we receive a notification for a peer that is on our list then we will
 * check to see if we have already enqueued a job for them. If we have then we
 * will have to dequeue it and create a new job since a second notification
 * should really only have happened if some the values for the peer have
 * changed. If there is no enqueued job or if there is a running job then we
 * must enqueue a replication work item.
 *
 * If we receive a notification that a peer is no longer available and there
 * is a queued job for that peer then we will remove the queued job. If there
 * is a running job then we will leave that job alone as presumably it will
 * fail on its own or succeed since notifications that peers have gone isn't
 * an exact science.
 *
 * BUGBUG: In the interests of time we currently will only support replicating
 * data from a single remote database for all users. This is clearly silly and
 * we should move to a model where each user can have multiple databases
 * specified for them.
 *
 * @public
 * @param {PouchDB} PouchDB The factory we will use to create the database we
 * will replicate all changes to.
 * @param {string} dbName The name of the DB. The name of the remote DB MUST be
 * http://[host from discovery]:[port from discovery]/db/[name] where name is
 * taken from pouchDB.info's db_name field.
 * @param {module:thaliPeerPoolInterface~ThaliPeerPoolInterface} thaliPeerPoolInterface
 * @param {Crypto.ECDH} ecdhForLocalDevice A Crypto.ECDH object initialized
 * with the local device's public and private keys.
 * @constructor
 */
function ThaliPullReplicationFromNotification(PouchDB,
                                              dbName,
                                              thaliPeerPoolInterface,
                                              ecdhForLocalDevice) {
  this._thaliNotificationClient =
    new ThaliNotificationClient(thaliPeerPoolInterface, ecdhForLocalDevice);

}

ThaliPullReplicationFromNotification.prototype._thaliNotificationClient = null;

/**
 * Starts to listen for peer discovery events for interesting peers and
 * then tries to do a pull replication from them.
 *
 * @public
 * @param {Buffer[]} prioritizedReplicationList Used to decide what peer
 * notifications to pay attention to and when scheduling replications what
 * order to schedule them in (if possible). This list consists of an array
 * of buffers that contain the serialization of the public ECDH keys of the
 * peers we are interested in synching with.
 */
ThaliPullReplicationFromNotification.prototype.start =
  function (prioritizedReplicationList) {
    return this._thaliNotificationClient.start(prioritizedReplicationList);
  };

/**
 * Stops listening for new peer discovery and shuts down all replication
 * actions.
 *
 * This method is idempotent.
 */
ThaliPullReplicationFromNotification.prototype.stop = function () {
  return this._thaliNotificationClient.stop();
};


module.exports = ThaliPullReplicationFromNotification;
