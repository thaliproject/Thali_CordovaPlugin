'use strict'

var os = require('os');
var net = require('net');
var url = require('url');

var testUtils = require('./../../lib/testUtils.js');
var ThaliWifiInfrastructure = require('thali/NextGeneration/thaliWifiInfrastructure');

var randomSuffix = '' + Math.round((Math.random() * 10000))
var randomDeviceName = 'device-' + randomSuffix;
var wifiInfrastructure = new ThaliWifiInfrastructure();

var mocks = {};
var broadcastingStarted = false;
var peersDiscovered = {};
var peersConnected = {};
var connectionErrorCallback = null

mocks.StartBroadcasting = function (args, callback) {
  if (broadcastingStarted) {
    callback(new Error());
    return;
  }
  broadcastingStarted = true;
  var port = args[1];
  // Using the Wifi instrastructure here in a bit unintended
  // way to be able to complete the mock against the older
  // version of the Thali specification.
  wifiInfrastructure._setLocation(null, port, null);
  wifiInfrastructure.start({
    listen: function (listenPort, listenCallback) {
      setImmediate(listenCallback);
      return {
        close: function (closeCallback) {
          setImmediate(closeCallback);
        },
        address: function () {
          return {
            port: port
          }
        }
      }
    }
  })
  .then(function () {
    return wifiInfrastructure.startListeningForAdvertisements();
  })
  .then(function () {
    return wifiInfrastructure.startUpdateAdvertisingAndListening();
  })
  .then(function () {
    callback(null);
  });
};

mocks.StopBroadcasting = function (args, callback) {
  broadcastingStarted = false;
  wifiInfrastructure.stop().then(function () {
    callback(null);
  });
};

mocks.connect = function (args, callback) {
  var peerIdentifier = args[0];
  // Check if we try to connect to an unknown peer or if
  // we are already connected.
  if (typeof peersDiscovered[peerIdentifier] === 'undefined' ||
      peersConnected[peerIdentifier] === true) {
    setImmediate(function () {
      callback(new Error());
    });
    return;
  }
  peersConnected[peerIdentifier] = true;
  // Parsing a port from the peer identifier works only, because we
  // know this mock uses the Wifi infrastructure discovery, which uses
  // an URL as the identifier.
  var port = url.parse(peerIdentifier).port;
  setImmediate(function () {
    callback(null, port);
  });
};

mocks.Disconnect = function (args, callback) {
  var peerIdentifier = args[0];
  // Check if we try to disconnect from an unknown peer or if
  // we have already disconnected.
  if (typeof peersDiscovered[peerIdentifier] === 'undefined' ||
      peersConnected[peerIdentifier] === false) {
    setImmediate(function () {
      callback(new Error());
    });
    return;
  }
  peersConnected[peerIdentifier] = false;
  setImmediate(function () {
    callback(null);
  });
};

mocks.GetDeviceName = function (args, callback) {
  setImmediate(function () {
    callback(randomDeviceName);
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
        var callback = arguments[arguments.length - 1];
        mocks[key](args, callback);
      } else {
        throw new Error('The callNative for key ' + key + ' is not implemented!');
      }
    },
    registerToNative: function (callback) {
      if (key === 'peerAvailabilityChanged') {
        wifiInfrastructure.on('wifiPeerAvailabilityChanged', function (data) {
          // Currently, we always get one peer in the list
          // so just pick the first one.
          var peer = data[0];
          // Use peer location as identifier in this mock so that
          // we can made the connections work with the older
          // version of the Thali specification.
          var peerIdentifier = peer.peerLocation;
          peersDiscovered[peerIdentifier] = peer.peerAvailable;
          callback([{
            peerName: peerIdentifier,
            peerIdentifier: peerIdentifier,
            peerAvailable: peer.peerAvailable,
          }]);
        });
      } else if (key === 'connectionError') {
        // Store the connection error callback so that it can be
        // triggered later.
        connectionErrorCallback = callback;
      }
    }
  };
};

Mobile.iAmAMock = true;

Mobile.TriggerConnectionError = function () {
  if (connectionErrorCallback !== null) {
    Object.keys(peersConnected).forEach(function (key) {
      if (peersConnected[key] === true) {
        peersConnected[key] = false;
        connectionErrorCallback({
          peerIdentifier: key
        });
      }
    });
  }
}

Mobile.GetDocumentsPath = function (callback) {
  setImmediate(function () {
    callback(null, testUtils.tmpDirectory());
  });
};

module.exports = Mobile;
