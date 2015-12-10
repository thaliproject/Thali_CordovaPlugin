'use strict'

var os = require('os');
var net = require('net');
var path = require('path');
var fs = require('fs');

var ThaliWifiInfrastructure = require('thali/ThaliWifiInfrastructure');

var randomSuffix = '' + Math.round((Math.random() * 10000))
var randomDeviceName = 'device-' + randomSuffix;
var wifiInfrastructure = new ThaliWifiInfrastructure(randomDeviceName);

var mocks = {};

mocks.StartBroadcasting = function (args, callback) {
  wifiInfrastructure.startListeningForAdvertisements()
  .then(function () {
    return wifiInfrastructure.startUpdateAdvertisingAndListenForIncomingConnections();
  })
  .then(function () {
    callback(null);
  });
};

mocks.StopBroadcasting = function (args, callback) {
  wifiInfrastructure.stopListeningForAdvertisements()
  .then(function () {
    return wifiInfrastructure.stopAdvertisingAndListeningForIncomingConnections();
  })
  .then(function () {
    callback(null);
  });
};

var Mobile = function (key) {
  return {
    callNative: function () {
      // Make arguments a proper array and separate
      // the last item, which is always the callback
      // function.
      var args = [];
      for (var i = 0; i < arguments.length - 1; i++) {
        args[i] = arguments[i];
      }
      if (mocks.hasOwnProperty(key)) {
        mocks[key](args, arguments[arguments.length - 1]);
      } else {
        throw new Error('The callNative for key ' + key + ' is not implemented!');
      }
    },
    registerToNative: function (callback) {
      // TODO: Currently only handle peer availability changes
      if (key == 'peerAvailabilityChanged') {
        wifiInfrastructure.on('wifiPeerAvailabilityChanged', function (data) {
          // Currently, we always get one peer in the list
          // so just pick the first one.
          var peer = data[0];
          callback([{
            peerName: peer.peerAddress,
            peerIdentifier: peer.peerAddress,
            peerAvailable: peer.peerAvailable,
          }]);
        });
      }
    }
  };
};

Mobile.GetDocumentsPath = function (callback) {
  var directoryForThisInstance = path.join(os.tmpdir(), randomSuffix);
  fs.mkdir(directoryForThisInstance, function () {
    callback(null, directoryForThisInstance);
  });
};

module.exports = Mobile;
