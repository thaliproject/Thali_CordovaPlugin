'use strict';

var assert = require('assert');

/**
 * Compares if two buffer arrays contain the same buffers in the same order.
 * @param {Buffer[]} buffArray1
 * @param {Buffer[]} buffArray2
 * @returns {boolean}
 */
function compareBufferArrays(buffArray1, buffArray2) {
  assert(Array.isArray(buffArray1), 'We only accept arrays.');
  assert(Array.isArray(buffArray2), 'We only accept arrays.');
  if (buffArray1.length !== buffArray2.length) {
    return false;
  }
  for (var i = 0; i < buffArray1.length; ++i) {
    var buff1 = buffArray1[i];
    assert(Buffer.isBuffer(buff1), 'Only buffers allowed in 1');
    var buff2 = buffArray2[i];
    assert(Buffer.isBuffer(buff2), 'Only buffers allowed in 2');
    if (Buffer.compare(buff1, buff2) !== 0) {
      return false;
    }
  }
  return true;
}

module.exports.compareBufferArrays = compareBufferArrays;

/**
 * @private
 * @callback thunk
 */

/**
 * @param {number} millisecondsUntilRun How long to wait before running this
 * timer
 * @param {thunk} fn The function to call when the timer is up.
 * @constructor
 */
function RefreshTimerManager(millisecondsUntilRun, fn) {
  assert(millisecondsUntilRun > 0, 'millisecondsUntilRun has to be > 0');
  this._millisecondsUntilRun = millisecondsUntilRun;
  this._fn = fn;
}

RefreshTimerManager.prototype._millisecondsUntilRun = null;
RefreshTimerManager.prototype._fn = null;
RefreshTimerManager.prototype._cancelObject = null;

/**
 * The time in milliseconds after the epoch when the function is roughly
 * scheduled to run. It also has several reserved values, see getTimeWhenRun
 * for details.
 * @type {?Object}
 * @private
 */
RefreshTimerManager.prototype._timeWhenRun = -2;

RefreshTimerManager.prototype.start = function () {
  if (this._timeWhenRun !== -2) {
    throw new Error('Start may only be called once and not after stop.');
  }
  var currentTime = Date.now();
  var self = this;
  self._cancelObject = setTimeout(
    function () {
      self._timeWhenRun = -1;
      self._fn();
    }, self._millisecondsUntilRun);
  self._timeWhenRun = currentTime + self._millisecondsUntilRun;
};

/**
 * Returns the number of milliseconds after the epoch when this timer is
 * scheduled to run. If the timer is stopped without running then this
 * returns null. If the submitted function has started execution this returns
 * -1. If start hasn't been called then -2 is returned.
 * @returns {?number}
 */
RefreshTimerManager.prototype.getTimeWhenRun = function () {
  return this._timeWhenRun;
};

RefreshTimerManager.prototype.stop = function () {
  if (this._cancelObject) {
    clearTimeout(this._cancelObject);
  }
  if (this._timeWhenRun !== -1) {
    this._timeWhenRun = null;
  }
};

function TransientState(prioritizedPeersToNotifyOfChanges) {
  assert.notEqual(prioritizedPeersToNotifyOfChanges, null, 'Not Null');
  assert(Array.isArray(prioritizedPeersToNotifyOfChanges), 'Must be array');
  this.prioritizedPeersToNotifyOfChanges = prioritizedPeersToNotifyOfChanges;
}

module.exports.RefreshTimerManager = RefreshTimerManager;

/**
 * @type {Buffer[]}
 */
TransientState.prototype.prioritizedPeersToNotifyOfChanges = null;
/**
 * @type {?Object}
 */
TransientState.prototype.pouchDBChangesCancelObject = null;
/**
 * @type {?RefreshTimerManager}
 */
TransientState.prototype.beaconRefreshTimerManager = null;
/**
 * @type {number} Number of milliseconds since the epoch.
 */
TransientState.prototype.lastTimeBeaconsWereUpdated = 0;

/**
 * Shuts down any live objects in the transient state.
 * @public
 */
TransientState.prototype.cleanUp = function () {
  if (this.pouchDBChangesCancelObject) {
    this.pouchDBChangesCancelObject.cancel();
    this.pouchDBChangesCancelObject = null;
  }

  if (this.beaconRefreshTimerManager) {
    this.beaconRefreshTimerManager.stop();
    this.beaconRefreshTimerManager = null;
  }
};

module.exports.TransientState = TransientState;
