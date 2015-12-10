'use strict'

var os = require('os');
var net = require('net');
var url = require('url');

var testUtils = require('./testUtils.js');
var ThaliWifiInfrastructure = require('thali/ThaliWifiInfrastructure');

var randomSuffix = '' + Math.round((Math.random() * 10000))
var randomDeviceName = 'device-' + randomSuffix;
var wifiInfrastructure = new ThaliWifiInfrastructure(randomDeviceName);

var mocks = {};

mocks.StartBroadcasting = function (args, callback) {
  var port = args[1];
  // Using the Wifi instrastructure here in a bit unintended
  // way to be able to complete the mock against the older
  // version of the Thali specification.
  wifiInfrastructure._setLocation(null, port, null);
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

mocks.Connect = function (args, callback) {
  var port = url.parse(args[0]).port;
  setImmediate(function () {
    callback(null, port);
  })
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
        var callback = arguments[arguments.length - 1];
        mocks[key](args, callback);
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
  setImmediate(function () {
    callback(null, testUtils.tmpDirectory());
  });
};

module.exports = Mobile;
