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
var assert = require('assert');
var ThaliPeerAction = require('./thaliPeerAction');
var USN = require('../utils/usn');

/** @module thaliPeerPoolBigReplication */

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
 * # Universal Logic for notification actions added to the queue
 *
 * All notification actions for the same peerID are effectively identical
 * regardless of generation. In no case when we make a request to get beacons
 * (which is what a notification action does) will the generation play a direct
 * role. The only purpose of the generation is to let us know that state has
 * changed on the peer.
 *
 * So when a new notification action is submitted to the pool we have to run
 * a query to see if we have any existing notification actions for that peerID
 * and connection type in the queue. We can get up to two results.
 *
 * If there are two results then one MUST be in 'started' state and the other
 * MUST NOT. In that case we should call killSuperseded on the existing action
 * and put the new action at the head of the queue. We need to use
 * killSuperseded so that the thaliNotificationClient doesn't think we are just
 * resource constrained and tries to enqueue the action again later.
 *
 * If there is one result and it is in 'started' state then the new action MUST
 * be added to the top of the queue. This guarantees we will make at least
 * one more try which given certain race conditions is useful.
 *
 * If there is one result and it is not yet in started state then we MUST call
 * killSuperseded on the enqueued action and then put the new action at the top
 * of the queue under the general theory that it is 'freshest' and the
 * associated remote peer is still around.
 *
 * If there is no result then we should put the action at the top of the queue
 * since the data is 'fresh' and thus likely to result in a successful
 * connection.
 *
 * # Universal logic for replication actions added to the queue
 *
 * thaliSendNotificationBasedOnReplication will only allow one replication
 * action for any combination of connection type and peerID. But the current
 * system encodes both the real peerID and the generation into the value we
 * currently call peerID. When we talk about peerID below we are only talking
 * about the 'real' peerID. We treat the generation separately.
 *
 * Our flow is that we get a notification action, we start it, if it finds a
 * beacon then it will create a replication action which we want to run
 * immediately both because the peer is probably still around and because for
 * native links we want to re-use the link that was formed to get the beacons
 * since they are expensive to form.
 *
 * Therefore a replication action will only be added if we have first
 * successfully executed a notification action which encodes a beacon. In that
 * case What's going to happen is that _complete is going to be called on
 * thaliNotificationAction which will emit a resolved event which will
 * synchronously call _resolved which will synchronously emit
 * peerAdvertisesDataForUs which will then synchronously call
 * _peerAdvertisesDataForUsHandler in thaliPullReplicationFromNotification which
 * will then synchronously call enqueue. Only after all of that will we
 * synchronously call resolve on the start method for notification action.
 *
 * What's interesting about this code path is that it means we will get the
 * enqueue of the replication action for a successfully completed notification
 * action before we will get the promise result from calling start on that
 * action. This gives us a hacky way to handle the scenario where a notification
 * has completed with a beacon for us and we want to reserve a start action for
 * the replication. If we get a replication enqueued then we can check our
 * queue and if we find a notification action for the same peerID that is in
 * the state killed (it will only be physically removed from our queue once
 * we get the start promise back) and has its _resolution set to
 * BEACONS_RETRIEVED_AND_PARSED then we know this replication action is the
 * continuation of the notification action and we can start it immediately. Yes,
 * this is absurdly fragile and yes I've filed a bug -
 * https://github.com/thaliproject/Thali_CordovaPlugin/issues/1305
 *
 * When a new replication action is submitted we have to run a query on the
 * queue for any replication actions with the same connection Type and peerID.
 * There can be up to two results. But the logic of handling them is different
 * than for notification types because notification actions are directed at a
 * peerID where as a replication action is really pointed at an IP address
 * and port (even though there is an associated peerID).
 *
 * If there are no results then we need to put the replication action at the top
 * of the queue. This is because it's highly likely that the native connection
 * (for native transports) that was used for the notification action that then
 * spawned the replication action is still around.
 *
 * If there is one result and it is in started state then we need to add the
 * replication action to the top of the queue.
 *
 * If there is one result and it is not in started state and has the same IP
 * and port as the new replication action then we MUST call kill on the old
 * replication action (thus removing it from the queue) and add the new
 * replication action to the top of the queue.
 *
 * If there is one result and it is not in started state and does not have the
 * same IP and port as the new replication action then we should add the new
 * replication action to the start of the queue (on the theory that it is
 * probably newer and probably the right one, the other one should probably
 * fail).
 *
 * If there are two results then one MUST be in started state. In that case we
 * will just look at the second result which MUST NOT be in started state. We
 * MUST call kill on the existing replication action and add the new replication
 * action to the head of the queue. The theory being that we are only willing
 * to enqueue at most two replications (one of which must be running) for any
 * particular peerID.
 *
 * # Managing how many actions are started
 *
 * Our current design is based on actions being separately sent to the pool.
 * Perhaps we'll change that at some point. It would be nice, for example,
 * if the start method from the notification action actually returned the
 * replication action directly. But that's for another day.
 *
 * In general the way we handle things is that each connection type has a
 * certain number of actions it is willing to run in parallel. When an action is
 * enqueued (after we run the checks previously described for notification and
 * replication actions) we check to see if we are at our limit and if not then
 * we start the action. Otherwise we add the action to the queue.
 *
 * Now the first problem is that the thaliPeerPoolInterface, which we inherit
 * from, has its own queue, but it's not a queue. That is actually the wrong
 * name for it. It's really more of an associative array which indexes actions
 * by their unique IDs, not by the order in which they were added. So this means
 * that the code here has to keep a parallel, actual, queue which can keep
 * ordering. So when we say 'add the action to the queue' we actually mean the
 * real queue kept here.
 *
 * When we start an action we will hook to the action's start promise output
 * and use that to remove the action from our queue by calling kill on the
 * action once it is done.
 *
 * So now we can go over the whole life cycle of handling enqueuing actions.
 *
 * First when an action is enqueued we run the checks described in the previous
 * sections based on its type.
 *
 * Then we check to see if we have a free action slot by counting how many
 * actions on the queue are started. If there is a free slot then we take the
 * first action on the queue and start it.
 *
 * The only exception to this logic is if we are dealing with a replication
 * action in which case we run the check described in the previous paragraph.
 *
 * When an action's start method returns we will call kill on the action, remove
 * it from our queue and then run a check to see if there is a free start slot.
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
}

