'use strict';

/** @module thaliACLEnforcer */


// TODO: Make sure that we properly enforce the ACL on _Local/<uniqueid> so that
// only the peer with that ID can write to it.

/**
 * Whenever a peer successfully authenticates a connection this event will be
 * fired. Note that depending on how many connections the peer is creating this
 * event can potentially get quite chatty.
 *
 * BUGBUG: This could be used as a form of DOS attack where the peer tries to
 * open and close an enormous number of connections.
 *
 * @public
 * @event module:thaliACLEnforcer.event:peerAuthenticated
 * @type {object}
 * @property {string} peerKey A base64 url safe encoded ECDH public key
 */

/**
 *
 * @param router
 * @constructor
 * @fires module:thaliACLEnforcer.event:peerAuthenticated
 */
function ThaliAclEnforcer(router) {

}

module.exports = ThaliAclEnforcer;
