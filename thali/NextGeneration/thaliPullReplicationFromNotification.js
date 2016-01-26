'use strict';

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
 * @param {PouchDB} pouchDB The database we will replicate all changes to. The
 * name of the remote DB MUST be http://[host from discovery]:[port from
 * discovery]/db/[name] where name is taken from pouchDB.info's db_name field.
 * @param {module:thaliPeerPoolInterface~ThaliPeerPoolInterface} thaliPeerPoolInterface
 * @param {module:thaliNotificationClient~ThaliNotificationClient} thaliNotificationClient
 * @constructor
 */
function ThaliPullReplicationFromNotification(pouchDB, thaliPeerPoolInterface,
                                              thaliNotificationClient) {

}

ThaliPullReplicationFromNotification.prototype._notificationSubscriptions =
  null;

/**
 * This sets the complete list of peers and DBs to synch for those peers when
 * we connect to them. It is legal to submit an empty or null value, it just
 * means we should not follow up on notifications from anyone.
 *
 * If we have enqueued work for a peer whose name is removed from the table
 * then we will remove that peer's enqueued work.
 *
 * If however a peer who was removed from the list has a job currently running
 * then we will kill that job immediately.
 *
 * We will not start listening for events until the first call to this method.
 *
 * @param {string[]} publicKeysToNotify
 * An array of base 64 url safe encoded public key that identifies the peers we
 * should watch for notifications from.
 */
ThaliPullReplicationFromNotification.prototype.setNotifications =
  function (publicKeysToNotify) {
    // Do check that the value is valid
    ThaliPullReplicationFromNotification.prototype._notificationSubscriptions =
      publicKeysToNotify;
  };

module.exports = ThaliPullReplicationFromNotification;
