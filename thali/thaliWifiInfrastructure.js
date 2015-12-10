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
    udn: this.deviceName + ':' + this.thaliUsn
  };
  this._server = new nodessdp.Server(serverOptions);
  this._setLocation();

  this._client = new nodessdp.Client({
    allowWildcards: true,
    logJSON: false,
    logLevel: 'trace'
  });

  this._client.on('advertise-alive', function (data) {
    if (this.shouldBeIgnored(data)) {
      return;
    }
    var peerAddress = data.LOCATION + '';
    if (this.peerAvailabilities[peerAddress]) {
      return;
    }
    this.peerAvailabilities[peerAddress] = true;
    this.emit('wifiPeerAvailabilityChanged', [{
      peerAddress: peerAddress,
      peerAvailable: true
    }]);
  }.bind(this));

  this._client.on('advertise-bye', function (data) {
    if (this.shouldBeIgnored(data)) {
      return;
    }
    var peerAddress = data.LOCATION + '';
    if (!this.peerAvailabilities[peerAddress]) {
      return;
    }
    this.peerAvailabilities[peerAddress] = false;
    this.emit('wifiPeerAvailabilityChanged', [{
      peerAddress: peerAddress,
      peerAvailable: false
    }]);
  }.bind(this));
};

ThaliWifiInfrastructure.prototype._setLocation = function (address, port, path) {
  address = address || ip.address();
  port = port || this.port;
  path = path || 'NotificationBeacons';
  this._server._location = 'http://' + address + ':' + port + '/' + path;
};

ThaliWifiInfrastructure.prototype.startListeningForAdvertisements = function () {
  this._client.start();
  return Promise.resolve();
};

ThaliWifiInfrastructure.prototype.stopListeningForAdvertisements = function () {
  this._client.stop();
  return Promise.resolve();
};

ThaliWifiInfrastructure.prototype.startUpdateAdvertisingAndListenForIncomingConnections = function () {
  // TODO: USN should be regenerated every time this method is called, because
  // according to the specification, that happens when the beacon string is changed.
  // Is below enough or should we use some uuid library or something else?
  var randomString = crypto.randomBytes(16).toString('base64');
  this._server.addUSN(this.thaliUsn + ':' + randomString);
  this._server.start();
  return Promise.resolve();
};

ThaliWifiInfrastructure.prototype.stopAdvertisingAndListeningForIncomingConnections = function () {
  this._server.stop();
  return Promise.resolve();
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
