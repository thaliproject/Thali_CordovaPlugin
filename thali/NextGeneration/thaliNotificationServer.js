'use strict';

var Promise = require('lie');

/** @module thaliNotificationServer */

/**
 * @classdesc This class will register the path to retrieve beacons on the
 * submitted router object and handle any beacon requests. This class uses
 * our promise queue to simplify dealing with concurrency so all calls will
 * automatically be serialized.
 *
 * @param {Object} router An express router object that the class will use
 * to register its path.
 * @param {ECDH} ecdhForLocalDevice A Crypto.ECDH object initialized with the
 * local device's public and private keys
 * @param {number} secondsUntilExpiration The number of seconds into the
 * future after which the beacons should expire.
 * @constructor
 * The constructor MUST NOT take any action. It can only record values.
 */
function ThaliNotificationServer(router, ecdhForLocalDevice,
                                 secondsUntilExpiration) {

}

/**
 * When called for the first time on an instance of ThaliNotificationServer
 * the route "/NotificationBeacons" MUST be registered on the submitted
 * router object with a GET handler. Registration of the path on the router
 * MUST occur at most once. The notification server MUST use {@link
 * module:makeIntoCloseAllServer~makeIntoCloseAllServer}
 *
 * If publicKeysToNotify is null then any GET requests on the endpoint MUST be
 * responded to with 204 No Content per the
 * [spec](https://github.com/thaliproject/thali/blob/gh-pages/pages/documentatio
 * n/PresenceProtocolBindings.md#transferring-discovery-beacon-values-over-http)
 * .
 *
 * Otherwise the endpoint MUST respond with an application/octet-stream
 * content-type with cache-control: no-cache and a response body containing
 * the properly generated beacon contents from
 * {@link module:thaliNotificationBeacons.generatePreambleAndBeacons}.
 *
 * If we get null for publicKeysToNotify we MUST stop advertising any values
 * over whatever the local discovery transport we are using. This is NOT the
 * same as turning off advertising. If advertising were turned off then we would
 * emit the error give below. If we simply say we want to advertise but have
 * nothing to advertise then we just stop advertising anything until we get a
 * value.
 *
 * There MUST be logic in the endpoint to make sure that if requests/second for
 * this endpoint exceed a set threshold then we MUST respond with a 503
 * server overloaded. We MUST be careful when logging information about
 * overloads to make sure we don't overload the log. Once the request rate
 * for this endpoint has fallen below the threshold then we MUST start serving
 * beacons (or 204s) again.
 *
 * Every time this method is called the beacons MUST be updated with the
 * submitted value, including NULL to start returning 204s.
 *
 * The following error values MUST be used as appropriate:
 *
 * 'bad public keys' - This indicates that one or more of the public keys is
 * of the wrong type or otherwise malformed and so it is not possible to use
 * these keys to create beacons.
 *
 * 'Advertising is off' - We do not have advertising activated so we can't
 * advertise anything.
 *
 * @param {buffer[]} [publicKeysToNotify] - An array of buffers holding the
 * ECDH public keys to notify that we have data for them.
 * @returns {Promise<?error>} Returns null if everything went fine otherwise
 * returns an error object.
 */
ThaliNotificationServer.prototype.start = function (publicKeysToNotify) {
  return new Promise();
};

/**
 * This is really a placebo method as in reality it just calls start with no
 * keys to notify. The reason is that once a route is registered on an Express
 * router there is no supported way of removing it.
 *
 * @returns {Promise<?error>}
 */
ThaliNotificationServer.prototype.stop = function () {
  return this.start();
};

module.exports.ThaliNotificationServer = ThaliNotificationServer;
