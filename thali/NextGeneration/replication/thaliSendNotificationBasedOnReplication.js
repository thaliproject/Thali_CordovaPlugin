'use strict';

var util   = require('util');
var format = util.format;

var assert        = require('assert');
var Promise       = require('bluebird');
var urlsafeBase64 = require('urlsafe-base64');
var extend        = require('js-extend').extend;

var thaliConfig             = require('../thaliConfig');
var PromiseQueue            = require('./../promiseQueue');
var ThaliNotificationServer = require('../notification/thaliNotificationServer');

var utilities           = require('./utilities');
var compareBufferArrays = utilities.compareBufferArrays;
var RefreshTimerManager = utilities.RefreshTimerManager;
var TransientState      = utilities.TransientState;

var logger = require('../../ThaliLogger')
  ('thaliSendNotificationBasedOnReplication');


/** @module thaliSendNotificationBasedOnReplication */

/**
 * @classdesc This class handles determining who to notify about changes to a
 * local database. We are given a list of peers to look for, we wait for changes
 * in the local DB and then we check to see if any of those peers haven't sync'd
 * those changes and if so then we raise a notification with the
 * thaliNotificationServer.
 *
 * When we are told to notify a peer of a change we have to remember the need to
 * notify that peer even across reboots of the app. Otherwise if the app stops
 * and restarts we won't know who we were supposed to notify and there is no new
 * data coming in that will tell us. For each peer we care about we will track
 * what is the last sequence number they have synch'd up to. We can find this
 * information by retrieving the `_Local/thali<peer ID>` record for that peer.
 * If it doesn't exist then we treat their last sync'd sequence number as 0. We
 * can get the current sequence number for the database from the PouchDB info()
 * function in the update_seq field. Now we just compare the number in the
 * _Local record against the current sequence number and we know who we need to
 * notify. See http://thaliproject.org/ReplicationAcrossDiscoveryProtocol/ for
 * details.
 *
 * BUGBUG: Although this is a 'new' able class in reality it is only intended to
 * be used as a singleton. There must not be more than one instance of this
 * class in the same app or errors will occur. We absolutely can fix that if
 * someone has a killer scenario they are shipping that needs this fixed.
 *
 * @param {Object} router An express router object that the class will use
 * to register its path to handle beacons.
 * @param {ECDH} ecdhForLocalDevice - A Crypto.ECDH object initialized with the
 * local device's public and private keys
 * @param {number} millisecondsUntilExpiration - The number of milliseconds into
 * the future after which the beacons should expire.
 * @param {PouchDB} pouchDB database we are tracking changes on.
 * @constructor
 */
function ThaliSendNotificationBasedOnReplication(
  router, ecdhForLocalDevice, millisecondsUntilExpiration, pouchDB
  ) {
  this._router  = router;
  this._pouchDB = pouchDB;
  this._millisecondsUntilExpiration = millisecondsUntilExpiration;

  this._thaliNotificationServer = new ThaliNotificationServer(
    router, ecdhForLocalDevice, millisecondsUntilExpiration
  );

  this._promiseQueue = new PromiseQueue();

  this._resolve     = null;
  this._reject      = null;
  this._isCompleted = false;
}

/**
 * We will only update the notification beacons every X milliseconds while the
 * app is in the foreground where X is defined below.
 *
 * @public
 * @type {number}
 */
ThaliSendNotificationBasedOnReplication.UPDATE_WINDOWS_FOREGROUND = 1000;

/**
 * We will only update the notification beacons every X milliseconds while the
 * app is in the background where X is defined below.
 *
 * @public
 * @type {number}
 */
ThaliSendNotificationBasedOnReplication.UPDATE_WINDOWS_BACKGROUND = 10000;

/**
 * We MUST NOT submit more than this number of peers to the
 * {@link module:thaliNotificationServer~ThaliNotificationServer}.
 * @public
 * @type {number}
 */
ThaliSendNotificationBasedOnReplication.MAXIMUM_NUMBER_OF_PEERS_TO_NOTIFY = 10;

/**
 * Takes an ecdh public key value as a buffer and creates the doc ID to find
 * the seq number in _Local.
 *
 * @public
 * @param {Buffer} ecdhPublicKey
 * @returns {string}
 */
ThaliSendNotificationBasedOnReplication.calculateSeqPointKeyId =
  function (ecdhPublicKey) {
    return thaliConfig.LOCAL_SEQ_POINT_PREFIX +
      urlsafeBase64.encode(ecdhPublicKey);
  };

