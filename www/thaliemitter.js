var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;

function ThaliEmitter() {
  EventEmitter.call(this);
}

inherits(ThaliEmitter, EventEmitter);

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

module.exports = ThaliEmitter;
