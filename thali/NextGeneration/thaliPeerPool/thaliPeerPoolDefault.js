'use strict';

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
 * The pool btw is defined by http.Agent in Node.js. For now we will us
 * the existing maxSockets of 5 (this means we can have up to 5 connections
 * with the same host:port). This seems a reasonable limit.
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
 *
 * @public
 * @constructor
 */
function ThaliPeerPoolDefault(thaliMobile) {

}

module.exports = ThaliPeerPoolDefault;
