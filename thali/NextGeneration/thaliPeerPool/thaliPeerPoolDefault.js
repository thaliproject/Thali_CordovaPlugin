'use strict';

var util = require('util');
var ThaliPeerPoolInterface = require('./thaliPeerPoolInterface');
var thaliConfig = require('../thaliConfig');
var ForeverAgent = require('forever-agent');
var logger = require('../../ThaliLogger')('thaliPeerPoolDefault');
var Utils = require('../utils/common.js');

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

  // Right now we will just allow everything to run parallel.

  var result =
    ThaliPeerPoolDefault.super_.prototype.enqueue.apply(this, arguments);

  var actionAgent = new ForeverAgent.SSL({
    maxSockets: 8,
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
