'use strict';

var util = require('util');
var ThaliPeerPoolInterface = require('./thaliPeerPoolInterface');
var thaliConfig = require('../thaliConfig');
var ForeverAgent = require('forever-agent');
var logger = require('../../ThaliLogger')('thaliPeerPoolOneAtATime');
var PromiseQueue = require('../promiseQueue');
var ThaliReplicationPeerAction = require('../replication/thaliReplicationPeerAction');
var thaliMobileNativeWrapper = require('../thaliMobileNativeWrapper');
var thaliMobile = require('../thaliMobile');
var ThaliNotificationAction = require('../notification/thaliNotificationAction');

/** @module thaliPeerPoolOneAtATime */

/**
 * @classdesc This is a quick and dirty hack to let us test a real application
 * using Thali.
 *
 * WARNING: This code is really just intended for use for testing and
 * prototyping. It is not intended to be shipped.
 *
 * # Wifi
 * We run all actions as soon as they come in with the exception of replication
 * actions. With those we will only allow a maximum of two replication actions
 * to run to the same IP Address/port. The reason for this is that there is a
 * theoretical race condition where if peer A advertises a change for peer B
 * then peer B will start replicating. While they are replicating peer A is
 * getting new values that will cause it after 1 second to generate a new
 * beacon which peer B will see but it has a different ID so now peer B will
 * start a second replication. Basically a new replication will start every
 * second until there is no more data to share. Then eventually all the
 * replications will go away. This peer policy manager deals with this by
 * restricting the number of replications to a single address/port to no more
 * than 2. The reason for allowing 2 is that there are some race conditions
 * where it's theoretically possible to end up in a situation where there is
 * one last change that got missed and so if we terminate the replication
 * without carefully checking notifications we can miss that last update. Since
 * this is a hack we just use two replications.
 *
 * # Bluetooth
 * With Bluetooth we run exactly one action at a time. This makes this policy
 * between useless to painful if testing with 3 or more native devices. After
 * each action we make sure to terminate the native connection so we don't run
 * into 'already connected' errors. The one exception is when a notification
 * action successfully retrieves beacons. In that case we use an awful trick
 * described below to make sure that the replication action gets called before
 * we kill the native connection created by the notification action.
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
function ThaliPeerPoolOneAtATime() {
  ThaliPeerPoolOneAtATime.super_.call(this);
  this._stopped = true;
  this._bluetoothSerialPromiseQueue = new PromiseQueue();
  this._wifiReplicationCount = {};
}

util.inherits(ThaliPeerPoolOneAtATime, ThaliPeerPoolInterface);
ThaliPeerPoolOneAtATime.ERRORS = ThaliPeerPoolInterface.ERRORS;

ThaliPeerPoolOneAtATime.ERRORS.ENQUEUE_WHEN_STOPPED =
  'we ignored peer action, because we has been already stopped';

ThaliPeerPoolOneAtATime.prototype._startAction = function (peerAction) {
  var actionAgent = new ForeverAgent.SSL({
    maxSockets: 8,
    ciphers: thaliConfig.SUPPORTED_PSK_CIPHERS,
    pskIdentity: peerAction.getPskIdentity(),
    pskKey: peerAction.getPskKey()
  });

  logger.debug('Action Started ' + peerAction.loggingDescription());
  return peerAction.start(actionAgent)
  .then(function () {
    logger.debug('action returned successfully from start - ' +
      peerAction.loggingDescription());
    return null;
  })
  .catch(function (err) {
    logger.debug('action returned with error from start' + err + ' - ' +
      peerAction.loggingDescription());
    return err;
  });
};

ThaliPeerPoolOneAtATime.prototype._wifiReplicationCount = null;

ThaliPeerPoolOneAtATime.prototype._wifiEnqueue = function (peerAction) {
  var self = this;
  if (peerAction.getActionType() !== ThaliReplicationPeerAction.ACTION_TYPE) {
    return self._startAction(peerAction)
      .then(function () {
        peerAction.kill();
      });
  }

  var peerId = peerAction.getPeerIdentifier();

  var count = self._wifiReplicationCount[peerId];
  switch (count) {
    case undefined:
    case 0: {
      self._wifiReplicationCount[peerId] = 1;
      break;
    }
    case 1: {
      self._wifiReplicationCount[peerId] = 2;
      break;
    }
    case 2: {
      peerAction.kill();
      return null;
    }
    default: {
      var error = new Error('We got an illegal count: ' + count);
      logger.error(error.message);
      peerAction.kill();
      return error;
    }
  }

  peerAction.on('killed', function () {
    var count = self._wifiReplicationCount[peerId];
    switch (count) {
      case 1: {
        delete self._wifiReplicationCount[peerId];
        break;
      }
      case 2: {
        self._wifiReplicationCount[peerId] = 1;
        break;
      }
      default: {
        logger.error('Count had to be 1 or 2 - ' + count);
      }
    }
  });

  self._replicateThroughProblems(peerAction)
    .then(function () {
      peerAction.kill();
    });
  return null;
};

ThaliPeerPoolOneAtATime.prototype._bluetoothReplicationAction = null;

/**
 * Runs the replication action and if it fails for a reason other than a
 * timeout and if the peer is still available (meaning the connection has not
 * been lost) then we will retry the replication.
 * @param replicationAction
 * @returns {Promise.<null>}
 * @private
 */
