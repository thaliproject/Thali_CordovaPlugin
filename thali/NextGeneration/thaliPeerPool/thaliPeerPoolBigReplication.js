'use strict';

var util = require('util');
var ThaliPeerPoolInterface = require('./thaliPeerPoolInterface');
var thaliConfig = require('../thaliConfig');
var ForeverAgent = require('forever-agent');
var logger = require('../../ThaliLogger')('thaliPeerPoolDefault');
var Utils = require('../utils/common.js');
var ThaliNotificationAction = require('../notification/thaliNotificationAction');
var ThaliReplicationPeerAction = require('../replication/thaliReplicationPeerAction');
var ThaliMobileNativeWrapper = require('../thaliMobileNativeWrapper');

/** @module thaliPeerPoolBigReplication */

var QueueSkeleton = function() {};
QueueSkeleton.prototype.runningActions = [];
QueueSkeleton.prototype.notificationActions = [];
QueueSkeleton.prototype.replicationActions = [];

/**
 * @classdesc This is an implementation of the
 * {@link module:thaliPeerPoolInterface~ThaliPeerPoolInterface} interface that
 * is optimized for cases where the amount of data to be replicated between
 * peers is expected to be reasonably large.
 *
 * WARNING: This code is more a skeleton than anything else.
 *
 * This pool has awareness of two types of actions, thaliNotificationAction and
 * thaliReplicationPeerAction. If it gets any other type of action it will
 * log an error and call kill on the action.
 *
 * # Wifi
 *
 * With Wifi we can usually be pretty easy going in terms of bandwidth usage
 * but we don't want to go crazy. So our rules are that:
 * 1. For any given peerID we will have exactly one notification action
 * running at any time
 * 1. For any given public key we will have exactly one replication action
 * running at any time.
 * 2. We will have no more than 10 notification actions running in parallel
 * 3. We will have no more than 3 replication actions running in parallel
 *
 * # MPCF
 *
 * Until we get more experience with MPCF we will use the Wifi policy but have
 * different queues.
 *
 * # Bluetooth
 *
 * With Bluetooth we have to be very restrictive because the bandwidth is just
 * awful. And the bandwidth seems to get worse non-linearly as a function of the
 * number of Bluetooth sockets we run. And right now we don't provide the right
 * notifications to control outgoing connections. So for now we will run exactly
 * one outgoing bluetooth socket a time. The trick is that even forming
 * bluetooth sockets takes time. So ideally if we already have a socket to a
 * particular peer we want to keep that socket to that peer. Normally this means
 * that if we have an outgoing thaliNotificationAction then we want to wait
 * until it resolves. If it resolves beaconsRetrievedAndParsed from the emitter
 * on the action and if beacon is not null then we know a replication action is
 * going to be created and enqueued. So what we will do is wait a short period
 * of time and just enqueue any new actions while we wait for the replication
 * action for that peer and then execute the replication action.
 *
 * We have two queues, a notificationAction queue and a replication action
 * queue.
 *
 * If the pool is sent a notificationAction then we will check the
 * notificationAction queue for an entry with the same peerID, if we find one
 * then we will remove which ever one has the lower generation accounting
 * for roll over.
 *
 * If the pool is sent a replicationAction then we will use the same logic but
 * for the replication action queue with the exception that we will check
 * replication actions both on the Wifi and the Bluetooth queues as well as the
 * running actions in Wifi. If we see a replication ID for the same peer public
 * key then we will kill this replication action in favor of the one in the Wifi
 * queue/running action.
 *
 * If we get a new action and there is no running action then we will pick any
 * entries off the replication queue first and only if that is empty will we
 * go to the notification action queue.
 *
 * When a running action ends if it ends with a connection failure then we will
 * try to find a new action on the replication queue and then the notification
 * queue. Within each queue we will prefer an action with a different peerID
 * from the one that just failed. But if we can't find an action in the queue
 * with a different peerID then we will use the action with the same peerID.
 *
 * # Connection pooling
 *
 * We owe each action an Agent to manage their connection count. The tricky
 * part here is that while we can re-use connections when we are talking to
 * the same peer, we can't re-use them across peers because the PSK will be
 * different. So in theory we have to create a new agent for each action but
 * for bonus points we could detect when we see the same peerID across two
 * different actions and have them share the same pool. We aren't going to
 * bother being that smart for right now.
 *
 * @public
 * @constructor
 */
