'use strict';

var assert = require('assert');
var EventEmitter = require('events').EventEmitter;
var inherits = require('util').inherits;
var https = require('https');
var url = require('url');

var Promise = require('bluebird');
var nodessdp = require('node-ssdp');
var ip = require('ip');
var uuid = require('uuid');
var express = require('express');
var validations = require('../validations');
var thaliConfig = require('./thaliConfig');
var logger = require('../ThaliLogger')('thaliWifiInfrastructure');
var makeIntoCloseAllServer = require('./makeIntoCloseAllServer');
var PromiseQueue = require('./promiseQueue');
var USN = require('./utils/usn');
var platform = require('./utils/platform');
var common = require('./utils/common');

var enqueued = common.enqueuedMethod;
var enqueuedAtTop = common.enqueuedAtTopMethod;

var thaliMobileNativeWrapper = require('./thaliMobileNativeWrapper');

var muteRejection = (function () {
  function returnNull () { return null; }
  function returnArg (arg) { return arg; }

  return function muteRejection (promise) {
    return promise.then(returnNull).catch(returnArg);
  };
}());

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
 * @class WifiListener
 */
function WifiListener() {
  EventEmitter.call(this);

  this._promiseQueue = new PromiseQueue();
  this._isListening = false;
  this._filterMessageFn = null;

  this._client = new nodessdp.Client({
    ssdpIp: thaliConfig.SSDP_IP,
    thaliLogger: require('../ThaliLogger')('nodeSSDPClientLogger')
  });

  Promise.promisifyAll(this._client, {
    filter: function (methodName) {
      return methodName === 'start' || methodName === 'stop';
    }
  });

  this._client.on('advertise-alive', function (data) {
    this._handleMessage(data, true);
  }.bind(this));

  this._client.on('advertise-bye', function (data) {
    this._handleMessage(data, false);
  }.bind(this));
}

inherits(WifiListener, EventEmitter);

/**
 * @param {function} filterFn
 */
WifiListener.prototype.setMessageFilter = function (filterFn) {
  if (typeof filterFn !== 'function') {
    throw new Error('Filter is expected to be a function');
  }
  this._filterMessageFn = filterFn;
};

/**
 * Function used to filter out SSDP messages that are not relevant for Thali.
 * @private
 * @param {Object} data SSDP message object
 * @return {boolean}
 */
WifiListener.prototype._shouldBeIgnored = function (data) {
  var isUnknownNt = (data.NT !== thaliConfig.SSDP_NT);
  var isFilteredMessage = this._filterMessageFn ?
    !this._filterMessageFn(data) :
    false;
  return (isUnknownNt || isFilteredMessage);
};

/**
 * @private
 * @param {Object} data
 * @param {boolean} available
 * @return {boolean}
 */
WifiListener.prototype._handleMessage = function (data, available) {
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

  logger.silly('Emitting wifiPeerAvailabilityChanged ' + JSON.stringify(peer));
  this.emit('wifiPeerAvailabilityChanged', peer);
  return true;
};

/**
 * @return {Promise}
 */
WifiListener.prototype.start = enqueued(function () {
  var self = this;

  if (self._isListening) {
    return Promise.resolve();
  }

  return self._client.startAsync()
    .then(function () {
      self._isListening = true;
      self._notifyStateChange();
      if (platform.isAndroid) {
        return thaliMobileNativeWrapper.lockAndroidWifiMulticast();
      }
    })
    .catch(function (error) {
      return self._errorStop(error);
    });
});

/**
 * @return {Promise}
 */
WifiListener.prototype.stop = enqueued(function () {
  var self = this;
  if (!self._isListening) {
    return Promise.resolve();
  }

  return self._client.stopAsync().then(function () {
    self._isListening = false;
    self._notifyStateChange();
    if (platform.isAndroid) {
      return thaliMobileNativeWrapper.unlockAndroidWifiMulticast();
    }
  });
});

