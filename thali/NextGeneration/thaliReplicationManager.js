'use strict';

var ThaliSendNotificationBasedOnReplication =
  require('thali/NextGeneration/thaliSendNotificationBasedOnReplication');
var ThaliPullReplicationFromNotification =
  require('thali/NextGeneration/thaliPullReplicationFromNotification');
var ThaliMobile = require('thali/NextGeneration/thaliMobile');

/**
 * @classdesc This may look like a class but it really should only have one
 * instance or bad stuff can happen.
 * @public
 * @param {PouchDB} pouchDB pouchDB database we are tracking changes on.
 * @param {module:thaliPeerPoolInterface~ThaliPeerPoolInterface} thaliPeerPoolInterface
 * @param {Crypto.ECDH} ecdhForLocalDevice A Crypto.ECDH object initialized with
 * the local device's public and private keys.
 * @param {Object} [router] An express router object that the class will use
 * to register its path.
 * @param {number} [secondsUntilExpiration] The number of seconds into the
 * future after which the beacons should expire.
 * @constructor
 */
function ThaliReplicationManager(pouchDB,
                                 thaliPeerPoolInterface,
                                 ecdhForLocalDevice,
                                 router,
                                 secondsUntilExpiration) {
  this._thaliSendNotificationBasedOnReplication =
    new ThaliSendNotificationBasedOnReplication(router,
                                                ecdhForLocalDevice,
                                                secondsUntilExpiration,
                                                pouchDB);

  this._thaliPullReplicationFromNotification =
    new ThaliPullReplicationFromNotification(pouchDB,
                                             thaliPeerPoolInterface,
                                             ecdhForLocalDevice);
}

ThaliReplicationManager.prototype._thaliSendNotificationBasedOnReplication =
  null;

ThaliReplicationManager.prototype._thaliPullReplicationFromNotification = null;


/**
 * Starts up everything including listening for advertisements, sending out
 * own advertisements, generating beacons to notify peers that we have data
 * for them as well as running pull replication jobs to pull data from other
 * peers who have data for us.
 *
 * This method is not idempotent as each call to start with different arguments
 * will cause the related states to be changed.
 *
 * @param {Buffer[]} prioritizedReplicationList Used to decide what peer
 * notifications to pay attention to and when scheduling replications what
 * order to schedule them in (if possible). This list consists of an array
 * of buffers that contain the serialization of the public ECDH keys of the
 * peers we are interested in synching with.
 * @param {Buffer[]} prioritizedPeersToNotifyOfChanges This is the list of peers
 * who are to be notified whenever there is a change to the database. The array
 * contains a serialization of the public ECDH keys of the relevant peers.
 * @returns {Promise<?Error>}
 */
ThaliReplicationManager.prototype.start =
  function (prioritizedReplicationList, prioritizedPeersToNotifyOfChanges) {
    var self = this;
    self._thaliPullReplicationFromNotification
          .start(prioritizedReplicationList);
    return ThaliMobile.start().then(function () {
      /*
      Ideally we could call startListening and startUpdateAdvertising separately
      but this causes problems in iOS. The issue is that we deal with the
      restriction that there can only be one MCSession between two devices by
      having a leader election where one device will always form the session.
      Imagine that there is device A and B. B is advertising. A hears the
      advertisement and wants to connect but it can't start the session. So what
      it has to do is send an invite to B, who will reject the invite but then
      respond with its own invite to A. For this to work however B has to be
      listening for advertisements (not just making them) because otherwise
      there is no way in iOS for A to ask B for a session (that will be
      refused). Simultaneously A must be listening for advertisements (or it
      wouldn't have heard B) and it must be advertising itself or B couldn't
      establish the MCSession with it. So in practice this means that in iOS
      everyone has to be both listening and advertising at the same time.
       */
      return ThaliMobile.startListeningForAdvertisements();
    }).then(function () {
      return ThaliMobile.startUpdateAdvertisingAndListening();
    }).then(function () {
      return self._thaliSendNotificationBasedOnReplication
        .start(prioritizedPeersToNotifyOfChanges);
    });
  };

/**
 * Shuts down the radios and deactivates all replications.
 *
 * @returns {Promise<?Error>}
 */
ThaliReplicationManager.prototype.stop = function () {
  this._thaliPullReplicationFromNotification.stop();
  this._thaliSendNotificationBasedOnReplication.stop();
  return ThaliMobile.stop();
};

module.exports = ThaliReplicationManager;
