var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

function ThaliEmitter() {
  EventEmitter.call(this);
  this._init();
}

inherits(ThaliEmitter, EventEmitter);

ThaliEmitter.events = {
  CONNECTING_TO_PEER_SERVER: 'connectingToPeerServer',
  CONNECTED_TO_PEER_SERVER: 'connectedToPeerServer',
  NOT_CONNECTED_TO_PEER_SERVER: 'notConnectedToPeerServer',
  PEER_CLIENT_CONNECTING: 'peerClientConnecting',
  PEER_CLIENT_CONNECTED: 'peerClientConnected',
  PEER_CLIENT_NOT_CONNECTED: 'peerClientNotConnected',
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
        // Parse if it's a JSON object
        if (JSON_EVENTS.indexOf(eventName) !== -1) {
          arg = JSON.parse(arg);
        }

        self.emit(eventName, arg);
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
ThaliEmitter.startBroadcasting = function(cb) {
  getPeerIdentifier(function (err, peerIdentifier) {
    getDeviceName(function (err, deviceName) {
      cordova('StartPeerCommunications').callNative(peerIdentifier, deviceName, function (value) {
        // TODO: This needs to be an error or something
        if (!value) {
          cb(new Error('Cannot start device advertising'));
        } else {
          cb(null);
        }
      });
    })
  });
};

// Stops peer communications.
ThaliEmitter.stopBroadcasting = function(cb) {
  cordova('StopPeerCommunications').callNative(function (value) {
    // TODO: This needs to be an error or something
    if (!value) {
      cb(new Error('Cannot stop device advertising'));
    } else {
      cb(null);
    }
  });
};

ThaliEmitter.prototype.beginCommunicationWithPeer = function (peerIdentifier) {
  cordova('BeginConnectToPeerServer').callNative(peerIdentifier, function (value) {
    // TODO: This needs to be an error or something
    if (!value) {
      cb(new Error('Cannot start communication with peer'));
    } else {
      // Should have a port number
      cb(null, 0);
    }
  });
};

ThaliEmitter.prototype.stopCommunicationWithPeer = function (peerIdentifier) {
  cordova('DisconnectFromPeerServer').callNative(peerIdentifier, function (value) {
    // TODO: This needs to be an error or something
    if (!value) {
      cb(new Error('Cannot stop communication with peer'));
    } else {
      cb(null);
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
}
/* End Utility Methods */

module.exports = ThaliEmitter;
