'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Promise = require('lie');
var nodessdp = require('node-ssdp');
var ip = require('ip');
var crypto = require('crypto');

var THALI_USN = 'urn:schemas-upnp-org:service:Thali';

function ThaliWifiInfrastructure (deviceName, port) {
  EventEmitter.call(this);
  this.thaliUsn = THALI_USN;
  this.deviceName = deviceName || crypto.randomBytes(16).toString('base64');
  this.port = port || 0;
  this.listening = false;
  this.advertising = false;
  // A variable to hold information about known peer availability states
  // and used to avoid emitting peer availability changes in case the
  // availability hasn't changed from the previous known value.
  this.peerAvailabilities = {};
  this._init(deviceName);
}

inherits(ThaliWifiInfrastructure, EventEmitter);

ThaliWifiInfrastructure.prototype._init = function () {
  var serverOptions = {
    adInterval: 500,
    allowWildcards: true,
    logJSON: false,
    logLevel: 'trace',
    udn: this.deviceName
  };
  this._server = new nodessdp.Server(serverOptions);
  this._setLocation();

  this._client = new nodessdp.Client({
    allowWildcards: true,
    logJSON: false,
    logLevel: 'trace'
  });

  this._client.on('advertise-alive', function (data) {
    this._handleMessage(data, true);
  }.bind(this));

  this._client.on('advertise-bye', function (data) {
    this._handleMessage(data, false);
  }.bind(this));
};

ThaliWifiInfrastructure.prototype._setLocation = function (address, port, path) {
  address = address || ip.address();
  port = port || this.port;
  path = path || 'NotificationBeacons';
  this._server._location = 'http://' + address + ':' + port + '/' + path;
};

ThaliWifiInfrastructure.prototype._handleMessage = function (data, available) {
  if (this.shouldBeIgnored(data)) {
    return;
  }
  var peer = {
    peerIdentifier: data.USN,
    peerLocation: data.LOCATION,
    peerAvailable: available
  };
  if (this.peerAvailabilities[peer.peerIdentifier] === available) {
    return;
  }
  this.peerAvailabilities[peer.peerIdentifier] = available;
  this.emit('wifiPeerAvailabilityChanged', [peer]);
};

ThaliWifiInfrastructure.prototype.startListeningForAdvertisements = function () {
  var self = this;
  if (this.listening) {
    return Promise.resolve();
  }
  this.listening = true;
  return new Promise(function(resolve, reject) {
    self._client.start(function () {
      resolve();
    });
  });
};

ThaliWifiInfrastructure.prototype.stopListeningForAdvertisements = function () {
  var self = this;
  if (!this.listening) {
    return Promise.resolve();
  }
  this.listening = false;
  return new Promise(function(resolve, reject) {
    self._client.stop(function () {
      resolve();
    });
  });
};

ThaliWifiInfrastructure.prototype.startUpdateAdvertisingAndListenForIncomingConnections = function () {
  var self = this;
  if (this.advertising) {
    return Promise.resolve();
  }
  this.advertising = true;
  // TODO: USN should be regenerated every time this method is called, because
  // according to the specification, that happens when the beacon string is changed.
  // Is below enough or should we use some uuid library or something else?
  var randomString = crypto.randomBytes(16).toString('base64');
  // TODO: Appends to USN list, but does not remove.
  this._server.addUSN(this.thaliUsn + '::' + randomString);
  return new Promise(function(resolve, reject) {
    self._server.start(function () {
      resolve();
    });
  });
};

ThaliWifiInfrastructure.prototype.stopAdvertisingAndListeningForIncomingConnections = function () {
  var self = this;
  if (!this.advertising) {
    return Promise.resolve();
  }
  this.advertising = false;
  return new Promise(function(resolve, reject) {
    self._server.stop(function () {
      resolve();
    });
  });
};

// Function used to filter out SSDP messages that are not
// relevant for Thali.
ThaliWifiInfrastructure.prototype.shouldBeIgnored = function (data) {
  // First check if the data contains the Thali-specific USN.
  if (data.USN.indexOf(this.thaliUsn) >= 0) {
    // We also discover ourself via SSDP to need to filter
    // out the messages that are originating from this device.
    if (data.USN.indexOf(this.deviceName) === 0) {
      return true;
    } else {
      return false;
    }
  }
  return true;
};

module.exports = ThaliWifiInfrastructure;