function ThaliPeerPoolBigReplication() {
  ThaliPeerPoolBigReplication.super_.call(this);
  this._stopped = true;

  this._queueStates[ThaliMobileNativeWrapper.connectionTypes
                    .MULTI_PEER_CONNECTIVITY_FRAMEWORK] = new QueueSkeleton();
  this._queueStates[ThaliMobileNativeWrapper.connectionTypes.BLUETOOTH] =
    new QueueSkeleton();
  this._queueStates[ThaliMobileNativeWrapper.connectionTypes.TCP_NATIVE] =
    new QueueSkeleton();
}

util.inherits(ThaliPeerPoolBigReplication, ThaliPeerPoolInterface);
ThaliPeerPoolBigReplication.ERRORS = ThaliPeerPoolInterface.ERRORS;

ThaliPeerPoolBigReplication.ERRORS.ENQUEUE_WHEN_STOPPED = 'We are stopped';

ThaliPeerPoolBigReplication.WIFI_MAX_PARALLEL_NOTIFICATION_ACTIONS = 10;

ThaliPeerPoolBigReplication.WIFI_MAX_PARALLEL_REPLICATION_ACTIONS = 3;

ThaliPeerPoolBigReplication.prototype._queueStates = {};

function existsMatchingPeerId(peerId, actionArray) {

}

ThaliPeerPoolBigReplication.prototype._wifiEnqueue = function (peerAction) {
  switch (peerAction.getActionType()) {
    case ThaliNotificationAction.ACTION_TYPE: {

    }

  }
};

ThaliPeerPoolBigReplication.prototype._bluetoothEnqueue = function (peerAction) {

};

ThaliPeerPoolBigReplication.prototype._mpcfEnqueue = function (peerAction) {

};

ThaliPeerPoolBigReplication.prototype.enqueue = function (peerAction) {
  if (this._stopped) {
    throw new Error(ThaliPeerPoolBigReplication.ERRORS.ENQUEUE_WHEN_STOPPED);
  }

  switch (peerAction.getActionType()) {
    case ThaliNotificationAction.ACTION_TYPE:
    case ThaliReplicationPeerAction.ACTION_TYPE: {
      break;
    }
    default: {
      logger.error('We got an unrecognized action: ' +
        peerAction.getActionType());
      peerAction.kill();
      return new Error('Unrecognized action type');
    }
  }

  var result =
    ThaliPeerPoolBigReplication.super_.prototype.enqueue.apply(this, arguments);

  switch (peerAction.getConnectionType()) {
    case ThaliMobileNativeWrapper.connectionTypes
            .MULTI_PEER_CONNECTIVITY_FRAMEWORK: {
      return this._mpcfEnqueue(peerAction);
    }
    case ThaliMobileNativeWrapper.connectionTypes.BLUETOOTH: {
      return this._bluetoothEnqueue(peerAction);
    }
    case ThaliMobileNativeWrapper.connectionTypes.TCP_NATIVE: {
      return this._wifiEnqueue(peerAction);
    }
    default: {
      throw new Error('Unsupported connection type ' +
        peerAction.getConnectionType());
    }
  }

  var actionAgent = new ForeverAgent.SSL({
    keepAlive: true,
    keepAliveMsecs: thaliConfig.TCP_TIMEOUT_WIFI/2,
    maxSockets: Infinity,
    maxFreeSockets: 256,
    ciphers: thaliConfig.SUPPORTED_PSK_CIPHERS,
    pskIdentity: peerAction.getPskIdentity(),
    pskKey: peerAction.getPskKey()
  });

  // We hook our clean up code to kill and it is always legal to call
  // kill, even if it has already been called. So this ensures that our
  // cleanup code gets called regardless of how the action ended.
  peerAction.start(actionAgent)
    .catch(function (err) {
      logger.debug('Got err ', Utils.serializePouchError(err));
    })
    .then(function () {
      peerAction.kill();
    });

  return result;
};

ThaliPeerPoolBigReplication.prototype.start = function () {
  this._stopped = false;

  return ThaliPeerPoolBigReplication.super_.prototype.start.apply(this, arguments);
};

/**
 * This function is used primarily for cleaning up after tests and will
 * kill any actions that this pool has started that haven't already been
 * killed. It will also return errors if any further attempts are made
 * to enqueue.
 */
ThaliPeerPoolBigReplication.prototype.stop = function () {
  this._stopped = true;

  return ThaliPeerPoolBigReplication.super_.prototype.stop.apply(this, arguments);
};

module.exports = ThaliPeerPoolBigReplication;