// Values created by the constructor and invariant for the life of the object,
// including across starts and stops.
extend(ThaliSendNotificationBasedOnReplication.prototype, {
  _router:  null,
  _pouchDB: null,
  _millisecondsUntilExpiration: null,

  _thaliNotificationServer: null,

  _promiseQueue: null,

  _transientState: null,

  _resolve:     null,
  _reject:      null,
  _isCompleted: false
});


/**
 * State that object is in
 *
 * @private
 * @readonly
 * @enum {string}
 */
var stateEnum = {
  STARTING:  'starting',
  STARTED:   'started',
  COMPLETED: 'completed',
  STOPPING:  'stopping',
  STOPPED:   'stopped'
};

ThaliSendNotificationBasedOnReplication.prototype._state = stateEnum.STOPPED;

ThaliSendNotificationBasedOnReplication.prototype.getPskIdToSecret =
  function () {
    return this._thaliNotificationServer.getPskIdToSecret();
  };

ThaliSendNotificationBasedOnReplication.prototype.getPskIdToPublicKey =
  function () {
    return this._thaliNotificationServer.getPskIdToPublicKey();
  };

/**
 * Will start monitoring the submitted pouchDB and updating the notification
 * layer with peers to notify of changes.
 *
 * This method is idempotent if called with the same argument.
 *
 * Whenever start is called we have to re-evaluate our situation. If start
 * is called with the same public key list as the previous call then we MUST
 * do nothing. By "same" we mean object equality only. If it is called with a
 * new list then we MUST re-run beacon generation and advertise a new ID.
 *
 * BUGBUG: Obviously we should be nicer and do things like check if the new
 * lists's content is the same as the old list. Also even if the lists are
 * different if the new list just removes entries from the old list then we can
 * just update the version of folks to notify on disk but ignore them in memory
 * (for reasons described below). There are other optimizations possible but
 * let's first get things running.
 *
 * Every standard interval we will check to see if one of two
 * possible situations exist:
 *
 * Beacons have expired - When we publish beacons we do so with an expiration
 * date. If that date has been reached then we have to generate the entire
 * beacon string afresh.
 *
 * Beacons have changed - Every time we update our advertising ID we force
 * everyone to come and get the new beacons. This is expensive for folks'
 * batteries. So ideally we want to change those IDs as infrequently as
 * possible. Let's look at the events that might cause us to need to change our
 * ID and see how we can handle them.
 *
 * - Add a new beacon - Imagine we have a new person we need to notify about
 * changes. Right now that can only happen via a call to start with an updated
 * list of people to notify. We have to change the ID on this one because it's
 * possible that the targeted device already retrieved the beacons under the
 * current ID and so won't know there is a new beacon. So anytime we create
 * a new beacon we need to change our advertising ID. Note however that we do
 * not have to change our ephemeral key in this case and we do not have to
 * change any of the existing beacons. We just have to add the new one.
 *
 * - Remove a beacon - This can happen in two different ways. One way is if the
 * targeted device has synch'd and we don't need to advertise their beacon any
 * more. I don't know if we will even bother implementing this. Seems like it
 * would leak too much data we don't need to leak. The other reason though is if
 * we have removed someone from our permission list. That is kind of tricky and
 * I suspect for now we just won't implement remove a beacon logic. Instead
 * when we do have to change our ID we will refresh all the beacons, or not, see
 * below.
 *
 * - Change an existing beacon - Imagine we have advertised a beacon for device
 * X when sequence number was Y and now sequence number is Z (Z > Y). We have a
 * challenge that device X has already synched with the existing ID and so if we
 * don't change the ID they won't realize we have new information for them. But
 * we have to remember that once a device has sync'd with us for any reason then
 * they know we are around and if immediately knowing about changes is important
 * to them then they should probably use live sync. The point is that it's
 * probably o.k. to not immediately push out a new ID when dealing with changes
 * to an existing beacon. What we can do is use a long time interval between
 * full refreshes of the beacon list and depend on sync behavior to catch
 * updates in the intervals between (e.g. if it matters then apps should be
 * using live replication).
 *
 * Where this leaves us is that we do need to have some kind of interval
 * (preferably pretty long, say 10 minutes, but this should be configurable).
 * When that interval is up then we need to completely refresh all the tokens.
 * This means checking our list of users, seeing what ID they have synch'd up
 * to, identifying everyone who isn't sync'd up and generating an entire new
 * beacon string for them. If there are no beacons to advertise then we will
 * submit an empty list.
 *
 * Although unlikely it is theoretically possible for processing the list to
 * take long enough that we bump into the next interval. In that case we
 * MUST finish the current interval and skip the intervals we 'ran over' into.
 *
 * Now just to complicate things we really don't want to have any timers running
 * unless we absolutely have to because they require waking up the whole thread
 * and thus the core and aren't battery friendly. So typically the only timer
 * we will have running is the token expiration timer which should be very
 * long (as in days). We are assuming that the timer code is managed by the OS
 * and doesn't require keeping node.js around but if it does then we'll have to
 * come up with an alternative approach for the expiration timer.
 *
 * Otherwise we will have a standard interval to wait before we update beacons
 * even if they need updating. The idea then being that we have a listener on
 * the DB and if we get a change notification we will measure how long it has
 * been since we last did a beacon update. If we are at or beyond the update
 * window then we will do the update immediately. If we are before the window
 * then we will set a timer to wake us up when the window arrives. This means
 * that if we get any more change updates and we detect that we already have a
 * timer running we won't worry about the update since we will catch it when
 * the timer goes off. And yes, if we get updates while we are in the middle of
 * a beacon update we should be fine since the beacon just says "new stuff" not
 * how new. So any db updates that occur while updating the beacons can be
 * safely ignored. The really complex scenario is what do we do if start is
 * called while we are in the middle of updating the beacons? My feeling is that
 * we should just set a new timer and call it a day.
 *
 * @public
 * @param {Buffer[]} prioritizedPeersToNotifyOfChanges This is the list of peers
 * who are to be notified whenever there is a change to the database. The array
 * contains a serialization of the public ECDH keys of the relevant peers.
 * @returns {Promise<?Error>} resolves to null if the beacons were successfully
 * updated otherwise rejects with an Error.
 */
