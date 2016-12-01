'use strict';

var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var https = require('https');
var url = require('url');

var Promise = require('lie');
var nodessdp = require('node-ssdp');
var ip = require('ip');
var uuid = require('uuid');
var express = require('express');
var validations = require('../validations');
var thaliConfig = require('./thaliConfig');
var ThaliMobileNativeWrapper = require('./thaliMobileNativeWrapper');
var logger = require('../ThaliLogger')('thaliWifiInfrastructure');
var makeIntoCloseAllServer = require('./makeIntoCloseAllServer');
var PromiseQueue = require('./promiseQueue');
var USN = require('./utils/usn');

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
  this.peer = null;
  // Store previously used own peerIdentifiers so ssdp client can ignore some
  // delayed ssdp messages after our server has changed uuid part of usn
  this._ownPeerIdentifiersHistory = [];
  // Can be used in tests to override the port
  // advertised in SSDP messages.
  this.advertisedPortOverride = null;
  this.expressApp = null;
  this.router = null;
  this.routerServer = null;
  this.routerServerPort = 0;
  this.routerServerAddress = ip.address();
  this.routerServerErrorListener = null;
  this.pskIdToSecret = null;

  this.states = this._getInitialStates();

  this._init();
}

inherits(ThaliWifiInfrastructure, EventEmitter);

ThaliWifiInfrastructure.prototype._init = function () {
  var serverOptions = {
    adInterval: thaliConfig.SSDP_ADVERTISEMENT_INTERVAL,
    udn: thaliConfig.SSDP_NT
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

  this._networkChangedHandler = function (networkChangedValue) {
    this._handleNetworkChanges(networkChangedValue);
  }.bind(this);
};

ThaliWifiInfrastructure.prototype._getInitialStates = function () {
  return {
    started: false,
    stopping: false,
    listening: {
      target: false,
      current: false
    },
    advertising: {
      target: false,
      current: false
    },
    networkState: null
  };
};

ThaliWifiInfrastructure.prototype._handleNetworkChanges =
function (networkChangedValue) {
  var self = this;
  // If we are stopping or the wifi state hasn't changed,
  // we are not really interested.
  if (self.states.stopping === true ||
      (self.states.networkState !== null &&
      networkChangedValue.wifi === self.states.networkState.wifi)) {
    return;
  }
  self.states.networkState = networkChangedValue;
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
    // If wifi didn't turn on, it was turned into a state where we want
    // to stop our actions
    actionList = [
      promiseResultSuccessOrFailure(
        self._stopAdvertisingAndListening(false, false)
      ),
      promiseResultSuccessOrFailure(
        self._stopListeningForAdvertisements(false, false)
      )
    ];
  }
  Promise.all(actionList).then(function (results) {
    results.forEach(function (result) {
      if (result) {
        logger.warn('Error when reacting to wifi state changes: %s',
                    result.toString());
      }
    });
  });
};

ThaliWifiInfrastructure.prototype._setLocation = function () {
  var address = this.routerServerAddress;
  var port = this.advertisedPortOverride || this.routerServerPort;
  this._server._location = 'http://' + address + ':' + port;
};

ThaliWifiInfrastructure.prototype._handleMessage = function (data, available) {
  if (this._shouldBeIgnored(data)) {
    return false;
  }

  var usn = data.USN;
  var peer = null;
  try {
    peer = USN.parse(usn);
  } catch (error) {
    logger.warn(error.message);
    return false;
  }

  // We expect location only in alive messages.
  if (available === true) {
    var parsedLocation = url.parse(data.LOCATION);
    var portNumber = parseInt(parsedLocation.port);
    try {
      validations.ensureValidPort(portNumber);
    } catch (error) {
      logger.warn('Failed to parse a valid port number from location: %s',
        data.LOCATION);
      return false;
    }
    peer.hostAddress = parsedLocation.hostname;
    peer.portNumber = portNumber;
  } else {
    peer.hostAddress = peer.portNumber = null;
  }

  logger.debug('Emitting wifiPeerAvailabilityChanged ' + JSON.stringify(peer));
  this.emit('wifiPeerAvailabilityChanged', peer);
  return true;
};

