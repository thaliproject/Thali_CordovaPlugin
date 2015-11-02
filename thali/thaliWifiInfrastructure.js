'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Promise = require('lie');
var nodessdp = require('node-ssdp');
var ip = require('ip');
var crypto = require('crypto');

function ThaliWifiInfrastructure() {
  EventEmitter.call(this);
  this._init();
}

inherits(ThaliWifiInfrastructure, EventEmitter);

ThaliWifiInfrastructure.prototype._init = function (deviceName) {
  var serverOptions = {
    location: ip.address() + ':5000/NotificationBeacons',
    adInterval: 500,
    allowWildcards: true,
    logJSON: false,
    logLevel: 'trace'
  };
  if (deviceName) {
    serverOptions.udn = deviceName;
  }
  this._server = new nodessdp.Server(serverOptions);

  this._client = new nodessdp.Client({
    allowWildcards: true,
    logJSON: false,
    logLevel: 'trace'
  });

  this._client.on('advertise-alive', function (data) {
    this.emit('wifiPeerAvailabilityChanged', [{
      peerAddress: data.LOCATION + '',
      peerAvailable: true
    }]);
  }.bind(this));

  this._client.on('advertise-bye', function (data) {
    this.emit('wifiPeerAvailabilityChanged', [{
      peerAddress: data.LOCATION + '',
      peerAvailable: false
    }]);
  }.bind(this));
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
  this._server.addUSN('urn:schemas-upnp-org:service:Thali:' + randomString);
  this._server.start();
  return Promise.resolve();
};

ThaliWifiInfrastructure.prototype.stopAdvertisingAndListeningForIncomingConnections = function () {
  this._server.stop();
  return Promise.resolve();
};

module.exports = ThaliWifiInfrastructure;