ThaliSendNotificationBasedOnReplication.prototype.start =
  function (prioritizedPeersToNotifyOfChanges) {
    return this._promiseQueue.enqueue(
      this._commonStart(prioritizedPeersToNotifyOfChanges)
    );
  };

ThaliSendNotificationBasedOnReplication.prototype._startFirst =
  function (prioritizedPeersToNotifyOfChanges, checkFn) {
    return this._promiseQueue.enqueueAtTop(
      this._commonStart(prioritizedPeersToNotifyOfChanges, checkFn)
    );
  };

/**
 * @callback checkCallback
 * @returns {boolean}
 */

/**
 *
 * @param {Buffer[]} prioritizedPeersToNotifyOfChanges
 * even if the prioritiedPeersToNotifyOfChanges hasn't changed since the last
 * call to _commonStart. This is needed in cases where the database has updated.
 * @param {checkCallback} [checkFn] Lets us run checks to determine if we need
 * to run. If false then don't run. If true, then do run.
 * @returns {module:promiseQueue~promiseFunction}
 * @private
 */
ThaliSendNotificationBasedOnReplication.prototype._commonStart =
  function (prioritizedPeersToNotifyOfChanges, checkFn) {
    var self = this;

    assert(
      prioritizedPeersToNotifyOfChanges,
      'prioritizedPeersToNotifyOfChanges is required'
    );

    return function (resolve, reject) {
      if (checkFn) {
        if (!checkFn()) {
          resolve();
          return;
        }
      } else {
        if (
          (
            self._state === stateEnum.STARTING ||
            self._state === stateEnum.STARTED
          ) &&
          compareBufferArrays(
            self._transientState.prioritizedPeersToNotifyOfChanges,
            prioritizedPeersToNotifyOfChanges
          )
        ) {
          resolve();
          return;
        }
      }

      self._state = stateEnum.STARTING;

      if (self._transientState) {
        self._transientState.cleanUp();
      }

      self._transientState = new TransientState(
        prioritizedPeersToNotifyOfChanges
      );

      self._updateBeacons(prioritizedPeersToNotifyOfChanges)
      .then(function () {
        self._state = stateEnum.STARTED;
        resolve();
      }).catch(function (error) {
        self._state = stateEnum.STOPPED;
        reject(error);
      });
    };
  };

