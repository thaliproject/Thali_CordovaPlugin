var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

function ThaliEmitter() {
  EventEmitter.call(this);
  this._init();
}

inherits(ThaliEmitter, EventEmitter);

ThaliEmitter.PEER_EVENTS = [
  'connectingToPeerServer',
  'connectedToPeerServer',
  'notConnectedToPeerServer',
  'peerClientConnecting',
  'peerClientConnected',
  'peerClientNotConnected',
  'peerAvailabilityChanged',
  'networkChanged'
];

var PARSE_EVENTS = [
  'peerAvailabilityChanged',
  'networkChanged'
];

ThaliEmitter.prototype._init = function () {
  var self = this;

  function registerCordovaPeerEvent(eventName) {
    function emitEvent(eventName) {
      return function handler(arg) {
        // Hack to handle JSON for multiple values
        if (PARSE_EVENTS.indexOf(eventName) !== -1) {
          arg = JSON.parse(arg);
        }

        self.emit(eventName, arg);
      };
    }

    cordova(eventName).registerToNative(emitEvent(eventName));
  }

  ThaliEmitter.PEER_EVENTS.forEach(registerCordovaPeerEvent);
};


ThaliEmitter.prototype.getDeviceName = function (cb) {
  cordova('GetDeviceName').callNative(function (deviceName) {
    cb(null, deviceName);
  });
};

ThaliEmitter.prototype.getFreePort = function (cb) {
  cordova('getFreePort').callNative(function (freePort) {
    cb(null, freePort);
  });
};

ThaliEmitter.getPeerIdentifier = function (cb) {
  var key = 'PeerIdentifier';
  cordova('GetKeyValue').callNative(key, function (value) {
    if (value !== undefined) {
      cb(null, value);
    } else {
      cordova('MakeGUID').callNative(function (guid) {
        cordova('SetKeyValue').callNative(key, guid, function (response) {
          if (!response.result) {
            cb(new Error('Failed to save peer identifier'));
          } else {
            cb(null, guid);
          }
        })
      })
    }
  })
};

// Starts peer communications.
ThaliEmitter.startPeerCommunications = function(peerIdentifier, peerName, cb) {
  cordova('StartPeerCommunications').callNative(peerIdentifier, peerName, function (value) {
    cb(null, true); // Always true according to the code
  });
};

// Stops peer communications.
ThaliEmitter.startPeerCommunications = function(peerIdentifier, peerName, cb) {
  cordova('StopPeerCommunications').callNative(function () {
    cb();
  });
};

module.exports = ThaliEmitter;
