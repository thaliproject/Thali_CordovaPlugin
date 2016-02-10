'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var nodessdp = require('node-ssdp');
var ip = require('ip');
var uuid = require('node-uuid');
var url = require('url');
var express = require('express');
var validations = require('../validations');
var ThaliConfig = require('./thaliConfig');
var ThaliMobileNativeWrapper = require('./thaliMobileNativeWrapper');
var logger = require('../thalilogger')('thaliWifiInfrastructure');

var Promise = require('lie');
var PromiseQueue = require('./promiseQueue');
var promiseQueue = new PromiseQueue();

var promiseResultSuccessOrFailure = function (promise) {
  return promise.then(function (success) {
    return success;
  }).catch(function (failure) {
    return failure;
  });
};

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
function ThaliWifiInfrastructure () {
  EventEmitter.call(this);
  this.usn = null;
  // Use port 0 so that random available port
  // will get used.
  this.port = 0;
  this.expressApp = null;
  this.router = null;
  this.routerServer = null;
  this.routerServerErrorListener = null;

  this.states = {
    started: false,
    listening: {
      target: false,
      current: false
    },
    advertising: {
      target: false,
      current: false
    },
    networkState: {}
  };

  // A variable to hold information about known peer availability states
  // and used to avoid emitting peer availability changes in case the
  // availability hasn't changed from the previous known value.
  this.peerAvailabilities = {};
  this._init();
}

inherits(ThaliWifiInfrastructure, EventEmitter);

ThaliWifiInfrastructure.prototype._init = function () {
  var serverOptions = {
    adInterval: ThaliConfig.SSDP_ADVERTISEMENT_INTERVAL,
    udn: ThaliConfig.SSDP_NT
  };
  this._server = new nodessdp.Server(serverOptions);
  this._setLocation();

  this._client = new nodessdp.Client();

  this._client.on('advertise-alive', function (data) {
    this._handleMessage(data, true);
  }.bind(this));

  this._client.on('advertise-bye', function (data) {
    this._handleMessage(data, false);
  }.bind(this));

  ThaliMobileNativeWrapper.emitter.on('networkChangedNonTCP',
  function (networkChangedValue) {
    this._handleNetworkChanges(networkChangedValue);

    // When running within JXcore Cordova Mobile environment,
    // don't pass this event onwards, because there, the network
    // events are bubbled up via the native layer.
    if (typeof Mobile !== 'undefined') {
      return;
    }
    this.emit('networkChangedWifi', networkChangedValue);
  }.bind(this));
};

ThaliWifiInfrastructure.prototype._handleNetworkChanges =
function (networkChangedValue) {
  var self = this;
  var previousNetworkState = self.states.networkState;
  self.states.networkState = networkChangedValue;
  // If the wifi state hasn't changed, we are not really interested
  if (previousNetworkState.wifi === self.states.networkState.wifi) {
    return;
  }
  var actionList = [];
  if (self.states.networkState.wifi === 'on') {
    // If the wifi state turned on, try to get into the target states
    if (self.states.listening.target) {
      actionList.push(promiseResultSuccessOrFailure(
        self.startListeningForAdvertisements())
      );
    }
    if (self.states.advertising.target) {
      actionList.push(promiseResultSuccessOrFailure(
        self.startUpdateAdvertisingAndListening())
      );
    }
  } else {
    var changedPeers = [];
    for (var key in self.peerAvailabilities) {
      if (self.peerAvailabilities[key]) {
        // Mark peer unavailable in the local list
        self.peerAvailabilities[key] = false;
        // Add peer to the list of changes to emit
        changedPeers.push({
          peerIdentifier: key,
          hostAddress: null,
          portNumber: null
        });
      }
    }
    if (changedPeers.length > 0) {
      self.emit('wifiPeerAvailabilityChanged', changedPeers);
    }
    // If wifi didn't turn on, it was turned into a state where we want
    // to stop our actions
    actionList = [
      promiseResultSuccessOrFailure(
        self.stopAdvertisingAndListening(false, true)
      ),
      promiseResultSuccessOrFailure(
        self.stopListeningForAdvertisements(false, true)
      )
    ];
  }
  Promise.all(actionList).then(function (results) {
    for (var index in results) {
      if (results[index]) {
        logger.warn('Error when reacting to wifi state changes: %s',
                    results[index].toString());
      }
    }
  });
};