ThaliSendNotificationBasedOnReplication.prototype._updateBeacons =
  function (prioritizedPeersToNotifyOfChanges) {
    var self = this;

    var retrievedSeqValue = null;

    return self._findSequenceNumber()
    .then(function (seqValue) {
      retrievedSeqValue = seqValue;
      return self._calculatePeersToNotify(
        seqValue, prioritizedPeersToNotifyOfChanges
      );
    })
    .then(function (peers) {
      if (peers.length > 0) {
        self._transientState.lastTimeBeaconsWereUpdated = Date.now();
        self._updateOnExpiration(self._millisecondsUntilExpiration);
      }
      if (prioritizedPeersToNotifyOfChanges.length > 0) {
        self._setUpChangeListener(retrievedSeqValue);
      }
      return self._thaliNotificationServer.start(peers);
    })
  };

ThaliSendNotificationBasedOnReplication.prototype._setUpChangeListener =
  function (seqValue) {
    var self = this;

    assert.equal(
      this._transientState.pouchDBChangesCancelObject,
      null,
      'Something went wrong in initialization'
    );
    var transientStateWhenCreated = this._transientState;

    this._replicationPromise = new Promise(function (resolve, reject) {
      self._resolve = resolve;
      self._reject  = reject;
      self._transientState.pouchDBChangesCancelObject = self._pouchDB.changes({
        live:    true,
        since:   seqValue,
        timeout: false // Not sure we really need this
      })
      .on('change', function () {
        // This check will guarantee that the object's transient variables
        // are in a trustworthy state.
        assert(
          self._state === stateEnum.STARTED,
          format('Our state was not started, state: \'%s\'', self._state)
        );

        // This catches a theoretical race condition where the change listener
        // was closed down due to a start or stop but somehow the change
        // event still got queued.
        assert(
          self._transientState === transientStateWhenCreated,
          'transient states should match'
        );

        // All the peers were up to date when start was called so we never
        // sent out a beacon, but now we may need to because there has been a
        // change.
        if (self._transientState.lastTimeBeaconsWereUpdated === 0) {
          assert.equal(
            self._transientState.beaconRefreshTimerManager, null,
            'If the tokens were never updated then there should not be a ' +
            'beacon timer'
          );
          self._transientState.lastTimeBeaconsWereUpdated = Date.now();
          self._updateOnExpiration(0);
          return;
        }

        assert(
          self._transientState.beaconRefreshTimerManager,
          'If beacons were previously updated ' +
          'then there has to be a refresh timer for them.'
        );

        var soonestPossibleRefresh =
          self._transientState.lastTimeBeaconsWereUpdated +
          ThaliSendNotificationBasedOnReplication.UPDATE_WINDOWS_FOREGROUND;

        var whenTimerWillRun =
          self._transientState.beaconRefreshTimerManager.getTimeWhenRun();

        assert.notEqual(
          whenTimerWillRun, null,
          'How can there be a change listener without a started timer?'
        );

        // A race condition where the timer has fired and run but the change
        // listener got run before the scheduled startFirst call from the
        // timer has had a chance to execute.
        if (whenTimerWillRun === -1) {
          logger.debug('whenTimerWillRun is -1');
          return;
        }

        if (whenTimerWillRun > soonestPossibleRefresh) {
          var milliSecondsUntilNextRefresh =
            soonestPossibleRefresh - Date.now();
          if (milliSecondsUntilNextRefresh >= 0) {
            self._updateOnExpiration(milliSecondsUntilNextRefresh);
          }
        }
      })
      .on('complete', function (info) {
        logger.debug('changes completed, info: \'%s\'', JSON.stringify(info));
        self._complete(info.errors);
      })
      .on('error', function (error) {
        logger.error('unexpected error: \'%s\'', JSON.stringify(error));
        self._complete([error]);
      });
    });
  };

/**
 * Sets a timer to refresh the beacons before they expire. If the expiration
 * value is <= 0 then we clear the existing refresh timer if any but otherwise
 * do nothing since there are no beacons to refresh.
 * @param {number} millisecondsUntilRun If <= 0 then after the current
 * timer (if any) is disabled a new one won't be set.
 * @private
 */
ThaliSendNotificationBasedOnReplication.prototype._updateOnExpiration =
  function (millisecondsUntilRun) {
    var self = this;

    if (this._transientState.beaconRefreshTimerManager) {
      this._transientState.beaconRefreshTimerManager.stop();
      this._transientState.beaconRefreshTimerManager = null;
    }

    assert.notEqual(
      this._transientState.lastTimeBeaconsWereUpdated, 0,
      'There should not be a path that lets us get to _updateOnExpiration ' +
      'without the last beacon value being initialized to something other ' +
      'than 0.'
    );

    var transientStateWhenWereCreated = this._transientState;

    var lastTimeBeaconsWereUpdatedWhenWeWereCreated =
      this._transientState.lastTimeBeaconsWereUpdated;

    var prioritizedPeers =
      this._transientState.prioritizedPeersToNotifyOfChanges;

    this._transientState.beaconRefreshTimerManager = new RefreshTimerManager(
      millisecondsUntilRun,
      function () {
        self._startFirst(
          prioritizedPeers,
          function () {
            return (
              self._state === stateEnum.STARTED &&
              transientStateWhenWereCreated === self._transientState &&
              self._transientState.lastTimeBeaconsWereUpdated ===
                lastTimeBeaconsWereUpdatedWhenWeWereCreated
            );
          }
        );
      }
    );

    this._transientState.beaconRefreshTimerManager.start();
  };

