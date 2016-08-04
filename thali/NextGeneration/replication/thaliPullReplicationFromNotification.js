'use strict';

var ThaliNotificationClient = require('../notification/thaliNotificationClient');
var logger = require('../../thalilogger')('thaliPullReplicationFromNotification');
var assert = require('assert');
var PeerAction = require('../thaliPeerPool/thaliPeerAction');
var ThaliReplicationPeerAction = require('./thaliReplicationPeerAction');

/** @module thaliPullReplicationFromNotification */

/**
 * @classdesc This class will listen for
 * {@link module:thaliNotificationClient.event:peerAdvertisesDataForUs} events
 * and then schedule replications.
 *
 * If we receive a notification for a peer that is on our list then we will
 * check to see if we have already enqueued a job for them. If we have then we
 * will have to kill it and create a new job since a second notification
 * should really only have happened if some the values for the peer have
 * changed. If there is no enqueued job or if there is a running job then we
 * must enqueue a replication work item.
 *
 * Note: Functionality below is blocked on https://github.com/thaliproject/Thali_CordovaPlugin/issues/734
 * If we receive a notification that a peer is no longer available and there
 * is a queued job for that peer then we will remove the queued job. If there
 * is a running job then we will leave that job alone as presumably it will
 * fail on its own or succeed since notifications that peers have gone isn't
 * an exact science.
 *
 * It is possible for us to discover the same peer over two different
 * transports (say Bluetooth and WiFi). In that case we treat each transport
 * separately. In other words, we treat the combination of transport and user
 * ID as a single value so that if we simultaneously find the same peer over
 * two transports then we will schedule two replications. It is up to the peer
 * pool manager to detect when we are trying to do the same action type for
 * the same peer over two different transports and to then pick which one it
 * prefers (if any, maybe it wants both).
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
  assert(PouchDB, 'Must have PouchDB');
  assert(dbName, 'Must have dbName');
  assert(thaliPeerPoolInterface, 'Must have thaliPeerPoolInterface');
  assert(ecdhForLocalDevice, 'Must have ecdhForLocalDeivce');
  this._thaliNotificationClient =
    new ThaliNotificationClient(thaliPeerPoolInterface, ecdhForLocalDevice);
  this._thaliPeerPoolInterface = thaliPeerPoolInterface;
  this._publicKey = ecdhForLocalDevice.getPublicKey();
  this._PouchDB = PouchDB;
  this._dbName = dbName;
  this._boundAdvertiser = this._peerAdvertisesDataForUsHandler.bind(this);
  this._peerDictionary = {};
  this._started = false;
}

ThaliPullReplicationFromNotification._peerDictionaryKey =
  function(connectionType, keyId) {
    return connectionType + '-' + keyId;
  };

ThaliPullReplicationFromNotification.prototype._started = null;

ThaliPullReplicationFromNotification.prototype._thaliNotificationClient = null;

ThaliPullReplicationFromNotification.prototype._peerDictionary = null;

ThaliPullReplicationFromNotification.prototype._peerAdvertisesDataForUsHandler =
  function (peerAdvertisesDataForUs) {
    var self = this;
    if (!peerAdvertisesDataForUs.portNumber) {
      logger.error('We don\'t support client notification that a peer is ' +
        'gone, yet.');
      return;
    }

    var key = ThaliPullReplicationFromNotification._peerDictionaryKey(
      peerAdvertisesDataForUs.connectionType, peerAdvertisesDataForUs.keyId);
    var existingAction = self._peerDictionary[key];
    if (existingAction) {
      assert(existingAction.getActionState() ===
        PeerAction.actionState.CREATED, 'If the action had been started or ' +
        'killed then it should have been removed from the dictionary before ' +
        'we got to this code.');
      existingAction.kill();
    }

    var thaliReplicationPeerAction =
      new ThaliReplicationPeerAction(peerAdvertisesDataForUs, self._PouchDB,
                                     self._dbName, self._publicKey);

    var removed = false;
    function removeFromDictionary(originalMethod) {
      return function () {
        if (!removed) {
          assert(self._peerDictionary[key], 'The entry should exist because ' +
            'this is the only place that can remove it');
          delete self._peerDictionary[key];
          removed = true;
        }

        return originalMethod.apply(thaliReplicationPeerAction, arguments);
      };
    }

    var originalStart = thaliReplicationPeerAction.start;
    thaliReplicationPeerAction.start = removeFromDictionary(originalStart);
    var originalKill = thaliReplicationPeerAction.kill;
    thaliReplicationPeerAction.kill = removeFromDictionary(originalKill);

    assert(!self._peerDictionary[key], 'we should not have an entry for this ' +
      'key by this point');

    self._peerDictionary[key] = thaliReplicationPeerAction;
    self._thaliPeerPoolInterface.enqueue(thaliReplicationPeerAction);
  };

ThaliPullReplicationFromNotification.prototype._boundAdvertiser = null;

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
    if (this._started) {
      return;
    }
    this._started = true;
    this._thaliNotificationClient.on(
      this._thaliNotificationClient.Events.PeerAdvertisesDataForUs,
      this._boundAdvertiser);
    return this._thaliNotificationClient.start(prioritizedReplicationList);
  };

/**
 * Stops listening for new peer discovery and shuts down all replication
 * actions that haven't started yet.
 *
 * This method is idempotent.
 */
ThaliPullReplicationFromNotification.prototype.stop = function () {
  var self = this;
  if (!self._started) {
    return;
  }
  self._started = false;
  self._thaliNotificationClient.removeListener(
    self._thaliNotificationClient.Events.PeerAdvertisesDataForUs,
    self._boundAdvertiser);
  Object.getOwnPropertyNames(self._peerDictionary)
    .forEach(function (entryName) {
      self._peerDictionary[entryName].kill();
    });
  self._peerDictionary = {};
  return self._thaliNotificationClient.stop();
};


module.exports = ThaliPullReplicationFromNotification;