ThaliWifiInfrastructure.prototype._setLocation = function (address, port) {
  address = address || ip.address();
  port = port || this.port;
  this._server._location = 'http://' + address + ':' + port;
};

ThaliWifiInfrastructure.prototype._handleMessage = function (data, available) {
  if (this._shouldBeIgnored(data)) {
    return false;
  }

  var usn = data.USN;
  try {
    validations.ensureNonNullOrEmptyString(usn);
  } catch (error) {
    logger.warn('Received an invalid USN value: %s', data.USN);
    return false;
  }

  var peer = {
    peerIdentifier: usn
  };

  // We expect location only in alive messages.
  if (available === true) {
    var parsedLocation = url.parse(data.LOCATION);
    var portNumber = parseInt(parsedLocation.port);
    try {
      validations.ensureValidPort(portNumber);
    } catch (error) {
      logger.warn('Failed to parse a valid port number from location: %s', data.LOCATION);
      return false;
    }
    peer.hostAddress = parsedLocation.hostname;
    peer.portNumber = portNumber;
  } else {
    peer.hostAddress = peer.portNumber = null;
  }

  if (this.peerAvailabilities[peer.peerIdentifier] === available) {
    return false;
  }
  this.peerAvailabilities[peer.peerIdentifier] = available;
  this.emit('wifiPeerAvailabilityChanged', [peer]);
  return true;
};

// Function used to filter out SSDP messages that are not
// relevant for Thali.
ThaliWifiInfrastructure.prototype._shouldBeIgnored = function (data) {
  // First check if the data contains the Thali-specific NT.
  if (data.NT === ThaliConfig.SSDP_NT) {
    // Filtering out messages from ourselves.
    if (data.USN === this.usn) {
      return true;
    } else {
      return false;
    }
  }
  return true;
};