/**
 * @return {Promise}
 */
WifiListener.prototype.restartSSDPClient = enqueuedAtTop(function () {
  var self = this;
  if (!self._isListening) {
    return Promise.reject(new Error('Can\'t restart stopped SSDP client'));
  }
  return self._client.stopAsync().then(function () {
    return self._client.startAsync();
  }).catch(function (error) {
    return self._errorStop(error);
  });
});

/**
 * Cleans everything after receiving error
 * @private
 * @param {Error} error Encountered error. Returned promise is rejected with
 * this value
 * @return {Promise<Error>}
 */
WifiListener.prototype._errorStop = function (error) {
  this._isListening = false;
  return this._client.stopAsync().then(function () {
    return thaliMobileNativeWrapper.unlockAndroidWifiMulticast()
      .catch(function () {
        // Ignore native errors during cleanup. We are more interested in the
        // original error
        return null;
      });
  }).then(function () {
    return Promise.reject(error);
  });
};

/**
 * @private
 */
WifiListener.prototype._notifyStateChange = function () {
  this.emit('stateChange', {
    listening: this._isListening
  });
};

/**
 * @return {boolean}
 */
WifiListener.prototype.isListening = function () {
  return this._isListening;
};


/**
 * @class WifiAdvertiser
 */
function WifiAdvertiser () {
  EventEmitter.call(this);

  this._promiseQueue = new PromiseQueue();
  this.peer = null;
  // Store previously used own peerIdentifiers so ssdp client can ignore some
  // delayed ssdp messages after our server has changed uuid part of usn
  this._ownPeerIdentifiersHistory = [];
  // Can be used in tests to override the port
  // advertised in SSDP messages.
  this.advertisedPortOverride = null;
  this.expressApp = null;
  this.routerServer = null;
  this.routerServerPort = 0;
  this.routerServerAddress = ip.address();
  this.routerServerErrorListener = null;
  this.pskIdToSecret = null;

  this._isAdvertising = false;

  this._init();
}

inherits(WifiAdvertiser, EventEmitter);

/**
 * @private
 */
WifiAdvertiser.prototype._init = function () {
  this._server = new nodessdp.Server({
    ssdpIp: thaliConfig.SSDP_IP,
    adInterval: thaliConfig.SSDP_ADVERTISEMENT_INTERVAL,
    udn: thaliConfig.SSDP_NT,
    thaliLogger: require('../ThaliLogger')('nodeSSDPServerLogger')
  });
  Promise.promisifyAll(this._server, {
    filter: function (methodName) {
      return methodName === 'start' || methodName === 'stop';
    }
  });
  this._updateLocation();
};

/**
 * @private
 */
WifiAdvertiser.prototype._updateLocation = function () {
  var address = this.routerServerAddress;
  var port = this.advertisedPortOverride || this.routerServerPort;
  this._server._location = 'http://' + address + ':' + port;
};

/**
 * @private
 */
WifiAdvertiser.prototype._notifyStateChange = function () {
  this.emit('stateChange', {
    advertising: this._isAdvertising,
  });
};

/**
 * @return {boolean}
 */
WifiAdvertiser.prototype.isAdvertising = function () {
  return this._isAdvertising;
};

/**
 * @param {Object} router
 * @param {module:thaliMobileNativeWrapper~pskIdToSecret} pskIdToSecret
 * @return {Promise}
 */
WifiAdvertiser.prototype.start = enqueued(function (router, pskIdToSecret) {
  var self = this;
  if (self._isAdvertising) {
    return Promise.reject(new Error('Call Stop!'));
  }
  self._generateAdvertisingPeer();

  return self._setUpExpressApp(router, pskIdToSecret)
    .then(function () {
      self._server.setUSN(USN.stringify(self.peer));
      return self._server.startAsync();
    })
    .then(function () {
      self._isAdvertising = true;
      self._notifyStateChange();
    })
    .catch(function (error) {
      return self._errorStop(error);
    });
});

