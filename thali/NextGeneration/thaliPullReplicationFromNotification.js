'use strict';

/** @module thaliPullReplicationFromNotification */

/**
 * We will be given a structure that has a peer ID and a list of databases
 * we want to try to synch for that peer ID. As we get notified of peers being
 * around if they are on the list then we will enqueue an action to sync with
 * them.
 *
 * We need to be smart enough that if we have already enqueue a job to
 * replicate something that hasn't run yet that we don't keep enqueing more
 * jobs for the same peer. In other words, for any given peer we should have
 * exactly one job in the queue.
 *
 * We get a peerAdvertisesDataForUs and first we check to see if we have a job
 * enqueued. If we do then we can ignore the notification.
 *
 * If we have a job running then for now we will enqueue new job. It's not
 * great but it's not horrible either.
 *
 *
 */

/**
 * Records a peer's ID and what databases we are expected to synch when we
 * connect to that peer.
 *
 * @public
 * @typedef {Object} NotificationSubscription
 * @property {string} peerKey A base 64 URL safe encoded public key identifying
 * the peer
 * @property {string[]} dbsToSync An array of DB names, these names will be
 * appended to a HTTP URL of the form 'http://domain OR ip/'.
 *
 */


/**
 * @classdesc This class will listen for
 * {@link module:thaliNotificationClient.event:peerAdvertisesDataForUs} events
 * and then schedule replications.
 *
 * If we receive a notification for a peer that is on our list then we will
 * check to see if we have already enqueued a job for them. If we have then
 * we don't need to do anything. If there is no enqueued job or if there is
 * a running job then we must enqueue a replication work item.
 *
 * Enqueued jobs are expected to handle replicating the databases in the list
 * we were given. Note that we must late bind the entries in the list so that
 * if there is an update to the list of DBs that a peer is supposed to synch
 * between the time the peer is enqueued and when it is run then we will always
 * use the latest list.
 *
 * @public
 * @param {PouchDB} pouchDB
 * @param {module:thaliPeerPoolInterface~ThaliPeerPoolInterface} thaliPeerPoolInterface
 * @param {module:thaliNotificationClient~ThaliNotificationClient} thaliNotificationClient
 * @constructor
 */
function ThaliPullReplicationFromNotification(pouchDB, thaliPeerPoolInterface,
                                              thaliNotificationClient) {

}

/**
 * This sets the complete list of peers and DBs to synch for those peers when
 * we connect to them. It is legal to submit an empty or null value, it just
 * means we should not follow up on notifications from anyone.
 *
 * If we have enqueued work for a peer whose name is removed from the table
 * then we will remove that peer's enqueued work.
 *
 * We will late bind the list of databases we are synching so if a peer is
 * enqueued but a call to this method changes the databases to be synch'd we
 * will pick that up.
 *
 * If however a peer who was removed from the list or whose list of DBs was
 * changed has a job currently running we will let that job complete.
 *
 * We will not start listening for events until the first call to this method.
 *
 * @param {NotificationSubscription[]} notificationSubscriptions
 */
ThaliPullReplicationFromNotification.prototype.setNotifications =
  function (notificationSubscriptions) {

  };

module.exports = ThaliPullReplicationFromNotification;