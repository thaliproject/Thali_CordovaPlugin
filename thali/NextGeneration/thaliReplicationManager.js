'use strict';

var ThaliNotificationClient =
  require('thali/NextGeneration/thaliNotificationClient');
var ThaliNotificationServer =
  require('thali/NextGeneration/thaliNotificationServer');
var ThaliSendNotificationBasedOnReplication =
  require('thali/NextGeneration/thaliSendNotificationBasedOnReplication');
var ThaliPullReplicationFromNotification =
  require('thali/NextGeneration/thaliPullReplicationFromNotification');
var ThaliMobile = require('thali/NextGeneration/thaliMobile');

/**
 * @classdesc This may look like a class but it really should only have one
 * instance or bad stuff can happen.
 * @public
 * @param pouchDB
 * @param thaliPeerPoolInterface
 * @param ecdhForLocalDevice
 * @param addressBookCallback
 * @param [router]
 * @param [secondsUntilExpiration]
 * @constructor
 */
function ThaliReplicationManager(pouchDB,
                                 thaliPeerPoolInterface,
                                 ecdhForLocalDevice,
                                 addressBookCallback,
                                 router,
                                 secondsUntilExpiration) {
  this._thaliNotificationClient =
    new ThaliNotificationClient(thaliPeerPoolInterface, ecdhForLocalDevice,
      addressBookCallback);

  this._thaliNotificationServer =
    new ThaliNotificationServer(router, ecdhForLocalDevice,
      secondsUntilExpiration);

  this._thaliSendNotificationBasedOnReplication =
    new ThaliSendNotificationBasedOnReplication(this._thaliNotificationServer,
                                                pouchDB);

  this._thaliPullReplicationFromNotification =
    new ThaliPullReplicationFromNotification(pouchDB, thaliPeerPoolInterface,
                                             this._thaliNotificationClient);
}

ThaliReplicationManager.prototype._thaliNotificationClient = null;

ThaliReplicationManager.prototype._thaliNotificationServer = null;

ThaliReplicationManager.prototype._thaliSendNotificationBasedOnReplication =
  null;

ThaliReplicationManager.prototype._thaliPullReplicationFromNotification = null;

ThaliReplicationManager.prototype.setNotifications =
  function (publicKeysToNotify) {

  };

ThaliReplicationManager.prototype.start = function () {
  return ThaliMobile.start().then(function () {
    this._thaliNotificationClient.start();
  });
};

module.exports = ThaliReplicationManager;

/**
 * thaliMobile - This is a static class that hosts a router object. But the real
 * action starts when we call startListeningForAdvertisements and
 * startUpdateAdvertisingAndListening
 *
 * thaliNotificationClient - Listens for events from thaliMobile when it is
 * throwing up events. Has start and stop to register and unregister for
 * listener to thaliMobile events.
 *
 * thaliPullReplicationFromNotification - Based on events from thaliNotification
 * client will try to schedule work to do pull notifications with discovered
 * peers. The only method is setNotifications that specifies which peers we are
 * looking to sync with.
 *
 * thaliNotificationServer - Specifies what beacons to advertise. This just
 * puts up a route on the router to server up the beacons. It doesn't actually
 * do anything else.
 *
 * thaliSendNotificationBasedOnReplication - Watches the PouchDB server it is
 * given for changes and then generates
 */
