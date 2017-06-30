'use strict';

var util = require('util');
var ThaliPeerPoolInterface = require('./thaliPeerPoolInterface');
var thaliConfig = require('../thaliConfig');
var ForeverAgent = require('forever-agent');
var logger = require('../../ThaliLogger')('thaliPeerPoolDefault');
var Utils = require('../utils/common.js');
var ThaliReplicationPeerAction = require('../replication/thaliReplicationPeerAction');
var thaliMobileNativeWrapper =
  require('thali/NextGeneration/thaliMobileNativeWrapper');

/** @module thaliPeerPoolDefault */

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
function ThaliPeerPoolDefault() {
  ThaliPeerPoolDefault.super_.call(this);
  this._isAlreadyReplicating = false;
  this._activePeers = {};
  this._stopped = true;
}

util.inherits(ThaliPeerPoolDefault, ThaliPeerPoolInterface);
ThaliPeerPoolDefault.ERRORS = ThaliPeerPoolInterface.ERRORS;

ThaliPeerPoolDefault.ERRORS.ENQUEUE_WHEN_STOPPED =
  'we ignored peer action, because we has been already stopped';

ThaliPeerPoolDefault.prototype.enqueue = function (peerAction) {
  if (this._stopped) {
    peerAction.kill();
    throw new Error(ThaliPeerPoolDefault.ERRORS.ENQUEUE_WHEN_STOPPED);
  }

  var self = this;

  // Right now we will just allow everything to run parallel.

  var result =
    ThaliPeerPoolDefault.super_.prototype.enqueue.apply(this, arguments);

  var actionAgent = new ForeverAgent.SSL({
    maxSockets: 8,
    ciphers: thaliConfig.SUPPORTED_PSK_CIPHERS,
    pskIdentity: peerAction.getPskIdentity(),
    pskKey: peerAction.getPskKey()
  });

  if (peerAction.getActionType() === ThaliReplicationPeerAction.ACTION_TYPE) {
    if (!self._isAlreadyReplicating) {
      logger.debug('Starting replication action');

      self._isAlreadyReplicating = true;

      peerAction.start(actionAgent)
        .catch(function (err) {
          logger.debug('Replication action error: ', Utils.serializePouchError(err));
        })
        .then(function () {
          logger.debug('Replication action resolved');
          peerAction.kill();

          self._isAlreadyReplicating = false;
        });
    } else {
      logger.debug('We are already replicating');
    }
  } else {
    var peerId = peerAction.getPeerIdentifier();

    // Check if we are already running notificationAction with this peer.
    if (self._activePeers[peerId]) {
      // If so, check if current peerAction has higher generation than the one we are currently running.
      // If so, call killSuperseded on the old one, so the older notificationAction won't be retried and
      // add the new one for its place.
      if (peerAction.getPeerGeneration() > self._activePeers[peerId].peerAction.getPeerGeneration()) {
        self._activePeers[peerId].peerAction.killSuperseded();

        self._activePeers[peerId] = {
          peerAction: peerAction,
          runningNotification: false
        };
      }
    } else {
      // If we are not running, add to array and start
      self._activePeers[peerId] = {
        peerAction: peerAction,
        runningNotification: false
      };
    }

    if (!self._activePeers[peerId].runningNotification) {
      var peerGeneration = self._activePeers[peerId].peerAction.getPeerGeneration();
      var peerPortNumber = self._activePeers[peerId].peerAction.portNumber;

      logger.debug('Starting notification action with ', peerId, ':', peerGeneration);

      self._activePeers[peerId].runningNotification = true;

      self._activePeers[peerId].peerAction.start(actionAgent)
        .catch(function (err) {
          // When we receive `Peer is unavailable` we don't need to call disconnect, because
          // this peer is not present anyway and we have no connection with it.
          if (err.message === 'Could not establish TCP connection' ||
            err.message === 'Connection could not be established') {
            logger.debug('Killing connection with ', peerId, ':', peerGeneration, 'on port:', peerPortNumber);
            thaliMobileNativeWrapper.disconnect(peerId, peerPortNumber);
          }

          logger.debug('Notification action error: ', Utils.serializePouchError(err));
        })
        .then(function () {
          logger.debug('Notification action resolved');

          // We need to make sure to not delete new record. So we compare generation and
          // runningNotification flag. However, it still could erase valid record.
          if (self._activePeers[peerId] &&
            self._activePeers[peerId].peerAction.getPeerGeneration() === peerGeneration &&
            self._activePeers[peerId].runningNotification) {
            self._activePeers[peerId] = null;
          }
        });
    } else {
      // If we got here it means that we are already running notificationAction for this peer
      // with the same generation. We won't get notificationAction with lower generation (I think)
      logger.debug('We are already running NotificationAction for ',
        peerId, ':', peerAction.getPeerGeneration());
    }
  }

  return result;
};

ThaliPeerPoolDefault.prototype.start = function () {
  this._stopped = false;

  return ThaliPeerPoolDefault.super_.prototype.start.apply(this, arguments);
};

/**
 * This function is used primarily for cleaning up after tests and will
 * kill any actions that this pool has started that haven't already been
 * killed. It will also return errors if any further attempts are made
 * to enqueue.
 * @return {Promise}
 */
ThaliPeerPoolDefault.prototype.stop = function () {
  this._stopped = true;

  return ThaliPeerPoolDefault.super_.prototype.stop.apply(this, arguments);
};

module.exports = ThaliPeerPoolDefault;
