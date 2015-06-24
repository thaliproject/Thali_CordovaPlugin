var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

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

  function registerCordovaPeerEvent(eventName) {
    function emitEvent(eventName) {
      return function handler(arg) {
        self.emit(eventName, JSON.parse(arg));
      };
    }

    cordova(eventName).registerToNative(emitEvent(eventName));
  }

  Object.keys(ThaliEmitter.events)
    .forEach(function (key) {
      registerCordovaPeerEvent(ThaliEmitter.events[key]);
    });
};

// Starts peer communications.
ThaliEmitter.startBroadcasting = function(deviceName, port, cb) {
  cordova('StartBroadcasting').callNative(deviceName, port, function (err) {
    if (err) {
      cb(new Error(err));
    } else {
      cb();
    }
  });
};

// Stops peer communications.
ThaliEmitter.stopBroadcasting = function(cb) {
  cordova('StopBroadcasting').callNative(function (err) {
    if (err) {
      cb(new Error(err));
    } else {
      cb();
    }
  });
};

ThaliEmitter.prototype.connect = function (peerIdentifier, cb) {
  cordova('Connect').callNative(peerIdentifier, function (err, port) {
    if (err) {
      cb(new Error(err));
    } else {
      cb(null, port);
    }
  });
};

module.exports = ThaliEmitter;