ThaliWifiInfrastructure.prototype._rejectPerWifiState = function (reject) {
  var errorMessage;
  switch (this.states.networkState.wifi) {
    case 'off': {
      errorMessage = 'Radio Turned Off';
      break;
    }
    case 'notHere': {
      errorMessage = 'No Wifi radio';
      break;
    }
    default: {
      errorMessage = 'Unspecified Error with Radio infrastructure';
    }
  }
  return reject(new Error(errorMessage));
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
  return promiseQueue.enqueue(function (resolve, reject) {
    if (self.states.started === true) {
      return reject(new Error('Call Stop!'));
    }
    ThaliMobileNativeWrapper.getNonTCPNetworkStatus()
    .then(function (networkStatus) {
      self.states.networkState = networkStatus;
      self.states.started = true;
      self.router = router;
      return resolve();
    });
  });
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
  return promiseQueue.enqueue(function (resolve, reject) {
    if (self.states.started === false) {
      return resolve();
    }
    self.stopAdvertisingAndListening(true)
    .then(function () {
      return self.stopListeningForAdvertisements(true);
    })
    .then(function () {
      self.states.started = false;
      return resolve();
    })
    .catch(function (error) {
      reject(error);
    });
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
ThaliWifiInfrastructure.prototype.startListeningForAdvertisements =
function () {
  var self = this;
  self.states.listening.target = true;
  return promiseQueue.enqueue(function (resolve, reject) {
    if (self.states.listening.current) {
      return resolve();
    }
    if (self.states.networkState.wifi === 'on') {
      self._client.start(function () {
        self.states.listening.current = true;
        return resolve();
      });
    } else {
      return self._rejectPerWifiState(reject);
    }
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
ThaliWifiInfrastructure.prototype.stopListeningForAdvertisements =
function (skipPromiseQueue, noTargetChange) {
  var self = this;
  if (!noTargetChange) {
    self.states.listening.target = false;
  }
  var action = function (resolve, reject) {
    if (!self.states.listening.current) {
      return resolve();
    }
    self._client.stop(function () {
      self.states.listening.current = false;
      return resolve();
    });
  };
  if (skipPromiseQueue === true) {
    return new Promise(action);
  } else {
    return promiseQueue.enqueue(action);
  }
};

/**
 * This method will start advertising the peer's presence over the local Wi-Fi
 * Infrastructure Mode discovery mechanism (currently SSDP). When creating the
 * UDP socket for SSDP the socket MUST be "udp4". When socket.bind is called to
 * bind the socket the SSDP multicast address 239.255.255.250 and port 1900 MUST
 * be chosen as they are the reserved address and port for SSDP.
 * 
 * __OPEN ISSUE:__ What happens on Android or iOS or the desktop OS's for that
 * matter if multiple apps all try to bind to the same UDP multicast address?
 * It should be fine. But it's important to find out so that other apps can't
 * block us.
 *
 * Also note that the implementation of
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
ThaliWifiInfrastructure.prototype.startUpdateAdvertisingAndListening =
function () {
  var self = this;
  self.states.advertising.target = true;
  return promiseQueue.enqueue(function (resolve, reject) {
    if (!self.states.started) {
      return reject(new Error('Call Start!'));
    }
    if (!self.router) {
      return reject(new Error('Bad Router'));
    }

    // Generate a new USN value to flag that something has changed
    // in this peer.
    self.usn = 'urn:uuid:' + uuid.v4();

    if (self.states.networkState.wifi !== 'on') {
      return self._rejectPerWifiState(reject);
    }

    if (self.states.advertising.current) {
      // If we were already advertising, we need to restart the server
      // so that a byebye is issued for the old USN and and alive
      // message for the new one.
      self._server.stop(function () {
        self._server.setUSN(self.usn);
        self._server.start(function () {
          return resolve();
        });
      });
    } else {
      self.expressApp = express();
      try {
        self.expressApp.use('/', self.router);
      } catch (error) {
        logger.error('Unable to use the given router: %s', error.toString());
        return reject(new Error('Bad Router'));
      }
      var startErrorListener = function (error) {
        logger.error('Router server emitted an error: %s', error.toString());
        self.routerServer.removeListener('error', startErrorListener);
        self.routerServer = null;
        reject(new Error('Unspecified Error with Radio infrastructure'));
      };
      self.routerServerErrorListener = function (error) {
        // Error is only logged, because it was determined this should
        // not occur in normal use cases and it wasn't worthwhile to
        // specify a custom error that the upper layers should listen to.
        // If this error is seen in real scenario, a proper error handling
        // should be specified and implemented.
        logger.error('Router server emitted an error: %s', error.toString());
      };
      var listeningHandler = function () {
        self.port = self.routerServer.address().port;
        self._server.setUSN(self.usn);
        // We need to update the location string, because the port
        // may have changed when we re-start the router server.
        self._setLocation();
        self._server.start(function () {
          // Remove the error listener we had during the resolution of this
          // promise and add one that is listening for errors that may
          // occur any time.
          self.routerServer.removeListener('error', startErrorListener);
          self.routerServer.on('error', self.routerServerErrorListener);
          self.states.advertising.current = true;
          return resolve();
        });
      };
      self.routerServer = self.expressApp.listen(self.port, listeningHandler);
      self.routerServer.on('error', startErrorListener);
    }
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
ThaliWifiInfrastructure.prototype.stopAdvertisingAndListening =
function (skipPromiseQueue, noTargetChange) {
  var self = this;
  if (!noTargetChange) {
    self.states.advertising.target = false;
  }
  var action = function (resolve, reject) {
    if (!self.states.advertising.current) {
      return resolve();
    }
    self._server.stop(function () {
      self.routerServer.close(function () {
        // The port needs to be reset, because
        // otherwise there is no guarantee that
        // the same port is available next time
        // we start the router server.
        self.port = 0;
        self.routerServer.removeListener('error', self.routerServerErrorListener);
        self.routerServer = null;
        self.states.advertising.current = false;
        return resolve();
      });
    });
  };
  if (skipPromiseQueue === true) {
    return new Promise(action);
  } else {
    return promiseQueue.enqueue(action);
  }
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
 * @property {string} hostAddress This can be either an IP address or a DNS
 * address encoded as a string
 * @property {number} portNumber The port on the hostAddress to use to connect
 * to the peer
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
