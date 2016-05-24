'use strict';
var assert = require('assert');
var NotificationBeacons = require('./thaliNotificationBeacons');
var ThaliPskMapCache = require('./thaliPskMapCache');
var PromiseQueue = require('../promiseQueue');
var ThaliMobile = require('../thaliMobile');
var logger = require('../../thalilogger')('thaliNotificationServer');
var thaliConfig = require('../thaliConfig');
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
 * @param {number} millisecondsUntilExpiration The number of milliseconds into
 * the future after which the beacons should expire.
 * @constructor
 */
function ThaliNotificationServer(router, ecdhForLocalDevice,
                                 millisecondsUntilExpiration) {

  assert(router, 'router must not be null or undefined');
  assert(ecdhForLocalDevice,
    'ecdhForLocalDevice must not be null or undefined');

  assert(millisecondsUntilExpiration > 0 &&
    millisecondsUntilExpiration <= NotificationBeacons.ONE_DAY,
    'millisecondsUntilExpiration must be > 0 & < ' +
    NotificationBeacons.ONE_DAY);

  this._router = router;
  this._ecdhForLocalDevice = ecdhForLocalDevice;
  this._millisecondsUntilExpiration = millisecondsUntilExpiration;
  this._promiseQueue = new PromiseQueue();
  this._firstStartCall = true;
  this._preambleAndBeacons = null;
  this._secrets = null;
}

/**
 * Starts to listen incoming GET request at the "/NotificationBeacons" path
 * which is registered on the submitted router object.
 *
 * Every time this method is called advertised beacons are updated with the
 * submitted value, including [] which starts to returning 204s.
 *
 * Errors:
 *
 * 'bad public keys' - this indicates that one or more of the public keys is
 * of the wrong type or otherwise malformed and so it is not possible to use
 * these keys to create beacons.
 *
 * 'Call Start!' - ThaliMobile.Start has to be called before calling this
 * function
 *
 * @param {buffer[]} publicKeysToNotify - An array of buffers holding the
 * ECDH public keys to notify that we have data for them.
 * @returns {Promise<?error>} Returns null if everything went fine otherwise
 * returns an error object.
 */
ThaliNotificationServer.prototype.start = function (publicKeysToNotify) {
  var self = this;

  return this._promiseQueue.enqueue(function (resolve, reject) {
    var previousPreambleAndBeacons = self._preambleAndBeacons;

    if (!Array.isArray(publicKeysToNotify)) {
      return reject( new Error('bad public keys'));
    }

    if (publicKeysToNotify.length > 0) {
      publicKeysToNotify.forEach(function (publicKey) {
        if (typeof publicKey !== 'object' || publicKey.length === 0) {
          return reject(new Error('bad public keys'));
        }
      });
      try {
        var beaconStreamAndSecrets =
          NotificationBeacons.generateBeaconStreamAndSecrets(
            publicKeysToNotify,
            self._ecdhForLocalDevice,
            self._millisecondsUntilExpiration);

        self._preambleAndBeacons =
          beaconStreamAndSecrets.beaconStreamWithPreAmble;

        if (!self._secrets) {
          self._secrets =
            new ThaliPskMapCache(self._millisecondsUntilExpiration);
        }
        self._secrets.push(beaconStreamAndSecrets.keyAndSecret);

      } catch (error) {
        logger.warn('generatePreambleAndBeacons failed: %s', error);
        return reject(error);
      }
    } else {
      // publicKeysToNotify is an empty array
      self._preambleAndBeacons = null;
    }

    if (self._firstStartCall) {
      // Registers a new request handler when the start is called first time.
      self._registerNotificationPath();
      self._firstStartCall = false;
    }

    // Following if clause ensures that we don't call
    // startUpdateAdvertisingAndListening when the last two
    // start calls have had publicKeysToNotify as an empty array ([]).
    if (self._preambleAndBeacons || previousPreambleAndBeacons ) {
      ThaliMobile.startUpdateAdvertisingAndListening()
      .then(function () {
        return resolve();
      }).catch(function (error) {
        // Returns errors from startUpdateAdvertisingAndListening
        return reject(error);
      });
    }
    return resolve();
  });
};

