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

var JSON_EVENTS = [
  'peerAvailabilityChanged',
  'networkChanged'
];

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
ThaliEmitter.startBroadcasting = function(port, cb) {
  getPeerIdentifier(function (err, peerIdentifier) {
    getDeviceName(function (err, deviceName) {
      cordova('StartBroadcasting').callNative(peerIdentifier, deviceName, port, function (err) {
        if (err) {
          cb(new Error(err));
        } else {
          cb();
        }
      });
    })
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

ThaliEmitter.prototype.disconnect = function (peerIdentifier, cb) {
  cordova('Disconnect').callNative(peerIdentifier, function (err) {
    if (err) {
      cb(new Error(err));
    } else {
      cb();
    }
  });
};

/* Begin Utility Methods */
function getDeviceName(cb) {
  cordova('GetDeviceName').callNative(function (deviceName) {
    cb(null, deviceName);
  });
};

function getFreePort(cb) {
  cordova('getFreePort').callNative(function (freePort) {
    cb(null, freePort);
  });
}

function getPeerIdentifier(cb) {
  var key = 'PeerIdentifier';
  cordova('GetKeyValue').callNative(key, function (value) {
    if (value !== undefined) {
      cb(null, value);
    } else {
      cordova('MakeGUID').callNative(function (guid) {
        cordova('SetKeyValue').callNative(key, guid, function (err) {
          if (!response.result) {
            cb(new Error(err));
          } else {
            cb(null, guid);
          }
        })
      })
    }
  })
}
/* End Utility Methods */

module.exports = ThaliEmitter;
