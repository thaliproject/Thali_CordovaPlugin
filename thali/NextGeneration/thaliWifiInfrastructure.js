'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var Promise = require('lie');
var nodessdp = require('node-ssdp');
var ip = require('ip');
var crypto = require('crypto');

var THALI_USN_PREFIX = 'urn:schemas-upnp-org:service:Thali';

/** @module ThaliWifiInfrastructure */

/**
 * @file
 *
 * This is the interface used to manage local discover of peers over a Wi-Fi
 * Infrastructure mode access point.
 *
 * All the methods defined in this file are asynchronous. However any time a
 * method is called the invocation will immediately return but the request will
 * actually be put on a queue and all incoming requests will be run out of that
 * queue. This means that if one calls two start methods on say advertising or
 * discovery then the first start method will execute, call back its promise and
 * only then will the second start method start running. This restriction is in
 * place to simplify the state model and reduce testing.
 *
 * All stop methods in this file are idempotent so they can be called multiple
 * times in a row without causing a state change.
 */

/**
 * This creates an object to manage a WiFi instance. During production we will
 * have exactly one instance running but for testing purposes it's very useful
 * to be able to run multiple instances. So long as the SSDP code uses a
 * different port to advertise for responses for each instance and as the router
 * instances are already specified to use whatever ports are available the
 * different instances should not run into each other.
 *
 * @public
 * @constructor
 * @fires event:wifiPeerAvailabilityChanged
 * @fires event:networkChangedWifi
 * @fires discoveryAdvertisingStateUpdateWifiEvent
 */
