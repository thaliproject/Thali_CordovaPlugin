'use strict';
var assert = require('assert');
var Express = require('express');
var Promise = require('lie');
var NotificationBeacons = require('./thaliNotificationBeacons');
var PromiseQueue = require('../promiseQueue');
var ThaliMobile = require('../thaliMobile');
var logger = require('../../thalilogger')('thaliNotificationServer');

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
 * The constructor MUST NOT take any action. It can only record values.
 */
function ThaliNotificationServer(router, ecdhForLocalDevice,
                                 millisecondsUntilExpiration) {
  if (router == null) {
    throw new Error('router cannot be null');
  }
   
  if (ecdhForLocalDevice == null) {
    throw new Error('ecdhForLocalDevice cannot be null');
  }

  if (millisecondsUntilExpiration <= 0 ||
      millisecondsUntilExpiration > NotificationBeacons.ONE_DAY) {
    throw new Error('millisecondsUntilExpiration must be > 0 & < ' +
      NotificationBeacons.ONE_DAY);
  }
  
  this._router = router;
  this._ecdhForLocalDevice = ecdhForLocalDevice;
  this._millisecondsUntilExpiration = millisecondsUntilExpiration;
  this._promiseQueue = new PromiseQueue();
  this._firstStartCall = true;
  this._preambleAndBeacons = null;
  this._getEventsQueue = [];
}

/**
 * Window size that we use to calculate requests/second rate
 *
 * @public
 * @readonly
 * @type {number}
 */
ThaliNotificationServer.WINDOW_SIZE = 5;

/**
 * Maximum requests/second rate that incoming get requests can't pass 
 *
 * @public
 * @readonly
 * @type {number}
 */
ThaliNotificationServer.RATE = 10;

/**
 * Defines the HTTP path that beacons are supposed to be requested on when using
 * a HTTP server to distribute beacons.
 *
 * @public
 * @readonly
 * @type {string}
 */
ThaliNotificationServer.NOTIFICATION_BEACON_PATH =
  '/NotificationBeacons';

/**
 * Starts to listen incoming GET request at the "/NotificationBeacons" path 
 * which is registered on the submitted router object. 
 *
 * Every time this method is called advertised beacons are updated with the
 * submitted value, including NULL which starts to returning 204s.
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
 * @param {buffer[]} [publicKeysToNotify] - An array of buffers holding the
 * ECDH public keys to notify that we have data for them.
 * @returns {Promise<?error>} Returns null if everything went fine otherwise
 * returns an error object.
 */
ThaliNotificationServer.prototype.start = function (publicKeysToNotify) {
  var self = this;
  
  return this._promiseQueue.enqueue(function (resolve, reject) {
    var previousPreambleAndBeacons = self._preambleAndBeacons;

    if (publicKeysToNotify) {
      
      // Validates publicKeysToNotify parameter
      if (!(publicKeysToNotify instanceof Array)) {
        return reject( new Error('bad public keys'));
      }
      
      if (publicKeysToNotify.length > 0) {
        publicKeysToNotify.forEach(function (publicKey) {
          if (typeof publicKey !== 'object' || publicKey.length == 0) {
            return reject( new Error('bad public keys'));
          }
        });
      }
      
      try {
        self._preambleAndBeacons = 
          NotificationBeacons.generatePreambleAndBeacons(
            publicKeysToNotify, self._ecdhForLocalDevice, 
            self._millisecondsUntilExpiration);
            
      } catch (error) {
        logger.warn('generatePreambleAndBeacons failed: %s', error);
        return reject(error);
      }
    } else {
      self.preambleAndBeacons = null;
    }
    
    if (self._firstStartCall) {
      // Registers a new request handler when the start is called first time 
      self._registerNotificationPath();
    }
    
    // Following if clause ensures that we don't call 
    // startUpdateAdvertisingAndListening when the last two 
    // start calls have had publicKeysToNotify as a null.
    if (self._preambleAndBeacons != null || 
        previousPreambleAndBeacons != null || 
        self._firstStartCall) {
          
      if (self._firstStartCall) {
        self._firstStartCall = false;
      }
      
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
 * Calls start with no keys to notify. 
 *
 * Errors: 
 *
 * 'bad public keys' - This indicates that one or more of the public keys is
 * of the wrong type or otherwise malformed and so it is not possible to use
 * these keys to create beacons.
 *
 * 'Call Start!' - ThaliMobile.Start has to be called before calling this
 * function
 *
 * @returns {Promise<?error>}
 */
ThaliNotificationServer.prototype.stop = function () {
  return this.start();
};

/**
 * Registers a new get handler for /NotificationBeacons path.
 *
 * If publicKeysToNotify is null then any GET requests on the endpoint is 
 * responded to with 204.
 *
 * If requests/second for this endpoint exceed a set threshold responds 
 * with a 503 server overloaded.
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
    if (!self._rateLimitCheck()) {
      res.status(503).send();
    }
    else if (self._preambleAndBeacons == null) {
      res.status(204).send();
    } else {
      res.set('Content-Type', 'application/octet-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.send(self.preambleAndBeacons);
    }
  };

  self._router.get(ThaliNotificationServer.NOTIFICATION_BEACON_PATH,
                  getBeaconNotifications);
  
  self._pathRegistered = true;
};
 
/**
 * This method makes sure that requests/second rate doesn't exceed
 * a set threshold.
 * @returns {boolean} True if the rate is not exceeded
 * @private
 */
ThaliNotificationServer.prototype._rateLimitCheck = function () {
  var passed = true;
  var now = Date.now();
  
  /**
   * When the queue is full (length == WINDOW_SIZE) we take the oldest 
   * timestamp from it and calculate the difference between the
   * current timestamp (now) and the oldest timestamp. Example:
   * _getEventsQueue: [t1][t2][t3][t4]
   * avgInterval = ( now - [t4] ) / WINDOW_SIZE / 1000 
   * If avgInterval is smaller than 1 / RATE,  returns false. 
   */
  if (this._getEventsQueue.length >= ThaliNotificationServer.WINDOW_SIZE) {
    var oldestTimeStamp = this._getEventsQueue.shift();
    
    var avgRequestInterval = ((now - oldestTimeStamp) / 
        ThaliNotificationServer.WINDOW_SIZE) / 1000;
    
    if (avgRequestInterval < (1/ThaliNotificationServer.RATE)) {
      passed = false;
    }
  }
  
  this._getEventsQueue.push(now);
  return passed;
};


module.exports = ThaliNotificationServer;