util.inherits(ThaliPeerPoolBigReplication, ThaliPeerPoolInterface);
ThaliPeerPoolBigReplication.ERRORS = ThaliPeerPoolInterface.ERRORS;

ThaliPeerPoolBigReplication.ERRORS.ENQUEUE_WHEN_STOPPED = 'We are stopped';

ThaliPeerPoolBigReplication.WIFI_MAX_START = 10;

ThaliPeerPoolBigReplication.BLUETOOTH_MAX_START = 1;

ThaliPeerPoolBigReplication.MPCF_MAX_START = 3;

ThaliPeerPoolBigReplication.prototype._queue = [];

/**
 * Currently we encode both the real peerID and the generation into a single
 * value we call peerID. That will change eventually.
 * @param {string} peerID
 * @param {module:thaliMobileNativeWrapper.connectionTypes} connectionType
 * @returns {string}
 * @private
 */
ThaliPeerPoolBigReplication.prototype._getPeerIdFromPeerId =
  function (peerID, connectionType) {
    switch(connectionType) {
      case ThaliMobileNativeWrapper.connectionTypes
        .MULTI_PEER_CONNECTIVITY_FRAMEWORK:
      case ThaliMobileNativeWrapper.connectionTypes.BLUETOOTH: {
        var split = peerID.split(':');
        assert(split.length >= 2,
          'We got a peerID with a format we do not recognize!');
        return split[0];
      }
      case ThaliMobileNativeWrapper.connectionTypes.TCP_NATIVE: {
        var peerObject = USN.parse(peerID);
        return peerObject.realPeerIdentifier;
      }
      default: {
        throw new Error('Unsupported connection type in ' +
          'ThaliPeerPoolBigReplication');
      }
    }
};

ThaliPeerPoolBigReplication.prototype._searchQueue =
  function (connectionType, actionType, peerID, doNotIncludeKilled) {
    return this._queue.filter(function (peerAction) {
      var connectionTypeMatch = !connectionType ||
        peerAction.getConnectionType() === connectionType;
      var actionTypeMatch = !actionType ||
          peerAction.getActionType() === actionType;
      var peerIDMatch = !peerID ||
          this._getPeerIdFromPeerId(peerAction.getPeerIdentifier()) ===
            peerID;
      var doNotIncludeKilledMatch = !doNotIncludeKilled ||
          this.getActionState() !== ThaliPeerAction.actionState.KILLED;
      return connectionTypeMatch && actionTypeMatch && peerIDMatch &&
        doNotIncludeKilledMatch;
    });
  };

ThaliPeerPoolBigReplication.prototype._case2 =
  function (enqueuedActions, killMethodName) {
    assert(enqueuedActions[0].getActionState() ===
      ThaliPeerAction.actionState.STARTED ||
      enqueuedActions[1].getActionState() ===
      ThaliPeerAction.actionState.STARTED, 'At least one action MUST be' +
      'started');
    assert(enqueuedActions[0].getActionState() !==
      ThaliPeerAction.actionState.STARTED ||
      enqueuedActions[1].getActionState() !==
      ThaliPeerAction.actionState.STARTED, 'At most one action can be' +
      'started');
    enqueuedActions.filter(function (notificationAction) {
      return notificationAction.getActionState() !==
        ThaliPeerAction.actionState.STARTED;
    })[0][killMethodName]();
  };