function ThaliWifiInfrastructure (deviceName) {
  EventEmitter.call(this);
  this.thaliUsn = THALI_USN_PREFIX;
  this.deviceName = deviceName || crypto.randomBytes(16).toString('base64');
  // Use port 0 so that random available port
  // will get used.
  this.port = 0;
  this.router = null;
  this.routerServer = null;
  this.started = null;
  this.listening = null;
  this.advertising = null;
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
  if (this._shouldBeIgnored(data)) {
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

// Function used to filter out SSDP messages that are not
// relevant for Thali.
ThaliWifiInfrastructure.prototype._shouldBeIgnored = function (data) {
  // First check if the data contains the Thali-specific USN.
  if (data.USN.indexOf(this.thaliUsn) >= 0) {
    // Filtering out messages from ourselves.
    if (data.USN.indexOf(this.deviceName) === 0) {
      return true;
    } else {
      return false;
    }
  }
  return true;
};

/**
 * This method MUST be called before any other method here other than
 * registering for events on the emitter. This method only registers the router
 * object but otherwise doesn't really do anything. It's just here to mirror how
 * {@link module:thaliMobileNativeWrapper} works.
 *
 * If the start fails then the object is not in start state.
 *
 * This method is not idempotent (even though it could be). If called two
 * times in a row without an intervening stop a "Call Stop!" Error MUST be
 * returned.
 *
 * This method can be called after stop since this is a singleton object.
 *
 * @param {Object} router This is an Express Router object (for example,
 * express-pouchdb is a router object) that the caller wants the WiFi
 * connections to be terminated with. This code will put that router at '/' so
 * make sure your paths are set up appropriately.
 * @returns {Promise<?Error>}
 */
ThaliWifiInfrastructure.prototype.start = function (router) {
  var self = this;
  if (self.started === true) {
    return Promise.reject('Call Stop!');
  }
  self.started = true;
  self.router = router;
  return Promise.resolve();
};

/**
 * This method will call all the stop methods and stop the TCP server hosting
 * the router.
 *
 * Once called the object is in the stop state.
 *
 * This method is idempotent and so MUST be able to be called multiple timex
 * in a row without changing state.
 *
 * @returns {Promise<?Error>}
 */
ThaliWifiInfrastructure.prototype.stop = function () {
  var self = this;
  if (self.started === false) {
    return Promise.resolve();
  }
  self.started = false;
  return self.stopAdvertisingAndListening().then(function () {
    return self.stopListeningForAdvertisements();
  });
};

/**
 * This will start the local Wi-Fi Infrastructure Mode discovery mechanism
 * (currently SSDP). Calling this method will trigger {@link
 * event:wifiPeerAvailabilityChanged} to fire. This method only causes SSDP
 * queries to be fired and cause us to listen to other service's SSDP:alive and
 * SSDP:byebye messages. It doesn't advertise the service itself.
 *
 * This method is idempotent so multiple consecutive calls without an
 * intervening call to stop will not cause a state change.
 *
 * | Error String | Description |
 * |--------------|-------------|
 * | No Wifi radio | This device doesn't support Wifi |
 * | Radio Turned Off | Wifi is turned off. |
 * | Unspecified Error with Radio infrastructure | Something went wrong trying to use WiFi. Check the logs. |
 * | Call Start! | The object is not in start state. |
 *
 * @returns {Promise<?Error>}
 */
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

/**
 * This will stop the local Wi-Fi Infrastructure Mode discovery mechanism
 * (currently SSDP). Calling this method will stop {@link
 * event:wifiPeerAvailabilityChanged} from firing. That is, we will not issue
 * any further SSDP queries nor will we listen for other service's SSDP:alive or
 * SSDP:byebye messages.
 *
 * Note that this method does not affect any existing TCP connections. Not
 * that we could really do anything with them since they are handled directly by
 * Node, not us.
 *
 * | Error String | Description |
 * |--------------|-------------|
 * | Failed | Somehow the stop method couldn't do its job. Check the logs. |
 *
 * @returns {Promise<?Error>}
 */
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

/**
 * This method will start advertising the peer's presence over the local Wi-Fi
 * Infrastructure Mode discovery mechanism (currently SSDP). When creating the
 * UDP socket for SSDP the socket MUST be "udp4". When socket.bind is called to
 * bind the socket to the SSDP multicast address and port, a random port will
 * automatically be picked by Node.js to bind the UDP port to locally. This
 * address is needed in order to set the location header in SSDP messages. This
 * port can be discovered via socket.address().port in the callback to the
 * socket.bind call. Note that we MUST make sure that the SSDP local UDP port is
 * picked randomly so we do not have collisions between multiple instances of
 * {@link module:ThaliWifiInfrastructure}. Also note that the implementation of
 * SSDP MUST recognize advertisements from its own instance and ignore them.
 * However it is possible to have multiple independent instances of
 * ThaliWiFiInfrastructure on the same device and we MUST process advertisements
 * from other instances of ThaliWifiInfrastructure on the same device.
 *
 * This method will also cause the Express app passed in to be hosted in a
 * HTTP server configured with the device's local IP. In other words, the
 * externally available HTTP server is not actually started and made externally
 * available until this method is called. This is different than {@link
 * module:thaliMobileNative} where the server is started on 127.0.0.1 as soon as
 * {@link module:thaliMobileNative.start} is called but isn't made externally
 * available over the non-TCP transport until the equivalent of this method is
 * called. If the device switches access points (e.g. the BSSID changes) or if
 * WiFi is lost then the server will be shut down. It is up to the caller to
 * catch the networkChanged event and to call start advertising again.
 *
 * __OPEN ISSUE:__ If we have a properly configured multiple AP network then
 * all the APs will have different BSSID values but identical SSID values and
 * the device should be able to keep the same IP. In that case do we want to
 * specify that if the BSSID changes but the SSID does not then we shouldn't
 * shut down the server?
 *
 * Each time this method is called it will cause the local advertisement to
 * change just enough to notify other peers that this peer has new data to
 * retrieve. No details will be provided about the peer on who the changes are
 * for. All that is provided is a flag just indicating that something has
 * changed. It is up to other peer to connect and retrieve details on what has
 * changed if they are interested.
 *
 * * By design this method is intended to be called multiple times without
 * calling stop as each call causes the currently notification flag to change.
 *
 * | Error String | Description |
 * |--------------|-------------|
 * | Bad Router | router is null or otherwise wasn't accepted by Express |
 * | No Wifi radio | This device doesn't support Wifi |
 * | Radio Turned Off | Wifi is turned off. |
 * | Unspecified Error with Radio infrastructure | Something went wrong trying to use WiFi. Check the logs. |
 * | Call Start! | The object is not in start state. |
 *
 * @returns {Promise<?Error>}
 */
ThaliWifiInfrastructure.prototype.startUpdateAdvertisingAndListening = function () {
  var self = this;
  if (!self.router) {
    return Promise.reject('Bad Router');
  }
  var randomString = crypto.randomBytes(16).toString('base64');
  // TODO: Appends to USN list, but does not remove.
  this._server.addUSN(this.thaliUsn + '::' + randomString);
  if (this.advertising === true) {
    return Promise.resolve();
  }
  this.advertising = true;
  return new Promise(function(resolve, reject) {
    self.routerServer = self.router.listen(self.port, function () {
      self.port = self.routerServer.address().port;
      // We need to update the location string, because the port
      // may have changed when we re-start the router server.
      self._setLocation();
      self._server.start(function () {
        resolve();
      });
    });
  });
};

/**
 * This method MUST stop advertising the peer's presence over the local Wi-Fi
 * Infrastructure Mode discovery mechanism (currently SSDP). This method MUST
 * also stop the HTTP server started by the start method.
 *
 * So long as the device isn't advertising the peer and the server is stopped
 * (even if the system was always in that state) then this method MUST succeed.
 *
 * | Error String | Description |
 * |--------------|-------------|
 * | Failed | Somehow the stop method couldn't do its job. Check the logs. |
 *
 * @returns {Promise<?Error>}
 */
ThaliWifiInfrastructure.prototype.stopAdvertisingAndListening = function() {
  var self = this;
  if (!this.advertising) {
    return Promise.resolve();
  }
  this.advertising = false;
  return new Promise(function(resolve, reject) {
    self._server.stop(function () {
      self.routerServer.close(function () {
        // The port needs to be reset, because
        // otherwise there is no guarantee that
        // the same port is available next time
        // we start the router server.
        self.port = 0;
        resolve();
      });
    });
  });
};

/**
 * This event specifies that a peer was discovered over Wi-Fi Infrastructure.
 * Please keep in mind that IP address bindings can change randomly amongst
 * peers and of course peers can disappear. So this should be considered more of
 * a hint than anything else. If the peer has gone (e.g. ssdp:byebye) then both
 * hostAddress and portNumber MUST be set to null.
 *
 * Note that when sending SSDP queries we MUST use a randomly assigned address
 * for the local UDP port as described in {@link
 * moduleThaliWifiInfrastructure.startUpdateAdvertisingAndListenForIncomingConne
 * ctions}. It is not necessary that this be the same UDP port as used in the
 * previously mentioned function.
 *
 * __Open Issue:__ There is a pretty obvious security hole here that a bad
 * actor could advertise a bunch of IP or DNS addresses of some innocent target
 * on a local network in order to trigger a connection storm. Given the various
 * limitations in place it's unclear how effective this would really be. There
 * are things we can to ameliorate the attack including only accepting IP
 * address that match the local network mask and also rate limiting how quickly
 * we are willing to connect to discovered peers.
 *
 * @event wifiPeerAvailabilityChanged
 * @public
 * @property {string} peerIdentifier This is the USN value
 * @property {string} peerLocation The URL of the peer
 */

/**
 * For the definition of this event please see {@link
 * module:thaliMobileNativeWrapper~discoveryAdvertisingStateUpdateEvent}
 *
 * This notifies the listener whenever the state of discovery or advertising
 * changes. In {@link module:thaliMobileNativeWrapper} the equivalent of this
 * event is fired from the native layer and then works its way through {@link
 * module:thaliMobileNative} to {@link module:thaliMobileNativeWrapper}. But in
 * the case of Wifi there is no native layer. Therefore if there is a call to
 * start/stop discovery/advertising or if a network change event forces a change
 * in status (e.g. someone turned off Wifi) then this class MUST issue this
 * event itself. That is, it must have hooked into the start/stop methods,
 * start/stop discovery/advertising methods, {@link
 * module:thaliMobileNativeWrapper.nonTCPPeerAvailabilityChangedEvent} events
 * when we are on mobile devices and {@link
 * module:ThaliWifiInfrastructure.networkChangedWifi} when we are on desktop to
 * figure out when status has changed and this event needs to be fired.
 *
 * @public
 * @event discoveryAdvertisingStateUpdateWifiEvent
 * @type {Object}
 * @property {module:thaliMobileNative~discoveryAdvertisingStateUpdate} discoveryAdvertisingStateUpdateValue
 */

/**
 * For the definition of this event please see {@link
 * module:thaliMobileNativeWrapper~discoveryAdvertisingStateUpdateEvent}.
 *
 * The WiFi layer MUST NOT emit this event unless we are running on Linux,
 * OS/X or Windows. In the case that we are running on those platforms then If
 * we are running on those platforms then blueToothLowEnergy and blueTooth MUST
 * both return radioState set to `doNotCare`. Also note that these platforms
 * don't generally support a push based way to detect WiFi state (at least not
 * without writing native code). So for now we can use polling and something
 * like [network-scanner](https://www.npmjs.com/package/network-scanner) to give
 * us some sense of the system's state.
 *
 * @public
 * @event networkChangedWifi
 * @type {Object}
 * @property {module:thaliMobileNative~networkChanged} networkChangedValue
 *
 */

module.exports = ThaliWifiInfrastructure;