// Function used to filter out SSDP messages that are not
// relevant for Thali.
ThaliWifiInfrastructure.prototype._shouldBeIgnored = function (data) {
  var isUnknownNt = (data.NT !== thaliConfig.SSDP_NT);
  return isUnknownNt || this._isOwnMessage(data);
};

ThaliWifiInfrastructure.prototype._isOwnMessage = function (data) {
  try {
    var peerIdentifier = USN.parse(data.USN).peerIdentifier;
    return (this._ownPeerIdentifiersHistory.indexOf(peerIdentifier) !== -1);
  } catch (err) {
    return false;
  }
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
      logger.warn('Got unexpected Wifi state: %s',
        this.states.networkState.wifi);
      errorMessage = 'Unspecified Error with Radio infrastructure';
    }
  }
  return reject(new Error(errorMessage));
};

ThaliWifiInfrastructure.prototype._updateStatus = function () {
  this.emit('discoveryAdvertisingStateUpdateWifiEvent', {
    discoveryActive: this.states.listening.current,
    advertisingActive: this.states.advertising.current
  });
};

// jscs:disable jsDoc
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
 * @param {module:thaliMobileNativeWrapper~pskIdToSecret} pskIdToSecret
 * @returns {Promise<?Error>}
 */
// jscs:enable jsDoc
ThaliWifiInfrastructure.prototype.start = function (router, pskIdToSecret) {
  var self = this;
  return promiseQueue.enqueue(function (resolve, reject) {
    if (self.states.started === true) {
      return reject(new Error('Call Stop!'));
    }
    self.pskIdToSecret = pskIdToSecret;
    ThaliMobileNativeWrapper.emitter.on('networkChangedNonTCP',
                                          self._networkChangedHandler);
    ThaliMobileNativeWrapper.getNonTCPNetworkStatus()
    .then(function (networkStatus) {
      if (self.states.networkState === null) {
        // Only assign the network state received here if it
        // isn't assigned yet. It could have been already assigned
        // in case a networkChangedNonTCP event was emitted
        // while waiting for getNonTCPNetworkStatus() to be resolved.
        self.states.networkState = networkStatus;
      }
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
    self.states.stopping = true;
    self._stopAdvertisingAndListening(true, true)
    .then(function () {
      return self._stopListeningForAdvertisements(true, true);
    })
    .then(function () {
      self.states = self._getInitialStates();
      ThaliMobileNativeWrapper.emitter.removeListener('networkChangedNonTCP',
        self._networkChangedHandler);
      return resolve();
    })
    .catch(function (error) {
      self.states.stopping = false;
      reject(error);
    });
  });
};

// jscs:disable maximumLineLength
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
// jscs:enable maximumLineLength
ThaliWifiInfrastructure.prototype.startListeningForAdvertisements =
function () {
  var self = this;
  return promiseQueue.enqueue(function (resolve, reject) {
    if (!self.states.started) {
      return reject(new Error('Call Start!'));
    }

    self.states.listening.target = true;

    if (self.states.listening.current) {
      return resolve();
    }
    if (self.states.networkState.wifi === 'on') {
      self._client.start(function () {
        self.states.listening.current = true;
        self._updateStatus();
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
function () {
  return this._stopListeningForAdvertisements(false, true);
};

ThaliWifiInfrastructure.prototype._stopListeningForAdvertisements =
function (skipPromiseQueue, changeTarget) {
  var self = this;
  if (changeTarget) {
    self.states.listening.target = false;
  }
  var action = function (resolve) {
    if (!self.states.listening.current) {
      return resolve();
    }
    self._client.stop(function () {
      self.states.listening.current = false;
      self._updateStatus();
      return resolve();
    });
  };
  if (skipPromiseQueue === true) {
    return new Promise(action);
  } else {
    return promiseQueue.enqueue(action);
  }
};

// jscs:disable maximumLineLength
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
 * changed if they are interested. The way this flag MUST be implemented is by
 * creating a UUID the first time startUpdateAdvertisingAndListening is called
 * and maintaining that UUID until stopAdvertisingAndListening is called. When
 * the UUID is created a generation counter MUST be set to 0. Every subsequent
 * call to startUpdateAdvertisingAndListening until the counter is reset MUST
 * increment the counter by 1. The USN set by a call to
 * startUpdateAdvertisingAndListening MUST be of the form `data:` + uuid.v4() +
 * `:` + generation.
 *
 * By design this method is intended to be called multiple times without
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
// jscs:enable maximumLineLength
ThaliWifiInfrastructure.prototype.startUpdateAdvertisingAndListening =
function () {
  var self = this;
  return promiseQueue.enqueue(function (resolve, reject) {
    if (!self.states.started) {
      return reject(new Error('Call Start!'));
    }
    if (!self.router) {
      return reject(new Error('Bad Router'));
    }

    self.states.advertising.target = true;


    self._updateOwnPeer();

    var usn = USN.stringify(self.peer);

    if (self.states.networkState.wifi !== 'on') {
      return self._rejectPerWifiState(reject);
    }

    if (self.states.advertising.current) {
      // If we were already advertising, we need to restart the server
      // so that a byebye is issued for the old USN and and alive
      // message for the new one.
      self._server.stop(function () {
        self._server.setUSN(usn);
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
        self.routerServerPort = self.routerServer.address().port;
        logger.debug('listening', self.routerServerPort);

        self._server.setUSN(usn);
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
          self._updateStatus();
          return resolve();
        });
      };
      var options = {
        ciphers: thaliConfig.SUPPORTED_PSK_CIPHERS,
        pskCallback: function (id) {
          return self.pskIdToSecret(id);
        },
        key: thaliConfig.BOGUS_KEY_PEM,
        cert: thaliConfig.BOGUS_CERT_PEM
      };
      self.routerServer = https.createServer(options, self.expressApp)
        .listen(self.routerServerPort, listeningHandler);
      self.routerServer = makeIntoCloseAllServer(self.routerServer);
      self.routerServer.on('error', startErrorListener);
    }
  });
};

ThaliWifiInfrastructure.prototype._updateOwnPeer = function () {
  if (!this.peer) {
    this.peer = {
      peerIdentifier: uuid.v4(),
      generation: 0
    };

    // Update own peers history
    var history = this._ownPeerIdentifiersHistory;
    history.push(this.peer.peerIdentifier);
    if (history.length > thaliConfig.SSDP_OWN_PEERS_HISTORY_SIZE) {
      var overflow = history.length - thaliConfig.SSDP_OWN_PEERS_HISTORY_SIZE;
      history.splice(0, overflow);
    }
  } else {
    this.peer.generation++;
  }
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
function () {
  return this._stopAdvertisingAndListening(false, true);
};

ThaliWifiInfrastructure.prototype._stopAdvertisingAndListening =
function (skipPromiseQueue, changeTarget) {
  var self = this;
  if (changeTarget) {
    self.states.advertising.target = false;
  }
  var action = function (resolve) {
    if (!self.states.advertising.current) {
      return resolve();
    }
    self._server.stop(function () {
      self.peer = null;
      self.routerServer.closeAll(function () {
        // The port needs to be reset, because
        // otherwise there is no guarantee that
        // the same port is available next time
        // we start the router server.
        self.routerServerPort = 0;
        self.routerServer.removeListener('error',
                                         self.routerServerErrorListener);
        self.routerServer = null;
        self.states.advertising.current = false;
        self._updateStatus();
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
 * @type {Object}
 * @property {string} peerIdentifier This is the UUID part of the USN value.
 * @property {number} generation This is the generation part of the USN value
 * @property {?string} hostAddress This can be either an IP address or a DNS
 * address encoded as a string
 * @property {?number} portNumber The port on the hostAddress to use to connect
 * to the peer
 */

// jscs:disable maximumLineLength
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
// jscs:enable maximumLineLength

/**
 * [NOT IMPLEMENTED]
 *
 * For the definition of this event please see {@link
 * module:thaliMobileNativeWrapper~networkChangedNonTCP}.
 *
 * The WiFi layer MUST NOT emit this event unless we are running on Linux,
 * macOS or Windows. In the case that we are running on those platforms then If
 * we are running on those platforms then bluetoothLowEnergy and bluetooth MUST
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

ThaliWifiInfrastructure.prototype.getNetworkStatus = function () {
  return ThaliMobileNativeWrapper.getNonTCPNetworkStatus();
};

module.exports = ThaliWifiInfrastructure;