/**
 * @return {Promise}
 */
WifiAdvertiser.prototype.update = enqueued(function () {
  var self = this;

  if (!self._isAdvertising) {
    return Promise.reject(new Error('Call Start!'));
  }

  // We need to change USN every time a WifiClient changed generation
  self.peer.generation++;
  self._server.setUSN(USN.stringify(self.peer));

  return Promise.resolve();
});

/**
 * @return {Promise}
 */
WifiAdvertiser.prototype.stop = enqueued(function () {
  var self = this;

  if (!self._isAdvertising) {
    return Promise.resolve();
  }

  return self._server.stopAsync().then(function () {
    return self._destroyExpressApp();
  }).then(function () {
    self.peer = null;
    self._isAdvertising = false;
    self._notifyStateChange();
  });
});

/**
 * @private
 * @param {Error} error
 * @return {Promise}
 */
WifiAdvertiser.prototype._errorStop = function (error) {
  this._isAdvertising = false;
  this.peer = null;
  return Promise.all([
    this._destroyExpressApp(),
    this._server.stopAsync()
  ]).then(function () {
    return Promise.reject(error);
  });
};

/**
 * @return {Promise}
 */
WifiAdvertiser.prototype.restartSSDPServer = enqueuedAtTop(function () {
  var self = this;
  if (!self._isAdvertising) {
    return Promise.reject(new Error('Can\'t restart stopped SSDP server'));
  }
  return self._server.stopAsync().then(function () {
    return self._server.startAsync();
  }).catch(function (error) {
    return self._errorStop(error);
  });
});

/**
 * @private
 * @param {Object} router
 * @param {module:thaliMobileNativeWrapper~pskIdToSecret} pskIdToSecret
 * @return {Promise}
 */
WifiAdvertiser.prototype._setUpExpressApp = function (router, pskIdToSecret) {
  var self = this;
  self.expressApp = express();
  try {
    self.expressApp.use('/', router);
  } catch (error) {
    logger.error('Unable to use the given router: %s', error.toString());
    return Promise.reject(new Error('Bad Router'));
  }

  self.routerServerErrorListener = function (error) {
    // Error is only logged, because it was determined this should
    // not occur in normal use cases and it wasn't worthwhile to
    // specify a custom error that the upper layers should listen to.
    // If this error is seen in real scenario, a proper error handling
    // should be specified and implemented.
    logger.error('Router server emitted an error: %s', error.toString());
  };

  var options = {
    ciphers: thaliConfig.SUPPORTED_PSK_CIPHERS,
    pskCallback: pskIdToSecret,
    key: thaliConfig.BOGUS_KEY_PEM,
    cert: thaliConfig.BOGUS_CERT_PEM
  };

  function listen (server, port) {
    return new Promise(function (resolve, reject) {
      function onError (error) {
        reject(error); cleanup();
      }
      function onListening () {
        resolve(); cleanup();
      }
      function cleanup () {
        server.removeListener('error', onError);
        server.removeListener('listening', onListening);
      }
      server.on('error', onError);
      server.on('listening', onListening);
      server.listen(port);
    });
  }

  self.routerServer = makeIntoCloseAllServer(
    https.createServer(options, self.expressApp)
  );
  return listen(self.routerServer, self.routerServerPort)
    .catch(function (listenError) {
      logger.error(
        'Router server emitted an error: %s',
        listenError.toString()
      );
      self.routerServer = null;
      var error = new Error('Unspecified Error with Radio infrastructure');
      error.causedBy = listenError;
      return Promise.reject(error);
    })
    .then(function () {
      self.routerServerPort = self.routerServer.address().port;
      logger.debug('listening', self.routerServerPort);
      self.routerServer.on('error', self.routerServerErrorListener);
      // We need to update the location string, because the port
      // may have changed when we re-start the router server.
      self._updateLocation();
    });
};

