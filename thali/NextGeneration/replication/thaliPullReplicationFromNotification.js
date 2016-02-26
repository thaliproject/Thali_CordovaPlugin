'use strict';

var PromiseQueue = require('./../promiseQueue');
var ThaliNotificationClient = require('../notification/thaliNotificationClient');
var assert = require('assert');
var areBufferArraysEqual = require('./utilities').areBufferArraysEqual;

/** @module thaliPullReplicationFromNotification */

/**
 * This object tracks who we are replicating with
 *
 * @constructor
 * @public
 */
function ReplicationManager() {

}

ReplicationManager.prototype.addPeer = function (peerNotification) {

};

ReplicationManager.prototype.removePeer = function (peerId) {

};

/**
 * @classdesc This class will listen for
 * {@link module:thaliNotificationClient.event:peerAdvertisesDataForUs} events
 * and then schedule replications.
 *
 * If we receive a notification for a peer that is on our list then we will
 * check to see if we have already enqueued a job for them. If we have then we
 * will have to dequeue it and create a new job since a second notification
 * should really only have happened if some of the values for the peer have
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
 * @param {Crypto.ECDH} ecdhForLocalDevice A Crypto.ECDH object initialized
 * with the local device's public and private keys.
 * @constructor
 */
function ThaliPullReplicationFromNotification(pouchDB,
                                              thaliPeerPoolInterface,
                                              ecdhForLocalDevice) {
  assert(pouchDB !== null, 'pouchDB not null');
  assert(thaliPeerPoolInterface !== null, 'thaliPeerPoolInterface !null');
  assert(ecdhForLocalDevice !== null, 'ecdhForLocalDevice !null');
  this._pouchDB = pouchDB;
  this._thaliPeerPoolInterface = thaliPeerPoolInterface;
  this._ecdhForLocalDevice = ecdhForLocalDevice;
  this._promiseQueue = new PromiseQueue();
  this._thaliNotificationClient =
    new ThaliNotificationClient(this._thaliPeerPoolInterface,
                                this._ecdhForLocalDevice);
}

// Constants that don't change after the constructor is called
ThaliPullReplicationFromNotification.prototype._pouchDB = null;
ThaliPullReplicationFromNotification.prototype._thaliPeerPoolInterface = null;
ThaliPullReplicationFromNotification.prototype._ecdhForLocalDevice = null;
ThaliPullReplicationFromNotification.prototype._promiseQueue = null;
ThaliPullReplicationFromNotification.prototype._thaliNotificationClient = null;

// Variables whose state changes over the lifetime of the object
ThaliPullReplicationFromNotification.prototype._started = false;
ThaliPullReplicationFromNotification.prototype._prioritizedReplicationList =
  null;

/**
 * When we were already handling one peer list and are given a new one we have
 * to find the right way to transition over.
 *
 * Peers in both lists - Do nothing, we are good.
 *
 * Peer in old list but not new - Kill any job we have for them, in queue or
 * out.
 *
 * Peer in new list but not old list - Check to see if they are in our list of
 * known present peers and if so then set up a replication.
 *
 * @param {Buffer[]} oldPrioritizedReplicationList
 * @param {Buffer[]} newPrioritizedReplicationList
 * @private
 */
ThaliPullReplicationFromNotification.prototype._updateReplications =
  function(oldPrioritizedReplicationList, newPrioritizedReplicationList) {

  };

/**
 * Starts to listen for peer discovery events for interesting peers and
 * then tries to do a pull replication from them.
 *
 * It is perfectly acceptable to call start many times in a row since those
 * who are to be replicated with can change over time.
 *
 * It is also acceptable to call start with []. This will cause us to track
 * which peers are in the area and if later we are given a non-empty array
 * we can immediately start replicating based on what we know about our
 * environment.
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
    assert(prioritizedReplicationList !== null, 'no nulls!');
    var self = this;
    return this._promiseQueue.enqueue(
      function (resolve, reject) {
        if (self._started &&
            areBufferArraysEqual(self._prioritizedReplicationList,
            prioritizedReplicationList)) {
          resolve();
        }
        self._started = true;
        self._thaliNotificationClient.on('peerAdvertiseDataForUs',
          function (peerNotification) {

          });
        self._thaliNotificationClient.start(prioritizedReplicationList);
        self._updateReplications(self._prioritizedReplicationList,
                                 prioritizedReplicationList);
        self._prioritizedReplicationList = prioritizedReplicationList;
      }
    );
  };

/**
 * Stops listening for new peer discovery and shuts down all replication
 * actions.
 *
 * This method is idempotent.
 */
ThaliPullReplicationFromNotification.prototype.stop = function () {
  var self = this;
  return this._promiseQueue.enqueue(
    function (resolve, reject) {
      if (!self._started) {
        return resolve();
      }
      self._thaliNotificationClient.stop();
      self._started = false;
    }
  );
};


module.exports = ThaliPullReplicationFromNotification;