ThaliSendNotificationBasedOnReplication.prototype._complete =
  function (errors) {
    if (this._state === stateEnum.COMPLETED) {
      return;
    }
    this._state = stateEnum.COMPLETED;

    assert(this._resolve, 'resolve should exist');
    assert(this._reject,  'reject should exist');

    if (!errors || errors.length === 0) {
      this._resolve();
    } else {
      this._reject(errors[0]);
    }

    this._resolve = null;
    this._reject  = null;
  }

ThaliSendNotificationBasedOnReplication.prototype._findSequenceNumber =
  function () {
    return this._pouchDB.info()
      .then(function (result) {
        // jscs:disable requireCamelCaseOrUpperCaseIdentifiers
        return result.update_seq;
        // jscs:enable requireCamelCaseOrUpperCaseIdentifiers
      });
  };

/**
 * Calculates which peers need to be notified of changes by looking each peer's
 * last sync point up in the local DB. Any peer whose sync point isn't equal to
 * or greater than (gotta love race conditions) the sync point we are looking
 * for will be returned as someone to notify of a change.
 *
 * @private
 * @param {number} seqValue The current sequence value we found.
 * @param {Buffer[]} prioritizedPeersToNotifyOfChanges Buffer array containing
 * the ECDH public keys of the peers who we want to notify if there are any
 * changes they have not seen yet.
 * @returns {Promise<Buffer[]|Error>} If successful an array of buffers
 * containing the public keys of the peers that need notification.
 */
ThaliSendNotificationBasedOnReplication.prototype._calculatePeersToNotify =
  function (seqValue, prioritizedPeersToNotifyOfChanges) {
    var self = this;

    if (prioritizedPeersToNotifyOfChanges.length === 0 || seqValue === 0) {
      return Promise.resolve([]);
    }

    var promises = prioritizedPeersToNotifyOfChanges.map(function (ecdhPublicKey) {
      var peerSequenceKeyId = ThaliSendNotificationBasedOnReplication
        .calculateSeqPointKeyId(ecdhPublicKey);
      return self._pouchDB.get(peerSequenceKeyId)
      .then(function (doc) {
        var peerSeqId = doc.lastSyncedSequenceNumber;
        if (peerSeqId !== undefined && peerSeqId < seqValue) {
          return ecdhPublicKey;
        }
        return null;
      })
      .catch(function (error) {
        if (error.status === 404) {
          return ecdhPublicKey;
        }
        return Promise.reject(err);
      });
    });

    return Promise.all(promises)
    .then(function (results) {
      return results
      .filter(Boolean)
      .slice(
        0,
        ThaliSendNotificationBasedOnReplication.MAXIMUM_NUMBER_OF_PEERS_TO_NOTIFY
      );
    });
  };

/**
 * Will stop monitoring the submitted pouchDB and stop the notification layer.
 *
 * @public
 * @returns {Promise<?Error>}
 */
ThaliSendNotificationBasedOnReplication.prototype.stop = function () {
  var self = this;

  this._state = stateEnum.STOPPING;

  return this._promiseQueue.enqueue(
    function (resolve, reject) {
      if (!self._transientState) {
        self._state = stateEnum.STOPPED;
        resolve();
        return;
      }

      self._transientState.cleanUp();
      self._transientState = null;

      // We have just killed replication request.
      // We don't care if this request will end with an error.
      Promise.all([
        Promise.resolve()
        .then(function () {
          if (self._replicationPromise) {
            return self._replicationPromise
            .catch(function () {});
          }
        }),
        self._thaliNotificationServer.stop()
      ])
      .finally(function () {
        self._state = stateEnum.STOPPED;
      })
      .then(function () {
        resolve();
      }).catch(function (error) {
        reject(error);
      });
    }
  );
};

module.exports = ThaliSendNotificationBasedOnReplication;
