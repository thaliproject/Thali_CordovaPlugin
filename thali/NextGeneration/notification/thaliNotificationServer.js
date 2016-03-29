'use strict';
var assert = require('assert');
var NotificationBeacons = require('./thaliNotificationBeacons');
var ThaliPskMapStack = require('./thaliPskMapStack');
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
          return reject( new Error('bad public keys'));
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
          self._secrets = new ThaliPskMapStack();
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
    if (self._preambleAndBeacons != null ||
        previousPreambleAndBeacons != null) {

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
 * Errors:
 * 'Failed' - ThaliMobile.stopAdvertisingAndListening failed.
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

    if (self._preambleAndBeacons == null) {
      res.status(204).send();
    } else {
      res.set('Content-Type', 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(self._preambleAndBeacons);
    }
  };

  self._router.get(thaliConfig.NOTIFICATION_BEACON_PATH,
                  getBeaconNotifications);
};

/**
 * This is the pskIdToSecret function that has to be passed into
 * thaliMobile.start(). It's response to ID requests will change as the
 * notification server changes the beacons it is advertising.
 *
 * ## Introduction
 *
 * This function starts life by replacing the call above to
 * generatePreambleAndBeacons with a call to generateBeaconStreamAndSecrets.
 * This will return the beaconStreamAndSecretDictionary. The beacon stream
 * is the existing value already used above. The secret dictionary is our
 * new addition to enable PSK support. This dictionary takes as input an
 * ID passed in over PSK and returns two values, one is a public key and
 * the other is the secret to be used by PSK. If life were trivial (and it is
 * not) then the function below would just point to the latest value of the
 * secret dictionary, pass in the ID to the dictionary and then return the
 * secret (ignoring for a moment te public key, we'll get to that).
 *
 * But life really isn't that easy. The problem is a race condition. Imagine
 * that at time A we advertise beacon A. Then a little later at time B we
 * advertise beacon B. Because beacons contain a random value that is changed
 * every time we change beacons none of the entries in the secret dictionary
 * returned when beacon A was generated will match any of the entries when
 * beacon B is generated. So if some poor device heard the beacon A
 * advertisements and just as it got the beacon the device switches to beacon B
 * then when the device tries to connect using a value derived from beacon A
 * the connection will fail because the secret dictionary has changed.
 *
 * To avoid these race conditions the function below has to remember multiple
 * secret dictionaries. So any time we generate a beacon we will remember the
 * secret dictionary generated with that beacon for some window of time and at
 * the end of that window of time we will forget that dictionary.
 *
 * So this means we effectively need an array of dictionaries and when we get
 * an ID to this function we should check the dictionaries in LIFO order
 * (since it's likely that the newest dictionary has the right value).
 *
 * ## Dealing with beacon requests
 *
 * If we get an id equal to thaliConfig.BEACON_PSK_IDENTITY then we MUST always
 * return thaliConfig.BEACON_KEY. This check MUST come before looking into any
 * of the dictionaries.
 *
 * ## Policy for remembering and forgetting secret dictionaries
 *
 * Each time a beacon is generated it has an associated expiration date. We
 * have to calculate each expiration date (you can cheat and just add
 * the expiration to the current time minux say a few hundred MS rather than
 * having to read the time from the beacon) and mark each beacon's entry with
 * that date.
 *
 * We MUST NOT set timers to get rid of old entries. The reason is that these
 * timers will force the device to wake up even if it isn't doing anything and
 * that kills battery. So absolutely no timers!
 *
 * Instead what we need is something like the peer dictionary where we will
 * remember a fixed number of dictionaries (start with 50, it's a nice number,
 * but whatever it is, stick it into thaliConfig). If we are asked to add a
 * dictionary and if we are all full then we must check the expiration dates on
 * all the dictionaries we have and remove any expired ones. If this doesn't
 * create any room then we must delete the oldest dictionary.
 *
 * When we get a call to the ID function we must check to see if we have any
 * expired dictionaries and if so we must remove them before processing the
 * ID request (e.g. looking it up in some dictionary).
 *
 * Note that since the dictionaries MUST be in LIFO order if we start from the
 * back of the queue then we only need to check expiration's until we hit the
 * first unexpired dictionary. Since any dictionaries after that must be newer
 * we know they aren't expired. This will make the expiration check much
 * cheaper.
 *
 * Once we know we have a good set of dictionaries then we take the ID and
 * starting with the top of the stack we see if any of the dictionaries have
 * a response. If they do then we return the secret (not the public key) from
 * the dictionary. If they don't the we return null.
 *
 * ## Dealing with start and stop
 *
 * If this function is called while we are in stop state then we MUST return
 * null.
 *
 * If start is called and then later stop is called then this function MUST
 * forget all dictionaries and it MUST clear its state.
 *
 * If start is called twice however nothing special happens beyond adding a new
 * dictionary to the existing list.
 *
 * @public
 * @returns {module:thaliMobileNativeWrapper~pskIdToSecret}
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
 * except that it returns the public key from the secrets dictionary instead of
 * the PSK secret.
 *
 * In the case of the beacon ID (e.g. thaliConfig.BEACON_PSK_IDENTITY) if we get
 * that specific ID then we MUST return null. This check MUST come before
 * checking any of the dictionaries.
 *
 * And yes, there is a race condition where a dictionary might not have quite
 * yet expired when getPskIdToSecret is called but could then have expired
 * when getPskIdToPublicKey has called. If this happens the caller will be able
 * to make a TCP connection but all of their requests for protected content
 * (e.g. not beacons) will be rejected with unauthorized errors. This is a
 * bummer but should be very rare in the real world so we aren't going to worry
 * excessively about it.
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
      thaliConfig.BEACON_KEY : self._secrets.getPublic(id);
  };
};

module.exports = ThaliNotificationServer;