/**
 * @private
 * @return {Promise}
 */
WifiAdvertiser.prototype._destroyExpressApp = function () {
  var self = this;
  var promise;

  if (self.routerServer) {
    promise = self.routerServer.closeAllPromise().then(function () {
      self.routerServer.removeListener('error', self.routerServerErrorListener);
    });
  } else {
    promise = Promise.resolve();
  }

  return promise.then(function () {
    self.expressApp = null;
    self.routerServer = null;
    self.routerServerErrorListener = null;
    // The port needs to be reset, because
    // otherwise there is no guarantee that
    // the same port is available next time
    // we start the router server.
    self.routerServerPort = 0;
  });
};

/**
 * @private
 */
WifiAdvertiser.prototype._generateAdvertisingPeer = function () {
  assert(this.peer === null, 'Peer should not exist');
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
};

/**
 * @return {Object[]}
 */
WifiAdvertiser.prototype.getAdvertisedPeerIdentifiers = function () {
  return this._ownPeerIdentifiersHistory;
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
function ThaliWifiInfrastructure() {
  this._isStarted = false;

  // Represent target states (the state after promise queue is completed)
  this._targetState = {
    started: false,
    advertising: false,
    listening: false
  };
  this._promiseQueue = new PromiseQueue();
  this._lastNetworkStatus = null;

  var advertiser = new WifiAdvertiser();
  var listener = new WifiListener();

  // make listener ignore advertiser's messages
  listener.setMessageFilter(function (data) {
    var ignorePeers = advertiser.getAdvertisedPeerIdentifiers();
    var peer = USN.tryParse(data.USN, null);
    return (peer !== null) && (ignorePeers.indexOf(peer.peerIdentifier) === -1);
  });

  this.advertiser = advertiser;
  this.listener = listener;

  this.peerAvailabilities = {};
  this.peerAvailabilityWatchers = {};

  this._setUpEvents();
}

ThaliWifiInfrastructure.prototype._setUpEvents = function() {
  var self = this;

  // bind networkChanged listener
  this._networkChangedHandler = function (networkChangedValue) {
    this._handleNetworkChanges(networkChangedValue);
  }.bind(this);

  var emitStateUpdate = function () {
    self.emit('discoveryAdvertisingStateUpdateWifiEvent', {
      discoveryActive: self.listener.isListening(),
      advertisingActive: self.advertiser.isAdvertising(),
    });
  };
  self.advertiser.on('stateChange', emitStateUpdate);
  self.listener.on('stateChange', emitStateUpdate);

  self.listener.on('wifiPeerAvailabilityChanged', function (peer) {
    self._hadlePeerAvailabilityWatchers(peer);
    self.emit('wifiPeerAvailabilityChanged', peer);
  });
};

inherits(ThaliWifiInfrastructure, EventEmitter);

ThaliWifiInfrastructure.prototype._handleNetworkChanges =
function (networkStatus) {
  var isWifiChanged = this._lastNetworkStatus ?
    networkStatus.wifi !== this._lastNetworkStatus.wifi :
    true;

  var isBssidChanged = this._lastNetworkStatus ?
    networkStatus.bssidName !== this._lastNetworkStatus.bssidName :
    true;

  this._lastNetworkStatus = networkStatus;

  // If we are stopping or the wifi state hasn't changed,
  // we are not really interested.
  if (!this._targetState.started || (!isWifiChanged && !isBssidChanged)) {
    return;
  }

  var actionResults = [];

  // Handle on -> off and off -> on changes
  if (isWifiChanged) {
    if (networkStatus.wifi === 'on') {
      // If the wifi state turned on, try to get into the target states
      if (this._targetState.listening) {
        actionResults.push(
          muteRejection(this.startListeningForAdvertisements())
        );
      }
      if (this._targetState.advertising) {
        actionResults.push(
          muteRejection(this.startUpdateAdvertisingAndListening())
        );
      }
    } else {
      // If wifi didn't turn on, it was turned into a state where we want
      // to stop our actions
      actionResults.push(
        muteRejection(
          this._pauseAdvertisingAndListening()
        ),
        muteRejection(
          this._pauseListeningForAdvertisements()
        )
      );
    }
  }

  // Handle bssid only changes. We do not care about bssid when wifi was
  // entirely disabled, because node-ssdp server would be restarted anyway
  if (!isWifiChanged && isBssidChanged) {
    // Without restarting node-ssdp server just does not advertise messages and
    // client does not receive them after connecting to another access point
    if (this.advertiser.isAdvertising()) {
      actionResults.push(muteRejection(this.advertiser.restartSSDPServer()));
    }
    if (this.listener.isListening()) {
      actionResults.push(muteRejection(this.listener.restartSSDPClient()));
    }
  }

  Promise.all(actionResults).then(function (results) {
    results.forEach(function (result) {
      if (result) {
        logger.warn('Error when reacting to wifi state changes: %s',
          result.toString());
      }
    });
  });
};

ThaliWifiInfrastructure.prototype._hadlePeerAvailabilityWatchers =
function (peer) {
  if (peer.hostAddress && peer.portNumber) {
    this._addAvailabilityWatcherToPeerIfNotExist(peer);
  } else {
    this._removeAvailabilityWatcherFromPeerIfExists(peer);
  }
};

ThaliWifiInfrastructure.prototype._isAvailabilityWatcherForPeerExist =
function (peer) {
  var peerIdentifier = peer.peerIdentifier;

  return !!(this.peerAvailabilityWatchers &&
  this.peerAvailabilityWatchers[peerIdentifier]);
};


ThaliWifiInfrastructure.prototype._watchForPeerAvailability =
function (peer) {
  var now = Date.now();
  var unavailabilityThreshold =
    thaliConfig.TCP_PEER_UNAVAILABILITY_THRESHOLD;
  var peerIdentifier = peer.peerIdentifier;

  // If the time from the latest availability advertisement doesn't
  // exceed the threshold, no need to do anything.
  if (this.peerAvailabilities[peerIdentifier] + unavailabilityThreshold > now) {
    return;
  }

  this._removeAvailabilityWatcherFromPeerIfExists(peer);
  this.emit('wifiPeerAvailabilityChanged', {
    peerIdentifier: peerIdentifier,
    generation: null,
    portNumber: null,
    hostAddress: null
  });
};


ThaliWifiInfrastructure.prototype._addAvailabilityWatcherToPeerIfNotExist =
function (peer) {
  var self = this;
  var peerIdentifier = peer.peerIdentifier;

  if (this._isAvailabilityWatcherForPeerExist(peer)) {
    this.peerAvailabilities[peerIdentifier] = Date.now();
    return;
  }
    
  var unavailabilityThreshold =
    thaliConfig.TCP_PEER_UNAVAILABILITY_THRESHOLD;

  this.peerAvailabilityWatchers[peerIdentifier] =
    setInterval((self._watchForPeerAvailability).bind(self),
      unavailabilityThreshold, peer);
  this.peerAvailabilities[peerIdentifier] = Date.now();
};

ThaliWifiInfrastructure.prototype._removeAvailabilityWatcherFromPeerIfExists =
function (peer) {
  if (!this._isAvailabilityWatcherForPeerExist(peer)) {
    return;
  }
  var peerIdentifier = peer.peerIdentifier;

  var interval = this.peerAvailabilityWatchers[peerIdentifier];

  clearInterval(interval);
  delete this.peerAvailabilityWatchers[peerIdentifier];
  delete this.peerAvailabilities[peerIdentifier];
};


ThaliWifiInfrastructure.prototype._removeAllAvailabilityWatchersFromPeers =
function() {
  var self = this;
  Object.keys(this.peerAvailabilityWatchers)
    .forEach(function (peerIdentifier) {
      var assumingPeer = {
        peerIdentifier: peerIdentifier
      };

      self._removeAvailabilityWatcherFromPeerIfExists(assumingPeer);
    });
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
 * @param {module:thaliMobileNativeWrapper~pskIdToSecret} pskIdToSecret
 * @returns {Promise<?Error>}
 */
ThaliWifiInfrastructure.prototype.start = function (router, pskIdToSecret) {
  this._targetState.started = true;
  return this._enqueuedStart(router, pskIdToSecret);
};

ThaliWifiInfrastructure.prototype._enqueuedStart =
enqueued(function (router, pskIdToSecret) {
  var self = this;
  thaliMobileNativeWrapper.emitter
    .on('networkChangedNonTCP', self._networkChangedHandler);

  if (self._isStarted) {
    return Promise.reject(new Error('Call Stop!'));
  }

  return thaliMobileNativeWrapper
    .getNonTCPNetworkStatus()
    .then(function (networkStatus) {
      if (!self._lastNetworkStatus) {
        self._lastNetworkStatus = networkStatus;
      }
      self._isStarted = true;
      self._router = router;
      self._pskIdToSecret = pskIdToSecret;
    });
});

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
  this._targetState.started = false;
  this._targetState.advertising = false;
  this._targetState.listening = false;
  return this._enqueuedStop();
};

ThaliWifiInfrastructure.prototype._enqueuedStop = enqueued(function () {
  var self = this;
  thaliMobileNativeWrapper.emitter
    .removeListener('networkChangedNonTCP', self._networkChangedHandler);
  self._lastNetworkStatus = null;

  self._removeAllAvailabilityWatchersFromPeers();

  return Promise.all([
    self.advertiser.stop(),
    self.listener.stop()
  ]).finally(function () {
    self._isStarted = false;
  });
});

/**
 * This will start the local Wi-Fi Infrastructure Mode discovery mechanism
 * (currently SSDP). Calling this method will trigger {@link
 * event:wifiPeerAvailabilityChanged} to fire. This method only causes SSDP
 * queries to be fired and cause us to listen to other service's SSDP:alive and
 * SSDP:byebye messages. It doesn't advertise the service itself.
 *
 * If this method is called on the Android platform then the
 * {@link external:"Mobile('lockAndroidWifiMulticast')".callNative} method
 * MUST be called.
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
  this._targetState.listening = true;
  return this._enqueuedStartListeningForAdvertisements();
};

ThaliWifiInfrastructure.prototype._enqueuedStartListeningForAdvertisements =
enqueued(function () {
  if (!this._isStarted) {
    return Promise.reject(new Error('Call Start!'));
  }
  if (this._lastNetworkStatus && this._lastNetworkStatus.wifi === 'off') {
    return this._rejectPerWifiState();
  }
  return this.listener.start();
});

/**
 * This will stop the local Wi-Fi Infrastructure Mode discovery mechanism
 * (currently SSDP). Calling this method will stop {@link
 * event:wifiPeerAvailabilityChanged} from firing. That is, we will not issue
 * any further SSDP queries nor will we listen for other service's SSDP:alive or
 * SSDP:byebye messages.
 *
 * If this method is called on the Android platform then the {@link
 * external:"Mobile('unlockAndroidWifiMulticast')".callNative} method MUST be
 * called.
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
  this._targetState.listening = false;
  return this._enqueuedStopListeningForAdvertisements();
};

ThaliWifiInfrastructure.prototype._enqueuedStopListeningForAdvertisements =
enqueued(function () {
  return this.listener.stop();
});

ThaliWifiInfrastructure.prototype._pauseListeningForAdvertisements =
  ThaliWifiInfrastructure.prototype._enqueuedStopListeningForAdvertisements;

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
 * Also note that the implementation of SSDP MUST recognize advertisements from
 * its own instance and ignore them. However it is possible to have multiple
 * independent instances of ThaliWiFiInfrastructure on the same device and we
 * MUST process advertisements from other instances of ThaliWifiInfrastructure
 * on the same device.
 *
 * This method will also cause the Express app passed in to be hosted in a HTTP
 * server configured with the device's local IP. In other words, the externally
 * available HTTP server is not actually started and made externally available
 * until this method is called. This is different than {@link
 * module:thaliMobileNative} where the server is started on 127.0.0.1 as soon as
 * {@link module:thaliMobileNativeWrapper.start} is called but isn't made
 * externally available over the non-TCP transport until the equivalent of this
 * method is called. If the device switches access points (e.g. the BSSID
 * changes) or if WiFi is lost then the server will be shut down. It is up to
 * the caller to catch the networkChanged event and to call start advertising
 * again.
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
ThaliWifiInfrastructure.prototype.startUpdateAdvertisingAndListening =
function () {
  this._targetState.advertising = true;
  return this._enqueuedStartUpdateAdvertisingAndListening();
};

ThaliWifiInfrastructure.prototype._enqueuedStartUpdateAdvertisingAndListening =
enqueued(function () {
  if (!this._isStarted) {
    return Promise.reject(new Error('Call Start!'));
  }

  if (this._lastNetworkStatus && this._lastNetworkStatus.wifi === 'off') {
    return this._rejectPerWifiState();
  }

  var advertiser = this.advertiser;
  return advertiser.isAdvertising() ?
    advertiser.update() :
    advertiser.start(this._router, this._pskIdToSecret);
});

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
ThaliWifiInfrastructure.prototype.stopAdvertisingAndListening = function () {
  this._targetState.advertising = false;
  return this._enqueuedStopAdvertisingAndListening();
};

ThaliWifiInfrastructure.prototype._enqueuedStopAdvertisingAndListening =
enqueued(function () {
  return this.advertiser.stop();
});

ThaliWifiInfrastructure.prototype._pauseAdvertisingAndListening =
  ThaliWifiInfrastructure.prototype._enqueuedStopAdvertisingAndListening;


ThaliWifiInfrastructure.prototype._rejectPerWifiState = function () {
  var errorMessage;
  switch (this._lastNetworkStatus.wifi) {
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
        this.states.networkStatus.wifi);
      errorMessage = 'Unspecified Error with Radio infrastructure';
    }
  }
  return Promise.reject(new Error(errorMessage));
};

ThaliWifiInfrastructure.prototype.getNetworkStatus = function () {
  return thaliMobileNativeWrapper.getNonTCPNetworkStatus();
};


// All the methods below are for testing

ThaliWifiInfrastructure.prototype._getCurrentState = function () {
  return {
    started: this._isStarted,
    listening: this.listener.isListening(),
    advertising: this.advertiser.isAdvertising(),
  };
};

ThaliWifiInfrastructure.prototype._getTargetState = function () {
  return {
    started: this._targetState.started,
    listening: this._targetState.listening,
    advertising: this._targetState.advertising,
  };
};

ThaliWifiInfrastructure.prototype._getCurrentPeer = function () {
  return this.advertiser.peer;
};

ThaliWifiInfrastructure.prototype._getSSDPServer = function () {
  return this.advertiser._server;
};

ThaliWifiInfrastructure.prototype._getSSDPClient = function () {
  return this.listener._client;
};

ThaliWifiInfrastructure.prototype._overrideAdvertisedPort = function (port) {
  this.advertiser.advertisedPortOverride = port;
};

ThaliWifiInfrastructure.prototype._restoreAdvertisedPort = function () {
  this.advertiser.advertisedPortOverride = null;
};

ThaliWifiInfrastructure.prototype._getOverridenAdvertisedPort = function () {
  return this.advertiser.advertisedPortOverride;
};

module.exports = ThaliWifiInfrastructure;