/**
 * Starts to returning 204 No Content to beacon requests. Also Stops
 * advertising beacons and tells the native layer to stop advertising
 * the presence of the peer, stop accepting incoming connections over the
 * non-TCP/IP transport and to disconnect all existing non-TCP/IP
 * transport incoming connections.
 *
 * Error codes
 * 'Failed' - {@link module:ThaliMobile.stopAdvertisingAndListening} failed.
 * Check the logs for details.
 * @returns {Promise<?error>}
 */
ThaliNotificationServer.prototype.stop = function () {
  var self = this;
  return this._promiseQueue.enqueue(function (resolve, reject) {
    self._preambleAndBeacons = null;
    self._secrets = null;
    ThaliMobile.stopAdvertisingAndListening()
    .then(function () {
      return resolve();
    }).catch(function (error) {
      // Returns errors from the ThaliMobile.stopAdvertisingAndListening
      return reject(error);
    });
  });
};

/**
 * Registers a new get handler for /NotificationBeacons path.
 *
 * If _preambleAndBeacons is null then any GET requests on the endpoint is
 * responded to with 204.
 *
 * Otherwise the endpoint responds with an application/octet-stream
 * content-type with cache-control: no-cache and a response body containing
 * the properly generated beacon contents.
 *
 * @private
 */
ThaliNotificationServer.prototype._registerNotificationPath = function () {
  var self = this;
  var getBeaconNotifications = function (req, res) {
    if (self._preambleAndBeacons) {
      res.set('Content-Type', 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.status(200).send(self._preambleAndBeacons);
    } else {
      res.status(204).send();
    }
  };

  self._router.get(thaliConfig.NOTIFICATION_BEACON_PATH,
                  getBeaconNotifications);
};

/**
 * This function takes a psk id value and turns it into a private key if
 * recognized or otherwise returns null.
 *
 * @public
 * @callback pskIdentityToPrivateKey
 * @param {string} id
 * @returns {?Buffer} The public key associated with the ID or null if there
 * is no match.
 */

/**
 * This function returns a function that takes a psk id value and turns it
 * into a PSK key if recognized or otherwise returns null. One exception
 * is if it gets an id equal to {@link module:thaliConfig.BEACON_PSK_IDENTITY}
 * then it returns {@link module:thaliConfig.BEACON_KEY}.
 *
 * Return function's responses to id requests will change as the notification
 * server changes the beacons it is advertising.
 *
 * Return value of this function has to be passed into
 * {module:thaliMobile~ThaliMobile.start}.
 *
 * @public
 * @returns {pskIdentityToPrivateKey}
 */
ThaliNotificationServer.prototype.getPskIdToSecret = function () {
  var self = this;
  return function (id) {
    if (!self._secrets) {
      return null;
    }
    return id === thaliConfig.BEACON_PSK_IDENTITY ?
      thaliConfig.BEACON_KEY : self._secrets.getSecret(id);
  };
};

/**
 * This function takes a psk ID value and turns it into a public key if
 * recognized or otherwise returns null.
 *
 * @public
 * @callback pskIdentityToPublicKey
 * @param {string} id
 * @returns {?Buffer} The public key associated with the ID or null if there
 * is no match.
 */

/**
 * This function has identical functionality to {@link
 * module:thaliNotificationServer~ThaliNotificationServer.getPskIdToSecret}
 * except that it returns a function that returns the public key from the
 * secrets dictionary instead of the PSK secret.
 *
 * @returns {pskIdentityToPublicKey}
 */
ThaliNotificationServer.prototype.getPskIdToPublicKey = function () {
  var self = this;
  return function (id) {
    if (!self._secrets) {
      return null;
    }
    return id === thaliConfig.BEACON_PSK_IDENTITY ?
      null : self._secrets.getPublic(id);
  };
};

module.exports = ThaliNotificationServer;
