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
 * @param {Crypto.ECDH} ecdhForLocalDevice A Crypto.ECDH object initialized with
 * the local device's public and private keys.
 * @param {module:thaliPeerPoolInterface~ThaliPeerPoolInterface} [thaliPeerPoolInterface]
 * If your app doesn't specify its own pool interface you will seriously
 * regret it as the default one has awful behavior. Building your own
 * thaliPeerPoolInterface is pretty much a requirement for a decent Thali
 * app.
 * @param {Object} [router] An express router object that the class will use
 * to register its path. Note that unles your application needs its own
 * custom HTTP endpoints exposed and/or you are dropping in Thali extensions
 * like identity exchange then you don't need this object.
 * @param {number} [secondsUntilExpiration] The number of seconds into the
 * future after which the beacons should expire.
 * @constructor
 */
function ThaliReplicationManager(pouchDB,
                                 ecdhForLocalDevice,
                                 thaliPeerPoolInterface,
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
 * @param {Buffer[]} [arrayOfRemoteKeys] This is the list of ECDH public keys
 * that we should be willing to send notifications of our changes to and receive
 * notifications of changes from.
 * @returns {Promise<?Error>}
 */
ThaliReplicationManager.prototype.start =
  function (arrayOfRemoteKeys) {
    var self = this;
    self._thaliPullReplicationFromNotification
          .start(arrayOfRemoteKeys);
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
        .start(arrayOfRemoteKeys);
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
