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
 * Enqueued jobs are expected to handle replicating the databases in the list
 * we were given. Note that we must late bind the entries in the list so that
 * if there is an update to the list of DBs that a peer is supposed to synch
 * between the time the peer is enqueued and when it is run then we will always
 * use the latest list.
 *
 * When we schedule a
 *
 * If we receive a notification that a peer is no longer available
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

ThaliPullReplicationFromNotification.prototype._notificationSubscriptions =
  null;

/**
 * @public
 * @typedef {Object} replicationDescription
 * @property {string} databaseName This is a DB name that will be used to
 * replicate to a local DB and will be appended to "http://domain or IP:port/"
 * to create the remote name.
 * @property {boolean} liveReplication If true this specifies that when
 * replication starts it should continue until the peer is no longer available.
 * Note that setting this value to true will block replicating any other DBs
 * for this peer since we currently only replicate one DB at a time.
 */

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
 * @param {Object.<string, replicationDescription[]>} notificationSubscriptions
 * The key is a base 64 url safe encoded public key that identifies the peer.
 * The value is an array of descriptions specifying what DBs to replicate for
 * this peer.
 */
ThaliPullReplicationFromNotification.prototype.setNotifications =
  function (notificationSubscriptions) {
    // Do check that the value is valid
    ThaliPullReplicationFromNotification.prototype._notificationSubscriptions =
      notificationSubscriptions;
  };

module.exports = ThaliPullReplicationFromNotification;