ThaliPeerPoolOneAtATime.prototype._replicateThroughProblems =
  function (replicationAction) {
    var self = this;
    return self._startAction(replicationAction)
      .then(function (error) {
        // Just being paranoid
        replicationAction.kill();
        if (!error) {
          // I don't think this is even theoretically possible
          logger.debug('Got a replication response with no error!');
          return null;
        }

        var peerAdvertisesDataForUs =
          replicationAction.getPeerAdvertisesDataForUs();

        if (error.message === 'No activity time out' ||
          !thaliMobile
            ._peerAvailabilities[replicationAction.getConnectionType()]
                                [peerAdvertisesDataForUs.peerId]) {
          return null;
        }

        if (replicationAction.getConnectionType() !==
          thaliMobileNativeWrapper.connectionTypes.TCP_NATIVE) {
          if (error.code === 'ECONNREFUSED' || error.code === 'ECONNRESET') {
            thaliMobileNativeWrapper._getServersManager()
              .recreatePeerListener(
                peerAdvertisesDataForUs.peerId,
                peerAdvertisesDataForUs.portNumber,
                error
              );
            return null;
          }

        }
        logger.debug('Replication action failed badly so we are going to ' +
          'retry');
        var clonedAction = replicationAction.clone();
        return self._replicateThroughProblems(clonedAction);
      });
  };

// Bluetooth actions are put into a serial queue so working with more than
// a total of 2 phones is going to be a bit dicey
ThaliPeerPoolOneAtATime.prototype._bluetoothEnqueue = function (peerAction) {
  var self = this;
  // This code depends on an evil race condition where if a notification
  // action successfully retrieves beacons from a peer then before the start
  // method for that notification action returns we will already have created
  // a replication action to get the beacons and will have called enqueue. We
  // depend on that race condition. We will store the replication action when
  // it comes in but not run it until the notification action that led to
  // the replication action being generated returns from start.
  if (peerAction.getActionType() === ThaliReplicationPeerAction.ACTION_TYPE) {
    if (self._bluetoothReplicationAction) {
      logger.error('Something VERY bad has happened. We got a second ' +
        'replication action without having cleared the first!');
      self._bluetoothReplicationAction.kill();
    }

    self._bluetoothReplicationAction = peerAction;
    return null;
  }

  if (peerAction.getActionType() !== ThaliNotificationAction.ACTION_TYPE) {
    var error = new Error('Got unsupported action type: ' +
      peerAction.getActionType());
    logger.error(error.message);
    peerAction.kill();
    return error;
  }

  self._bluetoothSerialPromiseQueue.enqueue(function (resolve) {
    return self._startAction(peerAction)
      .then(function () {
        if (self._bluetoothReplicationAction) {
          var replicationAction = self._bluetoothReplicationAction;
          return self._replicateThroughProblems(
              self._bluetoothReplicationAction)
            .then(function () {
              // Currently replication actions use the remote public key as
              // the peer ID instead of the Bluetooth MAC. But listeners
              // in thaliMobileNativeWrapper are indexed by MAC. So use the
              // MAC from the associated notification action. Yes, we really
              // should fix this.
              thaliMobileNativeWrapper._getServersManager()
                .terminateOutgoingConnection(peerAction.getPeerIdentifier(),
                  replicationAction.getPeerAdvertisesDataForUs().portNumber);
              self._bluetoothReplicationAction = null;
              peerAction.kill();
              resolve(true);
              return null;
            });
        }
        peerAction.kill();
        thaliMobileNativeWrapper._getServersManager()
          .terminateOutgoingConnection(peerAction.getPeerIdentifier(),
            peerAction.getConnectionInformation().portNumber);
        resolve(true);
        return null;
      });
  });
};

ThaliPeerPoolOneAtATime.prototype.enqueue = function (peerAction) {
  if (this._stopped) {
    peerAction.kill();
    return new Error(ThaliPeerPoolOneAtATime.ERRORS.ENQUEUE_WHEN_STOPPED);
  }
  var result =
    ThaliPeerPoolOneAtATime.super_.prototype.enqueue.apply(this, arguments);

  if (result) {
    return result;
  }

  switch(peerAction.getConnectionType()) {
    // MPCF is here because right now master doesn't really know how to set
    // the mock type to anything but Android
    case thaliMobileNativeWrapper.connectionTypes
      .MULTI_PEER_CONNECTIVITY_FRAMEWORK:
    case thaliMobileNativeWrapper.connectionTypes.BLUETOOTH: {
      result = this._bluetoothEnqueue(peerAction);
      break;
    }
    case thaliMobileNativeWrapper.connectionTypes.TCP_NATIVE: {
      result = this._wifiEnqueue(peerAction);
      break;
    }
    default: {
      peerAction.kill();
      result = new Error('Got unrecognized connection type: ' +
        peerAction.getConnectionType());
      break;
    }
  }

  return result instanceof Error ? result : null;
};

ThaliPeerPoolOneAtATime.prototype.start = function () {
  logger.debug('Start was called');
  this._stopped = false;

  return ThaliPeerPoolOneAtATime.super_.prototype.start.apply(this, arguments);
};

/**
 * This function is used primarily for cleaning up after tests and will
 * kill any actions that this pool has started that haven't already been
 * killed. It will also return errors if any further attempts are made
 * to enqueue.
 */
ThaliPeerPoolOneAtATime.prototype.stop = function () {
  logger.debug('Stop was called');
  this._stopped = true;
  this._wifiReplicationCount = {};
  return ThaliPeerPoolOneAtATime.super_.prototype.stop.apply(this, arguments);
};

module.exports = ThaliPeerPoolOneAtATime;
