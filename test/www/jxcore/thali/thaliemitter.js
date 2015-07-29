'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var validations = require('./validations');

function thrower(err) {
  if (err) { throw err; }
}

/**
 * Creates a new instance of the ThaliEmitter which is an EventEmitter to call the underlying native layer.
 */
function ThaliEmitter() {
  EventEmitter.call(this);
  this._init();
}

inherits(ThaliEmitter, EventEmitter);

ThaliEmitter.events = {
  PEER_AVAILABILITY_CHANGED: 'peerAvailabilityChanged',
  NETWORK_CHANGED: 'networkChanged'
};

ThaliEmitter.prototype._init = function () {
  var self = this;

  function registerMobilePeerEvent(eventName) {
    function emitEvent(eventName) {
      return function handler(arg) {
        self.emit(eventName, arg);
      };
    }

    Mobile(eventName).registerToNative(emitEvent(eventName));
  }

  Object.keys(ThaliEmitter.events)
    .forEach(function (key) {
      registerMobilePeerEvent(ThaliEmitter.events[key]);
    });
};

/**
* Starts broadcasting with the given device name, port and a callback
* @param {String} deviceName the device name to broadcast.
* @param {Number} port the port number to broadcast.
* @param {Function} cb the callback which returns an error if one has occurred.
*/
ThaliEmitter.prototype.startBroadcasting = function(deviceName, port, cb) {
  validations.ensureNonNullOrEmptyString(deviceName, 'deviceName');
  validations.ensureValidPort(port);
  cb || (cb = thrower);

  Mobile('StartBroadcasting').callNative(deviceName, port, function (err) {
    if (err) {
      cb(new Error(err));
    } else {
      cb();
    }
  });
};

/**
* Starts broadcasting the availability of the current device.
* @param {Function} cb the callback which returns an error if one has occurred.
*/
ThaliEmitter.prototype.stopBroadcasting = function(cb) {
  cb || (cb = thrower);

  Mobile('StopBroadcasting').callNative(function (err) {
    if (err) {
      cb(new Error(err));
    } else {
      cb();
    }
  });
};

/**
* Connects to the given peer by the given peer identifier.
* @param {String} peerIdentifier the peer identifier of the device to connect to.
* @param {Function} cb the callback which returns an error if one occurred and a port number used for synchronization.
*/
ThaliEmitter.prototype.connect = function (peerIdentifier, cb) {
  validations.ensureNonNullOrEmptyString(peerIdentifier, 'peerIdentifier');
  validations.ensureIsFunction(cb);

  Mobile('Connect').callNative(peerIdentifier, function (err, port) {
    if (err) {
      cb(new Error(err));
    } else {
      cb(null, port);
    }
  });
};

/**
* Disconnects from the given peer by the peer identifier. Note if the peer has already been disconnected, no error should be thrown.
* @param {String} peerIdentifier the peer identifier of the device to disconnect from.
* @param {Function} cb the callback which returns an error if one occurred.
*/
ThaliEmitter.prototype.disconnect = function (peerIdentifier, cb) {
  validations.ensureNonNullOrEmptyString(peerIdentifier, 'peerIdentifier');
  cb || (cb = thrower);

  Mobile('Disconnect').callNative(peerIdentifier, function (err) {
    if (err) {
      cb(new Error(err));
    } else {
      cb();
    }
  });
};

module.exports = ThaliEmitter;
