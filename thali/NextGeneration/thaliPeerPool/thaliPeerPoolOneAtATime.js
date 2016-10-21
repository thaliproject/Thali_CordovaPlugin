'use strict';

var util = require('util');
var ThaliPeerPoolInterface = require('./thaliPeerPoolInterface');
var thaliConfig = require('../thaliConfig');
var ForeverAgent = require('forever-agent');
var logger = require('../../ThaliLogger')('thaliPeerPoolOneAtATime');
var PromiseQueue = require('../promiseQueue');
var ThaliReplicationPeerAction = require('../replication/thaliReplicationPeerAction');
var assert = require('assert');
var thaliMobileNativeWrapper = require('../thaliMobileNativeWrapper');

/** @module thaliPeerPoolOneAtATime */

/**
 * @classdesc This is the default implementation of the
 * {@link module:thaliPeerPoolInterface~ThaliPeerPoolInterface} interface.
 *
 * WARNING: This code is really just intended for use for testing and
 * prototyping. It is not intended to be shipped.
 *
 * How the default implementation function depends on what connection type an
 * action is associated with.
 *
 * # Wifi
 *
 * When we run on Wifi we pretty much will allow all submitted actions to
 * run in parallel. The real control on their behavior is that they will
 * all share the same http agent pool so this will limit the total number
 * of outstanding connections. As we gain more operational experience I
 * expect we will determine a certain number of replications that make
 * sense to run in parallel and then we will throttle to just allowing
 * that number of connections to run in parallel, but not today. Today they
 * all run, just the pool controls them.
 *
 *
 * # Multipeer Connectivity Framework
 *
 * This one is tough because it all depends on if we have WiFi or just
 * Bluetooth. For now we will just cheat and treat this the same as WiFi above
 * except that we will use a dedicated http agent pool (no reason so share
 * with WiFi).
 *
 * # Bluetooth
 *
 * We have written
 * [an article](http://www.thaliproject.org/androidWirelessIssues) about all
 * the challenges of making Bluetooth behave itself. There are different
 * tradeoffs depending on the app. For now we mostly test with chat apps
 * that don't move a ton of data and when we do test large amounts of data
 * we set up the test to only try one connection at a time. So for now we
 * aren't going to try to regulate how many connections, incoming or outgoing
 * we have. Instead we will give each client connection its own HTTP
 * agent pool and call it a day.
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
  this._serialPromiseQueue = new PromiseQueue();
  this._wifiReplicationCount = {};
}

util.inherits(ThaliPeerPoolOneAtATime, ThaliPeerPoolInterface);
ThaliPeerPoolOneAtATime.ERRORS = ThaliPeerPoolInterface.ERRORS;

ThaliPeerPoolOneAtATime.ERRORS.ENQUEUE_WHEN_STOPPED = 'We are stopped';

ThaliPeerPoolOneAtATime.prototype._startAction = function (peerAction) {
  var actionAgent = new ForeverAgent.SSL({
    keepAlive: true,
    keepAliveMsecs: thaliConfig.TCP_TIMEOUT_WIFI/2,
    maxSockets: Infinity,
    maxFreeSockets: 256,
    ciphers: thaliConfig.SUPPORTED_PSK_CIPHERS,
    pskIdentity: peerAction.getPskIdentity(),
    pskKey: peerAction.getPskKey()
  });

  return peerAction.start(actionAgent)
  .then(function () {
    logger.debug('action returned successfully from start');
    return null;
  })
  .catch(function (err) {
    logger.debug('action returned with error from start' + err);
    return null;
  });
};

ThaliPeerPoolOneAtATime.prototype._wifiReplicationCount = null;

ThaliPeerPoolOneAtATime.prototype._wifiEnqueue = function (peerAction) {
  var self = this;
  if (peerAction.getActionType() !== ThaliReplicationPeerAction.actionType) {
    return self._startAction(peerAction);
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
      return peerAction.kill();
    }
    default: {
      logger.error('We got an illegal count: ' + count);
    }
  }

  var originalKill = peerAction.kill;
  peerAction.kill = function () {
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
    return originalKill.apply(this, arguments);
  };

  return self._startAction(peerAction);
};

ThaliPeerPoolOneAtATime.prototype._bluetoothReplicationAction = null;

ThaliPeerPoolOneAtATime.prototype._bluetoothEnqueue = function (peerAction) {
  var self = this;
  if (peerAction.getActionType() === ThaliReplicationPeerAction.ACTION_TYPE) {
    if (self._bluetoothReplicationAction) {
      logger.error('Something VERY bad has happened. We got a second ' +
        'replication action without having cleared the first!');
      self._bluetoothReplicationAction.kill();
    }

    self._bluetoothReplicationAction = peerAction;
    return;
  }

  self._serialPromiseQueue.enqueue(function (resolve, reject) {
    return self._startAction(peerAction)
      .then(function () {
        if (self._bluetoothReplicationAction) {
          var replicationAction = self._bluetoothReplicationAction;
          return self._startAction(replicationAction)
            .then(function () {
              thaliMobileNativeWrapper._getServersManager()
                .terminateOutgoingConnection(peerAction.getPeerIdentifier(),
                  replicationAction.getPeerAdvertisesDataForUs().portNumber);
              self._bluetoothReplicationAction = null;
              replicationAction.kill();
              peerAction.kill();
              resolve(true);
              return null;
            });
        }
        peerAction.kill();
        thaliMobileNativeWrapper._getServersManager()
          .terminateOutgoingConnection(peerAction.getPeerIdentifier(),
            peerAction.getConnectionInformation().getPortNumber());
        resolve(true);
        return null;
      });
  });
};

ThaliPeerPoolOneAtATime.prototype.enqueue = function (peerAction) {
  if (this._stopped) {
    throw new Error(ThaliPeerPoolOneAtATime.ERRORS.ENQUEUE_WHEN_STOPPED);
  }

  var result =
    ThaliPeerPoolOneAtATime.super_.prototype.enqueue.apply(this, arguments);

  switch(peerAction.getConnectionType()) {
    // MPCF is here because right now master doesn't really know how to set
    // the mock type to anything but Android
    case thaliMobileNativeWrapper.connectionTypes
      .MULTI_PEER_CONNECTIVITY_FRAMEWORK:
    case thaliMobileNativeWrapper.connectionTypes.BLUETOOTH: {
      this._bluetoothEnqueue(peerAction);
      break;
    }
    case thaliMobileNativeWrapper.connectionTypes.TCP_NATIVE: {
      this._wifiEnqueue(peerAction);
      break;
    }
    default: {
      logger.error('Got unrecognized connection type: ' +
        peerAction.getConnectionType());
    }
  }

  return result;
};

ThaliPeerPoolOneAtATime.prototype.start = function () {
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
  this._stopped = true;
  this._wifiReplicationCount = {};
  return ThaliPeerPoolOneAtATime.super_.prototype.stop.apply(this, arguments);
};

module.exports = ThaliPeerPoolOneAtATime;
