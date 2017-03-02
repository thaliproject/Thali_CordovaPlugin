'use strict';

var ThaliNotificationClient = require('../notification/thaliNotificationClient');
var logger = require('../../ThaliLogger')('thaliPullReplicationFromNotification');
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
 * http://[host from discovery]:[port from discovery]/[BASE_DB_PATH]/[name] where name is
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

  this.state = ThaliPullReplicationFromNotification.STATES.CREATED;
}

/**
 * This is a list of states for ThaliPullReplicationFromNotification.
 * @public
 * @readonly
 * @enum {string}
 */
ThaliPullReplicationFromNotification.STATES = {
  CREATED: 'created',
  STARTED: 'started',
  STOPPED: 'stopped'
};

/**
 * We should provide an unique key for data
 * with various 'connectionType' and 'keyId'.
 * Both 'connectionType' and 'keyId' wont have '-' symbol.
 * @param {Object} peerAdvertisesData
 * @private
 * @return {string}
 */
ThaliPullReplicationFromNotification._getPeerDictionaryKey =
  function (peerAdvertisesData) {
    return peerAdvertisesData.connectionType + '-' + peerAdvertisesData.keyId;
  };

/**
 * We have a new data for us ('peerAdvertisesData').
 * We are going to create a replication action based on this data.
 * We should make a single action from multiple data
 * with the same 'connectionType' and 'keyId'.
 * @param {Object} peerAdvertisesData
 * @private
 */
ThaliPullReplicationFromNotification.prototype._peerAdvertisesDataForUsHandler =
  function (peerAdvertisesData) {
    if (!peerAdvertisesData.portNumber) {
      logger.error(
        'We don\'t support client notification that a peer is gone, yet.'
      );
      return;
    }

    var key = ThaliPullReplicationFromNotification.
      _getPeerDictionaryKey(peerAdvertisesData);
    var existingAction = this._peerDictionary[key];
    if (existingAction) {
      assert(
        existingAction.getActionState() === PeerAction.actionState.CREATED,
        'If the action had been started or killed then it should have been ' +
        'removed from the dictionary before we got to this code.'
      );
      existingAction.kill();
    }

    var newAction = new ThaliReplicationPeerAction(
      peerAdvertisesData, this._PouchDB, this._dbName, this._publicKey
    );
    assert(
      !this._peerDictionary[key],
      'we should not have an entry for this key by this point'
    );
    this._peerDictionary[key] = newAction;
    this._bindRemoveActionFromPeerDictionary(newAction, key);

    var enqueueError = this._thaliPeerPoolInterface.enqueue(newAction);
    if (enqueueError) {
      logger.warn('_peerAdvertisesDataForUsHandler: failed to enqueue an item: %s',
        enqueueError.message);
    }
  };

/**
 * Store action in the _peerDictionary and listen to the killed and started
 * events.
 *
 * Action should be deleted from 'peerDictionary' (by special 'key')
 * on first starting or killed event.
 * @private
 * @param {module:thaliPeerAction~PeerAction} action
 * @param {string} key
 */
ThaliPullReplicationFromNotification.prototype.
  _bindRemoveActionFromPeerDictionary = function (action, key) {
    var self = this;

    // TODO Investigate whether EventEmitter with action will provide a memory
    // leak.
    function removeFromDictionary () {
      action.removeListener('started', removeFromDictionary);
      action.removeListener('killed', removeFromDictionary);
      assert(
        self._peerDictionary[key], 'The entry should exist because this is ' +
        'the only place that can remove it'
      );
      delete self._peerDictionary[key];
    }

    action.on('started', removeFromDictionary);
    action.on('killed', removeFromDictionary);
  };

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
    // Can we start now?
    if (this.state === ThaliPullReplicationFromNotification.STATES.STARTED) {
      return;
    }
    assert(
      this.state === ThaliPullReplicationFromNotification.STATES.CREATED ||
      this.state === ThaliPullReplicationFromNotification.STATES.STOPPED,
      'ThaliPullReplicationFromNotification state should be ' +
      '\'CREATED\' or \'STOPPED\' for start'
    );
    this.state = ThaliPullReplicationFromNotification.STATES.STARTED;

    this._thaliNotificationClient.on(
      this._thaliNotificationClient.Events.PeerAdvertisesDataForUs,
      this._boundAdvertiser
    );
    this._thaliNotificationClient.start(prioritizedReplicationList);

    logger.debug('starting thaliPeerPoolInterface');
    this._thaliPeerPoolInterface.start();
  };

/**
 * Stops listening for new peer discovery and shuts down all replication
 * actions.
 *
 * This method is idempotent.
 * @public
 */
ThaliPullReplicationFromNotification.prototype.stop = function () {
  var self = this;
  // Can we stop now?
  if (
    self.state === ThaliPullReplicationFromNotification.STATES.CREATED ||
    self.state === ThaliPullReplicationFromNotification.STATES.STOPPED
  ) {
    return;
  }
  assert(
    self.state === ThaliPullReplicationFromNotification.STATES.STARTED,
    'ThaliPullReplicationFromNotification state should be \'STARTED\' for stop'
  );
  self.state = ThaliPullReplicationFromNotification.STATES.STOPPED;

  self._thaliNotificationClient.removeListener(
    self._thaliNotificationClient.Events.PeerAdvertisesDataForUs,
    self._boundAdvertiser
  );
  self._thaliNotificationClient.stop();

  Object.getOwnPropertyNames(self._peerDictionary)
    .forEach(function (actionName) {
    // This kill is theoretically redundant with the one that will also happen
    // in the thaliPeerPoolInterface but having kill happen here also prevents
    // race conditions between this and thaliPeerPoolInterface and it isn't
    // harmful since it's always legal to kill an action multiple times.
      self._peerDictionary[actionName].kill();
    });

  self._peerDictionary = {};
};

/**
 * This method will provide the actual state of
 * ThaliPullReplicationFromNotification
 * @public
 * @returns {ThaliPullReplicationFromNotification.STATES}
 */
ThaliPullReplicationFromNotification.prototype.getState = function () {
  return this.state;
};

module.exports = ThaliPullReplicationFromNotification;