ThaliPeerPoolBigReplication.prototype._notificationActionEnqueue =
  function (notificationAction) {
    var enqueuedActions =
      this._searchQueue(notificationAction.getConnectionType(),
        notificationAction.getActionType(),
        notificationAction.getPeerIdentifier(), true);
    switch (enqueuedActions.length) {
      case 0: {
        break;
      }
      case 1: {
        if (enqueuedActions.getActionState() ===
          ThaliPeerAction.actionState.CREATED) {
          enqueuedActions[0].killSuperseded();
        }
        break;
      }
      case 2: {
        this._case2(enqueuedActions, 'killSuperseded');
        break;
      }
      default: {
        throw new Error('We got more enqueued notification actions than ' +
          'should be possible');
      }
    }
    this._queue.splice(0, 0, notificationAction);
    return null;
  };

ThaliPeerPoolBigReplication.prototype._replicationActionEnqueue =
  function (replicationAction) {
    var enqueuedKilledNotificationAction =
      this._searchQueue(replicationAction.getConnectionType(),
        ThaliNotificationAction.ACTION_TYPE,
        replicationAction.getPeerIdentifier(), false);

    if (enqueuedKilledNotificationAction) {
      assert(enqueuedKilledNotificationAction.length === 1, 'It should not' +
        'be possible to have more than one killed notification action for' +
        'the given peer ID');
      if (enqueuedKilledNotificationAction[0].getResolution() ===
      ThaliNotificationAction.ActionResolution.BEACONS_RETRIEVED_AND_PARSED) {
        this._queue.splice(0, 0, replicationAction);
        return replicationAction;
      }
    }

    var enqueuedActions =
      this._searchQueue(replicationAction.getConnectionType(),
        replicationAction.getActionType(),
        replicationAction.getPeerIdentifier(), true);

    switch (enqueuedActions) {
      case 0: {
        break;
      }
      case 1: {
        if (enqueuedActions[0].getActionState() ===
          ThaliPeerAction.actionState.CREATED) {
          var enqueuedPeerData =
            enqueuedActions[0].getPeerAdvertisesDataForUs();
          var newPeerData =
            replicationAction.getPeerAdvertisesDataForUs();
          if (enqueuedPeerData.hostAddress === newPeerData.hostAddress &&
              enqueuedPeerData.portNumber === newPeerData.portNumber) {
            enqueuedActions[0].kill();
          }
        }
        break;
      }
      case 2: {
        this._case2(enqueuedActions, 'kill');
        break;
      }
      default: {
        throw new Error('We got more enqueued replication action than should ' +
          'be possible');
      }
    }
    this._queue.splice(0, 0, replicationAction);
    return null;
  };

ThaliPeerPoolBigReplication.prototype._startAction = function (peerAction) {
  var self = this;
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
      self._checkToRun(peerAction.getConnectionType());
    });
};

ThaliPeerPoolBigReplication.prototype._killAction = function (peerAction) {
  var enqueuedActionIndex = this._queue.indexOf(peerAction);
  assert(enqueuedActionIndex !== -1, 'Nobody should be able to remove this' +
    'action from our queue without having called kill and gone through' +
    'this method');
  delete this._queue[enqueuedActionIndex];
};

ThaliPeerPoolBigReplication.prototype._checkToRun = function (connectionType) {
  var maxActions = 0;
  switch (connectionType) {
    case ThaliMobileNativeWrapper.connectionTypes
      .MULTI_PEER_CONNECTIVITY_FRAMEWORK: {
      maxActions = ThaliPeerPoolBigReplication.MPCF_MAX_START;
      break;
    }
    case ThaliMobileNativeWrapper.connectionTypes.BLUETOOTH: {
      maxActions = ThaliPeerPoolBigReplication.BLUETOOTH_MAX_START;
      break;
    }
    case ThaliMobileNativeWrapper.connectionTypes.TCP_NATIVE: {
      maxActions = ThaliPeerPoolBigReplication.WIFI_MAX_START;
      break;
    }
    default: {
      throw new Error('Unsupported connection type ' + connectionType);
    }
  }

  var runningActionsCount = this._queue.filter(function (action) {
    return action.getConnectionType() === connectionType &&
        action.getActionState() === ThaliPeerAction.actionState.STARTED;
  }).length;

  var actionsToStart = maxActions - runningActionsCount;

  assert(actionsToStart >= 0, 'We should never have more than ' + maxActions +
    ' actions for connectionType ' + connectionType + ' but we have ' +
      runningActionsCount);

  if (actionsToStart === 0) {
    return;
  }

  this._queue.filter(function (action) {
    return action.getConnectionType() === connectionType &&
        action.getActionState() === ThaliPeerAction.actionState.CREATED;
  }).slice(0, actionsToStart)
    .forEach(function (action) {
      action.start();
    });
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

  var self = this;
  var originalKill = peerAction.kill;
  peerAction.kill = function () {
    self._killAction(peerAction);
    peerAction.kill = originalKill;
    return originalKill.apply(this, arguments);
  };

  if (peerAction.getActionType() === ThaliNotificationAction.ACTION_TYPE) {
    this._notificationActionEnqueue(peerAction);
  }

  if (peerAction.getActionType() === ThaliReplicationPeerAction.ACTION_TYPE) {
    var startReplication = this._replicationActionEnqueue(peerAction);
    if (startReplication) {
      this._startAction(peerAction);
      return result;
    }
  }

  this._checkToRun(peerAction.getConnectionType());

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
