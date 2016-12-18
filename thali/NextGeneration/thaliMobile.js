'use strict';

var EventEmitter = require('events').EventEmitter;
var logger = require('../ThaliLogger')('thaliMobile');
var platform = require('./utils/platform');
var format = require('util').format;
var makeAsync = require('./utils/common').makeAsync;
var thaliConfig = require('./thaliConfig');

var ThaliMobileNativeWrapper = require('./thaliMobileNativeWrapper');
var connectionTypes = ThaliMobileNativeWrapper.connectionTypes;

var ThaliWifiInfrastructure = require('./thaliWifiInfrastructure');
var thaliWifiInfrastructure = new ThaliWifiInfrastructure();
/**
 * for testing purposes
 * @private
 * @returns {module:ThaliWifiInfrastructure~ThaliWifiInfrastructure}
 */
module.exports._getThaliWifiInfrastructure = function () {
  return thaliWifiInfrastructure;
};

var Promise = require('lie');
var PromiseQueue = require('./promiseQueue');
var promiseQueue = new PromiseQueue();

var promiseResultSuccessOrFailure = function (promise) {
  return promise.then(function (success) {
    return success;
  }).catch(function (failure) {
    // This turns the catch into a normal 'then' response so no matter
    // what the promise outputs the result will always be a resolve
    return failure;
  });
};

var getCombinedResult = function (results) {
  return {
    wifiResult: results[0] || null,
    nativeResult: results[1] || null
  };
};

/**
 * Enum to define the network types
 *
 * @readonly
 * @enum {string}
 */
var networkTypes = {
  WIFI: 'WIFI',
  NATIVE: 'NATIVE',
  BOTH: 'BOTH'
};
module.exports.networkTypes = networkTypes;

var getMethodIfExists = function (target, method) {
  if (!target[method]) {
    throw new Error(target + ' has no method named ' +
      method);
  }
  return function () {
    var args = arguments;
    return promiseResultSuccessOrFailure(target[method].apply(target, args));
  };
};

var getWifiOrNativeMethodByNetworkType = function (method, networkType) {
  var wifiMethod;
  var nativeMethod;
  switch (networkType) {
    case networkTypes.BOTH: {
      wifiMethod = getMethodIfExists(thaliWifiInfrastructure, method);
      nativeMethod = getMethodIfExists(ThaliMobileNativeWrapper, method);
      return function () {
        var args = arguments;
        return Promise.all([
          wifiMethod.apply(null, args),
          nativeMethod.apply(null, args)
        ])
          .then(getCombinedResult);
      };
    }
    case networkTypes.WIFI: {
      wifiMethod = getMethodIfExists(thaliWifiInfrastructure, method);
      return function () {
        var args = arguments;
        return wifiMethod.apply(null, args)
          .then(function (wifiResult) {
            return getCombinedResult([wifiResult, null]);
          });
      };
    }
    case networkTypes.NATIVE: {
      nativeMethod = getMethodIfExists(ThaliMobileNativeWrapper, method);
      return function () {
        var args = arguments;
        return nativeMethod.apply(null, args)
          .then(function (nativeResult) {
            return getCombinedResult([null, nativeResult]);
          });
      };
    }
    default: {
      throw new Error('Unsupported network type ' + networkType);
    }
  }
};

var getInitialStates = function () {
  return {
    started: false,
    listening: false,
    advertising: false,
    networkType: networkTypes.BOTH
  };
};

var thaliMobileStates = getInitialStates();

/** @module thaliMobile */

/**
 * @file
 *
 * This is a convenience class to wrap together {@link
 * module:thaliMobileNativeWrapper} and {@link module:ThaliWifiInfrastructure}
 * in order to create a unified interface and set of events. This object assumes
 * that if it is being used then it has exclusive rights to call {@link
 * module:thaliMobileNativeWrapper}, {@link module:thaliMobileNative} and {@link
 * module:ThaliWifiInfrastructure}.
 */

/*
          METHODS
 */

/**
 * This object is our generic status wrapper that lets us return information
 * about both WiFi and Native.
 *
 * @public
 * @typedef {Object} combinedResult
 * @property {?Error} wifiResult
 * @property {?Error} nativeResult
 */

/**
 * This method MUST be called before any other method here other than
 * registering for events on the emitter. This method will call start on both
 * the {@link module:thaliMobileNativeWrapper} singleton and on an instance of
 * {@link module:ThaliWifiInfrastructure} class. Note that in the case of wifi
 * this call really does nothing but register the router object. In the case of
 * native however there is some setup work so an error is more meaningful. If an
 * error is received from start on either wifi or native then any subsequent
 * method calls below but stop will not attempt to interact with the failed
 * type. And yes, if both fail then essentially all the methods but stop turn
 * into NOOPs.
 *
 * This method also instructs the system to pay attention to network events.
 * If one or both radio types is not active but a network changed event
 * indicates that the relevant radio type is now active and if we are still in
 * the start state then this code MUST try to call start on the newly activated
 * radio stack. At that point if the object is in the start state for discovery
 * or advertising then we MUST also try to call the relevant start methods there
 * as well.
 *
 * This method is not idempotent. If called two times in a row without an
 * intervening stop a "Call Stop!" Error MUST be returned.
 *
 * This method can be called after stop since this is a singleton object.
 * @public
 * @param {Object} router This is an Express Router object (for example,
 * express-pouchdb is a router object) that the caller wants non-TCP and WiFi
 * connections to be terminated with. This code will put that router at '/' so
 * make sure your paths are set up appropriately. If stop is called then the
 * system will take down the server so it is no longer available.
 * @param {module:thaliMobileNativeWrapper~pskIdToSecret} pskIdToSecret
 * @param {networkTypes} networkType
 * @returns {Promise<module:thaliMobile~combinedResult>}
 */
module.exports.start = function (router, pskIdToSecret, networkType) {
  return promiseQueue.enqueue(function (resolve, reject) {
    if (thaliMobileStates.started === true) {
      return reject(new Error('Call Stop!'));
    }
    thaliMobileStates.started = true;
    thaliMobileStates.networkType =
      networkType || global.NETWORK_TYPE || thaliMobileStates.networkType;

    getWifiOrNativeMethodByNetworkType('start',
      thaliMobileStates.networkType)(router, pskIdToSecret)
      .then(function (result) {
        if (result.wifiResult === null && result.nativeResult === null) {
          return resolve(result);
        }
        return reject(result);
      });
  });
};

module.exports.isStarted = function () {
  return thaliMobileStates.started;
};

/**
 * This calls stop on both stacks even if start failed.
 *
 * Once called the object is in stop state.
 *
 * This method is idempotent and so MUST be able to be called multiple times
 * in a row without changing state.
 *
 * @public
 * @returns {Promise<module:thaliMobile~combinedResult>}
 */
module.exports.stop = function () {
  return promiseQueue.enqueue(function (resolve) {
    thaliMobileStates = getInitialStates();
    removeAllAvailabilityWatchersFromPeers();

    // clear zombieFilter cache
    if (typeof handleNonTCPPeer.clearCache === 'function') {
      handleNonTCPPeer.clearCache();
    }

    Object.getOwnPropertyNames(connectionTypes)
      .forEach(function (connectionKey) {
        var connectionType = connectionTypes[connectionKey];
        changePeersUnavailable(connectionType);
      });

    getWifiOrNativeMethodByNetworkType('stop', thaliMobileStates.networkType)()
      .then(resolve);
  });
};

/**
 * This method calls the underlying startListeningForAdvertisements
 * functions.
 *
 * Note that once this method is called it is giving explicit permission to this
 * code to call this method on a radio stack that is currently disabled when the
 * method is called but is later re-enabled due to a network changed event. In
 * other words if {@link module:thaliMobile.start} is called and say WiFi
 * doesn't work. Then this method is called and so advertising is only started
 * for the non-TCP transport. Then a network changed event happens indicating
 * that WiFi is available. Since we are still in start state this code will
 * automatically call {@link
 * module:ThaliWifiInfrastructure~ThaliWifiInfrastructure#start} and then will
 * call {@link module:ThaliWifiInfrastructure.startListeningForAdvertisements}
 * because we haven't yet called {@link
 * module:thaliMobile.stopListeningForAdvertisements}. If any of the calls
 * triggered by the network event fail then the results MUST be logged.
 *
 * This method is idempotent so multiple consecutive calls without an
 * intervening call to stop will not cause a state change.
 *
 * This method MUST NOT be called if the object is not in start state or a
 * "Call Start!" error MUST be returned.
 *
 * @public
 * @returns {Promise<module:thaliMobile~combinedResult>}
 */
module.exports.startListeningForAdvertisements = function () {
  return promiseQueue.enqueue(function (resolve, reject) {
    if (thaliMobileStates.started === false) {
      return reject(new Error('Call Start!'));
    }
    thaliMobileStates.listening = true;

    getWifiOrNativeMethodByNetworkType('startListeningForAdvertisements',
       thaliMobileStates.networkType)()
      .then(resolve);
  });
};

/**
 * This method calls the underlying stopListeningForAdvertisements on both
 * types regardless of which is in start state.
 *
 * This method is idempotent and MAY be called even if
 * startListeningForAdvertisements has not been called.
 *
 * @public
 * @returns {Promise<module:thaliMobile~combinedResult>}
 */
module.exports.stopListeningForAdvertisements = function () {
  return promiseQueue.enqueue(function (resolve, reject) {
    thaliMobileStates.listening = false;

    getWifiOrNativeMethodByNetworkType('stopListeningForAdvertisements',
       thaliMobileStates.networkType)()
      .then(resolve)
      .catch(reject);
  });
};

/**
 * This method calls the underlying startUpdateAdvertisingAndListening
 * functions. This method has the same behavior as
 * {@link module:thaliMobile.startListeningForAdvertisements} in that if a radio
 * type that was inactive should later become available and we are in start
 * state then we will try to call start and if that works and
 * stopAdvertisingAndListening has not been called then
 * we will try to call startUpdateAdvertisingAndListening on
 * the newly started stack. This includes the requirement to log any failed
 * attempts to call the various methods triggered by a network status change.
 *
 * Every call to this method is meant to change the current advertising flag
 * to indicate that new data is available.
 *
 * @public
 * @returns {Promise<module:thaliMobile~combinedResult>}
 */
module.exports.startUpdateAdvertisingAndListening = function () {
  return promiseQueue.enqueue(function (resolve, reject) {
    if (thaliMobileStates.started === false) {
      return reject(new Error('Call Start!'));
    }
    thaliMobileStates.advertising = true;

    getWifiOrNativeMethodByNetworkType('startUpdateAdvertisingAndListening',
       thaliMobileStates.networkType)()
      .then(resolve);
  });
};

/**
 * This method calls the underlying
 * stopAdvertisingAndListening on both types regardless of
 * which is in start state.
 *
 * This method is idempotent and MAY be called even if
 * startUpateAdvertisingAndListenForIncomingConnections has not been called.
 *
 * @public
 * @returns {Promise<module:thaliMobile~combinedResult>}
 */
module.exports.stopAdvertisingAndListening = function () {
  return promiseQueue.enqueue(function (resolve) {
    thaliMobileStates.advertising = false;

    var stopAdvertisingAndListening = getWifiOrNativeMethodByNetworkType(
      'stopAdvertisingAndListening',
      thaliMobileStates.networkType
    );
    stopAdvertisingAndListening().then(resolve);
  });
};

/**
 * This method returns the last value sent by
 * {@link module:thaliMobile.event:networkChanged} event.
 *
 * The reason we use a promise is that there is a race condition where someone
 * could call this before we have gotten the first network status event. Rather
 * than force everyone to play the game where they have to subscribe to the
 * event and call this method just to figure out the status for things like UX
 * that says "Hey you don't have the right radio!" we just use a promise that
 * won't return until we have a value.
 *
 * @public
 * @returns {Promise<module:thaliMobileNative~networkChanged>}
 */
module.exports.getNetworkStatus = function () {
  var networkType = thaliMobileStates.networkType;
  return promiseQueue.enqueue(function (resolve, reject) {
    switch (networkType) {
      case networkTypes.NATIVE:
      case networkTypes.BOTH: {
        ThaliMobileNativeWrapper.getNonTCPNetworkStatus()
          .then(resolve)
          .catch(reject);
        break;
      }
      case networkTypes.WIFI: {
        thaliWifiInfrastructure.getNetworkStatus()
          .then(resolve)
          .catch(reject);
        break;
      }
      default: {
        reject(new Error('Unable to execute getNetworkStatus with ' +
          'network type ' + networkType));
      }
    }
  });
};

/**
 * @public
 * @typedef peerHostInfo
 * @property {string} hostAddress The IP/DNS address to connect to or null if
 * this is an announcement that the peer is no longer available.
 * @property {number} portNumber The port to connect to on the given
 * hostAddress or null if this is an announcement that the peer is no longer
 * available.
 * @property {number} suggestedTCPTimeout Provides a hint to what time out to
 * put on the TCP connection. For some transports a handshake can take quite a
 * long time.
 */

var PeerHostInfo = function (peer) {
  this.hostAddress = peer.hostAddress;
  this.portNumber = peer.portNumber;
  this.suggestedTCPTimeout = peer.suggestedTCPTimeout;
};

var getPeerHostInfoStrategies = (function () {
  var LOCALHOST = '127.0.0.1';

  function getBluetoothAddressPortInfo(peer) {
    var portInfo = new PeerHostInfo({
      hostAddress: LOCALHOST,
      portNumber: peer.portNumber,
      suggestedTCPTimeout: thaliConfig.TCP_TIMEOUT_BLUETOOTH
    });
    return Promise.resolve(portInfo);
  }

  function getMPCFAddressPortInfo(peer) {
    return ThaliMobileNativeWrapper
      ._multiConnect(peer.peerIdentifier)
      .then(function (portNumber) {
        var portInfo = new PeerHostInfo({
          hostAddress: LOCALHOST,
          portNumber: portNumber,
          suggestedTCPTimeout: thaliConfig.TCP_TIMEOUT_MPCF
        });
        return portInfo;
      });
  }

  function getWifiAddressPortInfo(peer) {
    var portInfo = new PeerHostInfo({
      hostAddress: peer.hostAddress,
      portNumber: peer.portNumber,
      suggestedTCPTimeout: thaliConfig.TCP_TIMEOUT_WIFI
    });
    return Promise.resolve(portInfo);
  }

  var getPeerHostInfoStrategies = {};
  getPeerHostInfoStrategies[connectionTypes.BLUETOOTH] =
    getBluetoothAddressPortInfo;
  getPeerHostInfoStrategies[connectionTypes.MULTI_PEER_CONNECTIVITY_FRAMEWORK] =
    getMPCFAddressPortInfo;
  getPeerHostInfoStrategies[connectionTypes.TCP_NATIVE] =
    getWifiAddressPortInfo;
  return getPeerHostInfoStrategies;
})();

/**
 * If the peer identifier and connection type is not in the availability cache
 * (see the peerAvailabilityChanged tome below) then a 'peer not available'
 * error MUST be returned.
 *
 * Since this function is asynchronous it is possible that between the time it
 * is called and when it is ready to return that a peer not available event
 * could have occurred. It is explicitly NOT this function's problem to deal
 * with his eventuality. Once it starts going the function MUST complete as
 * given below without regard for any unavailability events.
 *
 * If an error is returned from this function other than 'peer not available'
 * then it is up to the caller to decide if they wish to call the method again
 * but doing so MUST NOT cause any harm to the system's state.
 *
 * The sections below all assume that the requested peer is in the peer
 * availability cache.
 *
 * ## Android
 *
 * We MUST return a peerHostInfo object with the hostAddress set to
 * 127.0.0.1 and portNumber set to the values in the availability cache.
 * suggestedTCPTimeout MUST be set per thaliConfig.
 *
 * ## iOS
 *
 * We MUST call {@link
 * module:thaliMobileNativeWrapper~ThaliMobileNativeWrapper._multiConnect}. If
 * we receive an error then we MUST forward the error as the response to this
 * method. If we receive a port then the hostAddress MUST be 127.0.0.1, the
 * portNumber MUST be set to the returned port and the suggestedTCPTimeout MUST
 * be set as given in thaliConfig.
 *
 * ## WiFi
 *
 * We MUST return a peerHostInfo object with the hostAddress and portNumber
 * set based on the values in the availability cache and the suggestedTCPTimeout
 * set per thaliConfig.
 *
 * @public
 * @param {string} peerIdentifier This is exclusively used to detect if
 * this is a repeat announcement or if a peer has gone to correlate it to the
 * announcement of the peer's presence. But this value is not used to establish
 * a connection to the peer, the hostAddress and portNumber handle that.
 * @param {module:ThaliMobileNativeWrapper~connectionTypes} connectionType
 * Defines the kind of connection that the request will eventually go over. This
 * information is needed so that we can better manage how we use the different
 * transport types available to us.
 * @returns {Promise<peerHostInfo | Error>}
 */
module.exports.getPeerHostInfo = function(peerIdentifier, connectionType) {
  var peersByConnectionType = peerAvailabilities[connectionType];
  if (!peersByConnectionType) {
    return Promise.reject(new Error('Unsupported connection type ' +
      connectionType));
  }

  var peer = peersByConnectionType[peerIdentifier];
  if (!peer) {
    return Promise.reject(new Error('peer not available'));
  }

  var getPeerHostInfo = getPeerHostInfoStrategies[connectionType];
  if (!getPeerHostInfo) {
    return Promise.reject(new Error('getPeerHostInfo is not implemented for ' + connectionType));
  }

  return getPeerHostInfo(peer);
};

/**
 * Requests that the outgoing session with the identifier peerIdentifier on the
 * specified connectionType be terminated.
 *
 * On Android and iOS this calls down to disconnect on thaliMobileNativeWrapper.
 * For Wifi this method MUST return a 'Wifi does not support disconnect' error.
 *
 * This method requires port number assigned to the peer (this port is returned
 * from `getPeerHostInfo` method) to prevent possible race conditions...
 *
 * @public
 * @param {string} peerIdentifier Value from peerAvailabilityChanged event.
 * @param {module:ThaliMobileNativeWrapper~connectionTypes} connectionType
 * @param {number} portNumber
 * @returns {Promise<?Error>}
 */
module.exports.disconnect =
  function (peerIdentifier, connectionType, portNumber) {
    if (connectionType === connectionTypes.TCP_NATIVE) {
      return Promise.reject(new Error('Wifi does not support disconnect'));
    }
    return promiseQueue.enqueue(function (resolve, reject) {
      return ThaliMobileNativeWrapper
        .disconnect(peerIdentifier, portNumber)
        .then(resolve, reject);
    });
  };

/*
        EVENTS
 */

/**
 * It is the job of this module to provide the most reliable guesses (and that
 * is what they are) as to when a peer is and is not available. The module MUST
 * err on the side of saying that a peer is available over saying they are not
 * available.
 *
 * The module MUST guarantee to its listeners (unlike {@link
 * module:thaliMobileNative}) that once it has fired a peerAvailabilityChanged
 * event for a specific peerIdentifier + connectionType combination that it will
 * not fire another peerAvailabilityChanged event for that peerIdentifier +
 * connectionType combination unless the combination has a new hostAddress,
 * portNumber or generation. The newAddressPort boolean on the
 * peerAvailabilityChanged event will flag when a peer moves its address or
 * port.
 *
 * Note that this code explicitly does not do any kind of duplicate detection
 * for the same peerIdentifier across different connectionTypes. This is because
 * we want to surface to the caller all the ways a particular peer is available.
 *
 * This means that if this code receives multiple redundant notifications from
 * the various sources it is listening to about the same peerIdentifier and
 * connectionType combination then it must silently discard the duplicates.
 *
 * ## Peer availability cache
 *
 * The code is based on a model where we have a cache we use to track which
 * peers are currently available and we use that cache to store additional
 * information. The details for different transports are given below.
 *
 * It is assumed that peers in the availability cache are indexed by a
 * combination of their peer identifier (but not their generation) as well as
 * their connection type. So if in the Android section we say a peer is in the
 * availability cache we mean an entry with the same peer identifier and the
 * Android connection type.
 *
 * The availability cache MUST make sure that its size is not allowed to grow
 * without bound. Each connection type MUST have its own limit. Generally
 * speaking the limit should be generous enough that under any circumstance but
 * a direct DOS attack we shouldn't violate that limit. Therefore if adding a
 * peer would cause the limit to be violated then we MUST ignore the peer and
 * fire a discoveryDOS event and leave it to whomever is listening to that event
 * to respond appropriately.
 *
 * ## Android + BLE + Bluetooth
 *
 * ### Handling nonTCPPeerAvailabilityChanged events
 *
 * In this section we will walk through different possible scenarios when we
 * receive a nonTCPPeerAvailabilityChanged event in Android
 *
 * #### peerAvailable === true
 *
 * If the peer is not in the availability cache then we MUST put the peer's
 * identifier, generation, portNumber and the current milliseconds since the
 * epoch into the availability cache and issue a peerAvailabilityChanged event
 * with the given peerIdentifier and connectionType, peerAvailable set to true,
 * generation set as in the nonTCPPeerAvailabilityChanged event and
 * newAddressPort set to false.
 *
 * If the peer is in the availability cache then we MUST compare the generation
 * and portNumber in the event against the same values in the availability
 * cache. If either value is different then we will issue a new
 * peerAvailabilityChanged event as given below. If the generation values are
 * the same but the time that has elapsed since the availability entry was
 * recorded is >= thaliConfig.minimumUpdateWindow * 255 (which is the minimum
 * time it would take for the 1 byte Android beacon to wrap around) then we MUST
 * treat the generation is if it had changed.
 *
 * If we are to issue a new peerAvailabilityChanged event per the previous
 * paragraph then we MUST update the availability cache with the new portNumber
 * (if any) and the new generation. If this was a case where the two generation
 * numbers actually matched but we decided to update because of the time check
 * then we MUST update the time in the availability cache to the current time in
 * milliseconds since the last epoch. The issued peerAvailabilityChanged event
 * MUST have its peerIdentifier, connectionType and generation set as per the
 * new event. It MUST set peerAvailable to true. If the portNumber in the event
 * was different than the value in the availability cache then newAddressPort
 * MUST be set to true.
 *
 * #### peerAvailable === false
 *
 * If we get a peerAvailable === false event then we MUST check the peer
 * availability cache and if the peer is listed then we MUST remove the peer
 * from the cache and issue a peerAvailabilityChanged event with the given
 * peerIdentifier and connectionType but with the peerAvailable set to false
 * and generation and newAddressPort set to null.
 *
 * If we get a peerAvailable === false event for a peer that is not in the peer
 * availability cache then we MUST ignore the event.
 *
 * ### Heuristics for marking peers as not available
 *
 * The heuristics for tracking peers in the native layer is based just on
 * seeing if we have discovered them recently. It doesn't take into account
 * what happens if we tried to connect to the peer and the connection fails. So
 * for that we need our own heuristics.
 *
 * To do this when we get a successful response to a getPeerHostInfo call for
 * an Android peer we MUST record in the availability cache the fact that there
 * is an active session with that peer. In addition if there is a timer running
 * (see below) then we MUST cancel that timer.
 *
 * If we receive a peerAvailable === true event and if there is no open session
 * recorded in the availability cache for that peer then we MUST create a timer
 * that will go off after thaliConfig.WAIT_UNTIL_ANDROID_PEER_GONE_MS.
 *
 * If we receive a failedConnection event from createPeerListener for a peer who
 * is in the availability cache then we MUST mark the peer's session as closed
 * in the availability cache and set the timer to go off after
 * thaliConfig.WAIT_UNTIL_ANDROID_PEER_GONE_MS.
 *
 * If the timer goes off and if the peer is still in the availability cache
 * (which is should be since there isn't another way to pull a peer out of the
 * cache) then the peer MUST be removed the availability cache and a
 * peerAvailabilityChanged event with the given peerIdentifier and
 * connectionType but with peerAvailable set to false and generation and
 * newAddressPort set to null.
 *
 * ### Handling networkChanged events
 *
 * If we have been notified via a networkChanged event that either BLE or
 * Bluetooth is no longer available then we MUST remove all peers discovered via
 * BLE from the availability cache and send peerAvailabilityChanged events
 * reporting this status change. In theory we could make things more complex by
 * specifying that if BLE is turned off and Bluetooth isn't then we could
 * continue to say that the Bluetooth peers are there. But in practical terms it
 * isn't clear if this situation is possible (e.g. I suspect one can only turn
 * off Bluetooth, not sub-select between BLE and Bluetooth) and second it's more
 * complexity than we really need at this point.
 *
 * ### Handling discoveryAdvertisingStatus events
 *
 * If we have been notified via a discoveryAdvertisingStatus event that
 * discovery is no longer available then we MUST treat existing discovered
 * Bluetooth peers as no longer being available, remove them from the
 * availability cache and send peerAvailabilityChanged events reporting this
 * fact. Eventually we might get more flexible here and allow Bluetooth peers to
 * remain "available" and just use the connection heuristics described
 * previously to mark them as absent when necessary. But for now let's keep
 * things simple.
 *
 * If we have been notified via a discoveryAdvertisingStatus event that
 * advertising is no longer available this should not cause any change in our
 * information about peers we have discovered or will yet discover.
 *
 * ## iOS + MPCF
 *
 * ### Handling nonTCPPeerAvailabilityChanged events
 *
 * In this section we will walk through different possible scenarios when we
 * receive a nonTCPPeerAvailabilityChanged event in iOS.
 *
 * Note that portNumber isn't set in nonTCPPeerAvailabilityChanged events in
 * iOS.
 *
 * #### peerAvailable === true
 *
 * If the peer is not in the availability cache then we MUST put the peer's
 * identifier and generation into the availability cache and issue a
 * peerAvailabilityChanged event with the given peerIdentifier and
 * connectionType, peerAvailable set to true, generation set as in the
 * nonTCPPeerAvailabilityChanged event and newAddressPort set to false.
 *
 * If the peer is in the availability cache then we MUST compare the generation
 * in the event against the same value in the availability cache. If the
 * generation in the nonTCPPeerAvailabilityChanged event is equal to or less
 * than the generation in the availability cache then the event MUST be ignored.
 * If the generation in the event is greater than the value in the availability
 * cache then we MUST issue a peerAvailabilityChanged event with the
 * peerIdentifier and generation set as per the nonTCPPeerAvailabilityChanged
 * event. The connectionType set to MPCF. peerAvailable set to true and
 * newAddressPort set to false.
 *
 * #### peerAvailable === false
 *
 * If the peer is not in the availability cache (this shouldn't be possible,
 * because in iOS we should only be removing peers when we get an unavailable
 * event) then the nonTCPPeerAvailabilityChanged event MUST be ignored.
 *
 * If the peer is in the availability cache then we MUST remove the peer from
 * the availability cache and issue a peerAvailabilityChanged event with the
 * given peerIdentifier and connectionType but with peerAvailable set to false
 * and generation and newAddressPort set to null.
 *
 * __Open Issue:__ How does MPCF deal with peers who have gone out of range?
 * Do they regularly send foundPeer messages or do they send one foundPeer
 * message and go quiet until they send a lostPeer message after a bit?
 *
 * __Open Issue:__ How reliable is the lostPeer message from MPCF? I believe
 * we have had a suspicion that even if we get a lostPeer we might still be able
 * to open a connection to that peer successfully (this would make sense if
 * discovery is over Bluetooth and data transfer over Wifi). But we need to now
 * make this concrete since we have to decide if we are going to put this
 * suspicion into our code.
 *
 * ### Handling multiConnectConnectionFailure events
 *
 * If the peer identified in the event is not in the availability cache (which
 * is theoretically possible given certain race conditions) then we MUST ignore
 * this event.
 *
 * If the peer is in the availability cache then we MUST issue a
 * peerAvailabilityChanged event with the peerIdentifier and connectionType
 * defined as given, peerAvailable set to true, generation set as in the cache
 * and newAddressPort set to true.
 *
 * Note that automatically issuing a newAddressPort = true
 * peerAvailabilityChanged event can cause fun race conditions where we could
 * get ready to advertise a newAddressPort = true event but first a real
 * peerAvailability = false event could come up from the native layer. This
 * would trick the upper layers into thinking the peer is available when they
 * are not. But in that case the call to getPeerHostInfo would fail because the
 * peer wouldn't be in the available cache anymore.
 *
 * ### Handling networkChanged events
 *
 * If we have been notified via a networkChanged event that one of Bluetooth or
 * Wifi are no longer available but not both then this should not cause any
 * immediate action since MPCF seems able to run exclusively over one transport
 * or the other.
 *
 * If however we have been notified via a networkChanged even that both
 * Bluetooth and Wifi are no longer available then we MUST mark all peers that
 * we have previously advertised as available as now being unavailable and
 * advertise this change via the peerAvailabilityChanged event.
 *
 * ### Handling discoveryAdvertisingStatus events
 *
 * If we have been notified via a discoveryAdvertisingStatus event that
 * discovery is no longer available then we MUST change the availability of
 * peers discovered via MPCF as not available and advertise this fact via
 * peerAvailabilityChanged.
 *
 * __Open Issue:__ The MPCF explicitly states that one shouldn't keep discovery
 * on all the time. One suspects this is because they are using Bluetooth for
 * discovery. As such as may need to cycle discovery on and off to save battery.
 * In that case we will need to change the logic above so that turning off
 * discovery doesn't make the peer appear to be gone.
 *
 * If we have been notified via a discoveryAdvertisingStatus even that
 * advertising is no longer available then this should not cause any change in
 * our peer status.
 *
 * ## Wifi
 *
 * ### Handling wifiPeerAvailabilityChanged
 *
 * #### hostAddress & portNumber !== null
 *
 * If the peer is not in the availability cache then we MUST put the peer's
 * identifier, generation, hostAddress and portNumber into the cache and
 * generate a peerAvailabilityChanged event with the given peerIdentifier and
 * connectionType, peerAvailable set to true, generation set as in the
 * wifiPeerAvailabilityChanged event and newAddressPort set to false.
 *
 * If the peer is in the availability cache then we MUST compare the generation,
 * hostAddress and portNumber. If only the generation has changed and if the
 * generation is <= to the generation in the availability cache then the
 * wifiPeerAvailabilityChanged event MUST be ignored. If the generation in the
 * event is greater than the value in the cache and/or either hostAddress or
 * portNumber in the event are different than the cache then a new
 * peerAvailabilityChanged event MUST be issued as defined below.
 *
 * The new peerAvailabilityChanged event as required in the previous paragraph
 * will have the peerIdentifier and generation set based on the values in the
 * wifiPeerAvailabilityChanged event. connectionType will be set to wifi.
 * peerAvailable will be set to true. If either the hostAddress or portNumber
 * in the wifiPeerAvailabilityChanged event is different than either of those
 * values in the availability cache then newAddressPort MUST be set to true.
 * The availability cache MUST also be updated with the generation, hostAddress
 * and portNumber from the wifiPeerAvailabilityChanged event.
 *
 * #### hostAddress or portNumber !== null
 *
 * Note that if either is null both MUST be null but we should trigger this
 * behavior if either is null.
 *
 * If the peer is not in the availability cache (which can happen thanks to our
 * heuristics) then we MUST ignore the wifiPeerAvailabilityChanged event.
 *
 * If the peer is in our cache then we MUST remove the peer from the
 * availability cache and issue a peerAvailabilityChanged event with the given
 * peerIdentifier and connectionType but with peerAvailable set to false and
 * generation and newAddressPort set to null.
 *
 * #### Peer availability timer
 *
 * Although SSDP supports an explicit 'byebye' message to indicate that the
 * network stack is shutting down we are not guaranteed to get a 'byebye'
 * message as the device might simple go out of range.
 *
 * To handle this we will create a timer but it's behavior is different than the
 * Android timer because we can get the equivalent of peerAvailable === false
 * and we do not have any way (since we aren't going to introduce a TCP proxy
 * just for this) to track if the sessions between the local peer and the remote
 * peer are still running.
 *
 * When we get a hostAddress or portNumber !== null and if the peer is not in
 * the availability cache then as part of putting it into the cache we MUST set
 * a timer to go off after thaliConfig.WAIT_UNTIL_WIFI_PEER_GONE_MS. Any time we
 * get another hostAddress or portNumber !== null for a peer that is in the
 * availability cache we MUST restart its timer.
 *
 * If we receive a hostAddress or portNumber === null for a peer who is in the
 * availability cache then we MUST disable the timer along with the other
 * behavior specified previously for this event.
 *
 * If the timer goes off then we MUST remove the associated peer from the
 * availability cache and we MUST issue a peerAvailabilityChanged event with the
 * given peerIdentifier and connectionType but with peerAvailable set to false
 * and generation and newAddressPort set to null.
 *
 * Note that having the timer go off could theoretically mean we announce a peer
 * who we are in the middle of talking to as being gone but this is highly
 * unlikely. The SSDP announcements go over the same channel as the TCP
 * connections and SSDP is quite chatty.
 *
 * ### Handling networkChanged events
 *
 * If we have been notified via a networkChanged event that Wifi is no longer
 * available then all peers discovered via Wifi MUST be marked as not present
 * and this fact advertised via peerAvailabilityChanged as previously specified.
 *
 * ### Handling discoveryAdvertisingStatus events
 *
 * If we have been notified via a discoveryAdvertisingStatus event that
 * discovery is no longer available then we MUST change the availability of
 * peers discovered via Wifi to not available and advertise this fact via
 * peerAvailabilityChanged. This is a bit harsh since if Wifi is still working
 * we certainly could connect to those peers but once discovery is off we have
 * no way of knowing if the peer has disappeared and since we don't have a proxy
 * architecture we can't detect failed connections. So it's just easier for now
 * to just treat the peers as gone.
 *
 * If we have been notified via a discoveryAdvertisingStatus event that
 * advertising is no longer available then this should not cause any change in
 * our peer status.
 *
 * @public
 * @event module:thaliMobile.event:peerAvailabilityChanged
 * @typedef {Object} peerAvailabilityStatus
 * @property {string} peerIdentifier This is exclusively used to detect if
 * this is a repeat announcement or if a peer has gone to correlate it to the
 * announcement of the peer's presence. But this value is not used to establish
 * a connection to the peer, the hostAddress and portNumber handle that.
 * @property {module:ThaliMobileNativeWrapper~connectionTypes} connectionType
 * Defines the kind of connection that the request will eventually go over. This
 * information is needed so that we can better manage how we use the different
 * transport types available to us.
 * @property {boolean} peerAvailable
 * @property {?number} generation This value is only relevant if peerAvailable
 * is set to true. This identifies the current generation for the peer. This
 * indicates that the state of the associated peer has changed. In general one
 * can use the differences in generation count to tell how many changes have
 * occurred to the peer but note that Android currently rolls over its counter
 * which is only 1 byte long. Also note that we have Zombie problems with
 * Android where it is possible to get notification for the same generation
 * multiple times (although not in a row, e.g. we can get generation 0, 1 and
 * then 0 but not generation 0 and then another generation 0) and it is possible
 * to get generations out of order (e.g. get generation 2 before generation 1).
 * @property {?boolean} newAddressPort This value is only relevant if
 * peerAvailable is set to true. If set to true then this announcement means
 * that the peer has changed either its address or port and any existing
 * sessions SHOULD be terminated and a new call to {@link getPeerHostInfo}
 * SHOULD be made to find the new address/port.
 */


var PeerAvailabilityStatus = function (peer) {
  this.peerIdentifier = peer.peerIdentifier;
  this.connectionType = peer.connectionType;
  this.peerAvailable = Boolean(peer.peerAvailable);
  if (this.peerAvailable) {
    this.generation = peer.generation;
    this.newAddressPort = peer.newAddressPort;
  } else {
    this.generation = null;
    this.newAddressPort = null;
  }
};

var emitPeerUnavailable = function (peerIdentifier, connectionType) {
  var unavailable = new PeerAvailabilityStatus({
    peerIdentifier: peerIdentifier,
    connectionType: connectionType
  });
  logger.debug('Emitting peerAvailabilityChanged from emitPeerUnavailable %s',
    JSON.stringify(unavailable));
  module.exports.emitter.emit('peerAvailabilityChanged', unavailable);
};

// TODO: move peer availability cache to the separate module
var peerAvailabilities = {};
peerAvailabilities[connectionTypes.MULTI_PEER_CONNECTIVITY_FRAMEWORK] = {};
peerAvailabilities[connectionTypes.BLUETOOTH] = {};
peerAvailabilities[connectionTypes.TCP_NATIVE] = {};

/**
 * for testing purposes
 * TODO: leave only one way to access peer availabilities
 * @private
 * @return {Object}
 */
module.exports._getPeerAvailabilities = function () {
  return peerAvailabilities;
};

module.exports._peerAvailabilities = peerAvailabilities;

var peersDiff = function (oldState, newState) {
  var samePeer =
    oldState.peerIdentifier === newState.peerIdentifier &&
    oldState.connectionType === newState.connectionType;

  if (!samePeer) {
    throw new Error('Cannot compare state of different peers');
  }
  return {
    peerIdentifier: oldState.peerIdentifier,
    connectionType: oldState.connectionType,
    peerAvailable: newState.peerAvailable !== oldState.peerAvailable,
    generation: newState.generation - oldState.generation,
    hostAddress: newState.hostAddress !== oldState.hostAddress,
    portNumber: newState.portNumber !== oldState.portNumber,
    availableSince: newState.availableSince - oldState.availableSince
  };
};

var handlePeer = function (peer) {
  var cachedPeer = peerAvailabilities[peer.connectionType][peer.peerIdentifier];

  if (!cachedPeer && !peer.peerAvailable) {
    return;
  }

  var diff = null;
  if (cachedPeer) {
    // check diff and ignore event if necessary
    diff = peersDiff(cachedPeer, peer);
    var ignoreChanges = !diff.peerAvailable && !diff.hostAddress &&
                          !diff.portNumber;

    if (platform.isAndroid) {
      var isWrapAroundElapsed =
        diff.availableSince >= thaliConfig.UPDATE_WINDOWS_FOREGROUND_MS * 255;
      ignoreChanges = ignoreChanges &&
        (diff.generation === 0 && !isWrapAroundElapsed);
    } else {
      ignoreChanges = ignoreChanges && diff.generation <= 0;
    }

    if (ignoreChanges) {
      cachedPeer.availableSince = peer.availableSince;
      return;
    }
  }

  if (peer.peerAvailable) {
    changeCachedPeerAvailable(peer);
  } else {
    changeCachedPeerUnavailable(peer);
  }

  var newAddressPort = peer.peerAvailable ?
    Boolean(diff && (diff.portNumber || diff.hostAddress)) :
    null;

  var peerStatus = {
    peerIdentifier: peer.peerIdentifier,
    connectionType: peer.connectionType,
    peerAvailable: peer.peerAvailable,
    generation: peer.generation,
    newAddressPort: newAddressPort
  };

  logger.debug('Emitting peerAvailabilityChanged from handlePeer %s',
    JSON.stringify(peerStatus));
  module.exports.emitter.emit('peerAvailabilityChanged', peerStatus);
};

var handleRecreatedPeer = function (nativePeer) {
  var cachedPeer =
    peerAvailabilities[connectionTypes.BLUETOOTH][nativePeer.peerIdentifier];

  if (cachedPeer) {
    var peerStatus = {
      peerIdentifier: nativePeer.peerIdentifier,
      connectionType: connectionTypes.BLUETOOTH,
      peerAvailable: nativePeer.peerAvailable,
      generation: nativePeer.generation,
      newAddressPort: nativePeer.peerAvailable ? false : null
    };
    if (nativePeer.peerAvailable) {
      var peerToCache = JSON.parse(JSON.stringify(cachedPeer));
      peerToCache.portNumber = nativePeer.portNumber;
      changeCachedPeerAvailable(peerToCache);
    }
    logger.debug('Emitting peerAvailabilityChanged from handleRecreatedPeer %s',
      JSON.stringify(peerStatus));
    module.exports.emitter.emit('peerAvailabilityChanged', peerStatus);
  } else {
    if (nativePeer.peerAvailable) {
      ThaliMobileNativeWrapper
        .disconnect(nativePeer.peerIdentifier, nativePeer.portNumber)
        .catch(function (err) {
          logger.error('Try to clean up a recreated server for an' +
            'unavailable peer %s and got error %s', nativePeer.peerIdentifier,
            err);
        });
    }
  }
};

var handleNonTCPPeer = makeAsync(function (nativePeer) {
  if (!thaliMobileStates.started) {
    return;
  }
  if (nativePeer.recreated) {
    handleRecreatedPeer(nativePeer);
    return;
  }

  var connectionType =
    platform.isAndroid ?
    connectionTypes.BLUETOOTH :
    connectionTypes.MULTI_PEER_CONNECTIVITY_FRAMEWORK;

  var peer = {
    peerIdentifier: nativePeer.peerIdentifier,
    peerAvailable: nativePeer.peerAvailable,
    generation: nativePeer.generation,
    hostAddress: null,
    portNumber: nativePeer.portNumber,
    connectionType: connectionType,
    availableSince: Date.now(),
    recreated: Boolean(nativePeer.recreated) // Android only
  };
  handlePeer(peer);
});

var handleWifiPeer = makeAsync(function (wifiPeer) {
  if (!thaliMobileStates.started) {
    return;
  }
  var peerAvailable = Boolean(wifiPeer.hostAddress && wifiPeer.portNumber);
  var peer = {
    peerIdentifier: wifiPeer.peerIdentifier,
    peerAvailable: peerAvailable,
    generation: wifiPeer.generation,
    hostAddress: wifiPeer.hostAddress,
    portNumber: wifiPeer.portNumber,
    connectionType: connectionTypes.TCP_NATIVE,
    availableSince: Date.now(),
    recreated: false
  };
  handlePeer(peer);
});

if (platform.isAndroid) {
  handleNonTCPPeer = require('./utils/zombieFilter')(handleNonTCPPeer, {
    zombieThreshold: 500,
    maxDelay: 1000,
  });
}

ThaliMobileNativeWrapper.emitter.on(
  'nonTCPPeerAvailabilityChangedEvent',
  handleNonTCPPeer
);
thaliWifiInfrastructure.on(
  'wifiPeerAvailabilityChanged',
  handleWifiPeer
);

// TODO: move watchers to the separate module
var peerAvailabilityWatchers = {};
peerAvailabilityWatchers[connectionTypes.MULTI_PEER_CONNECTIVITY_FRAMEWORK] =
  {};
peerAvailabilityWatchers[connectionTypes.BLUETOOTH] = {};
peerAvailabilityWatchers[connectionTypes.TCP_NATIVE] = {};

module.exports._peerAvailabilityWatchers = peerAvailabilityWatchers;

var isAvailabilityWatcherForPeerExist = function (peer) {
  var connectionType = peer.connectionType;
  var peerIdentifier = peer.peerIdentifier;
  var peerAvailabilityWatchersByConnectionType =
    peerAvailabilityWatchers[connectionType];

  return !!(peerAvailabilityWatchersByConnectionType &&
  peerAvailabilityWatchersByConnectionType[peerIdentifier]);
};

var watchForPeerAvailability = function (peer) {
  var peerIdentifier = peer.peerIdentifier;
  var connectionType = peer.connectionType;

  var now = Date.now();
  var unavailabilityThreshold =
    connectionType === connectionTypes.TCP_NATIVE ?
      thaliConfig.TCP_PEER_UNAVAILABILITY_THRESHOLD :
      thaliConfig.NON_TCP_PEER_UNAVAILABILITY_THRESHOLD;

  // If the time from the latest availability advertisement doesn't
  // exceed the threshold, no need to do anything.
  if (peer.availableSince + unavailabilityThreshold > now) {
    return;
  }

  changeCachedPeerUnavailable(peer);
  emitPeerUnavailable(peerIdentifier, connectionType);
};

var addAvailabilityWatcherToPeerIfNotExist = function (peer) {
  if (isAvailabilityWatcherForPeerExist(peer)) {
    return;
  }

  var connectionType = peer.connectionType;
  var peerIdentifier = peer.peerIdentifier;
  var unavailabilityThreshold =
    connectionType === connectionTypes.TCP_NATIVE ?
    thaliConfig.TCP_PEER_UNAVAILABILITY_THRESHOLD :
    thaliConfig.NON_TCP_PEER_UNAVAILABILITY_THRESHOLD;

  // No reason to check peer availability
  // more then once per unavailability threshold
  peerAvailabilityWatchers[connectionType][peerIdentifier] =
    setInterval(watchForPeerAvailability, unavailabilityThreshold, peer);
};

var removeAvailabilityWatcherFromPeerIfExists = function (peer) {
  if (!isAvailabilityWatcherForPeerExist(peer)) {
    return;
  }

  var connectionType = peer.connectionType;
  var peerIdentifier = peer.peerIdentifier;

  var interval = peerAvailabilityWatchers[connectionType][peerIdentifier];

  clearInterval(interval);
  delete peerAvailabilityWatchers[connectionType][peerIdentifier];
};

var removeAllAvailabilityWatchersFromPeersByConnectionType =
  function (connectionType) {
    var peersByConnectionType = peerAvailabilityWatchers[connectionType];

    Object.keys(peersByConnectionType)
      .forEach(function (peerIdentifier) {
        var assumingPeer = {
          peerIdentifier: peerIdentifier,
          connectionType: connectionType
        };

        removeAvailabilityWatcherFromPeerIfExists(assumingPeer);
      });
  };

var removeAllAvailabilityWatchersFromPeers = function () {
  Object.keys(peerAvailabilityWatchers)
    .forEach(removeAllAvailabilityWatchersFromPeersByConnectionType);
};

var changeCachedPeerUnavailable = function (peer) {
  removeAvailabilityWatcherFromPeerIfExists(peer);
  delete peerAvailabilities[peer.connectionType][peer.peerIdentifier];
};

var changeCachedPeerAvailable = function (peer) {
  var cachedPeer = JSON.parse(JSON.stringify(peer));
  peerAvailabilities[peer.connectionType][peer.peerIdentifier] = cachedPeer;
  addAvailabilityWatcherToPeerIfNotExist(cachedPeer);
};

var changePeersUnavailable = function (connectionType) {
  Object.keys(peerAvailabilities[connectionType]).forEach(
    function (peerIdentifier) {
      var peer = peerAvailabilities[connectionType][peerIdentifier];
      changeCachedPeerUnavailable(peer);
      emitPeerUnavailable(peerIdentifier, connectionType);
    });
};

/**
 * Fired whenever our state changes.
 *
 * @public
 * @typedef {Object} discoveryAdvertisingStatus
 * @property {boolean} discoveryActive If true indicates that our goal is to
 * have discovery active on all available radios.
 * @property {boolean} advertisingActive If true indicates that our goal is to
 * have advertising active on all available radios.
 * @property {boolean} nonTCPDiscoveryActive Indicates if discovery is active
 * on the non-TCP transport
 * @property {boolean} nonTCPAdvertisingActive Indicates if advertising is
 * active on the non-TCP transport
 * @property {boolean} wifiDiscoveryActive Indicates if discovery is active on
 * WiFi
 * @property {boolean} wifiAdvertisingActive Indicates if advertising is
 * active on WiFi
 */

var discoveryAdvertisingState = {
  nonTCPDiscoveryActive: false,
  nonTCPAdvertisingActive: false,
  wifiDiscoveryActive: false,
  wifiAdvertisingActive: false
};

var getDiscoveryAdvertisingState = function () {
  var state = JSON.parse(JSON.stringify(discoveryAdvertisingState));
  state.discoveryActive = thaliMobileStates.listening;
  state.advertisingActive = thaliMobileStates.advertising;
  return state;
};

var verifyDiscoveryAdvertisingState = function (state) {
  var listening = thaliMobileStates.listening;
  var advertising = thaliMobileStates.advertising;
  if (listening !== state.discoveryActive ||
      advertising !== state.advertisingActive) {
    logger.info(format(
      'Received state (%j) did not match with target (%j)',
      state,
      thaliMobileStates
    ));
  }
};

var emittedDiscoveryAdvertisingStateUpdate = {};

var emitDiscoveryAdvertisingStateUpdate = function () {
  if (!thaliMobileStates.started) {
    logger.info(
      'Filtered out discoveryAdvertisingStateUpdate (was in stopped state).'
    );
    return;
  }
  var equalsWithCurrentState = function (state) {
    for (var key in discoveryAdvertisingState) {
      if (discoveryAdvertisingState[key] !== state[key]) {
        return false;
      }
    }
    return true;
  };
  if (equalsWithCurrentState(emittedDiscoveryAdvertisingStateUpdate)) {
    return;
  }
  emittedDiscoveryAdvertisingStateUpdate = getDiscoveryAdvertisingState();
  module.exports.emitter.emit('discoveryAdvertisingStateUpdate',
    emittedDiscoveryAdvertisingStateUpdate);
};

/**
 * If we receive a {@link
 * module:thaliMobileNativeWrapper~discoveryAdvertisingStateUpdateNonTCPEvent}
 * there are a couple of possibilities:
 * - This just confirms whatever command we fired, we started advertising and
 * it is confirming that. We should only pass on this event the first time it
 * comes through. If we get multiple events with the same state and they all
 * match our current state then they should be suppressed.
 * - We thought something was started but now we are getting a notice that it
 * is stopped.
 * - We thought something was stopped but now we are getting a notice that
 * they are started. This can happen because our network change event code
 * detected that a radio that was off is now on and we are trying to start
 * things.
 *
 * If we receive a {@link
 * module:ThaliWifiInfrastructure~discoveryAdvertisingStateUpdateWiFiEvent} then
 * the logic is effectively the same as above.
 *
 * A scary edge case is that we want discovery or advertising off and suddenly
 * the spontaneously turn on. This shouldn't happen (famous last words) so we'll
 * ignore it for the moment.
 *
 * @public
 * @event module:thaliMobile.event:discoveryAdvertisingStateUpdate
 * @type {Object}
 * @property {module:thaliMobile~discoveryAdvertisingStatus}
 * discoveryAdvertisingStatus
 */


ThaliMobileNativeWrapper.emitter.on(
  'discoveryAdvertisingStateUpdateNonTCP',
  function (newState) {
    discoveryAdvertisingState.nonTCPDiscoveryActive =
      newState.discoveryActive;
    discoveryAdvertisingState.nonTCPAdvertisingActive =
      newState.advertisingActive;
    verifyDiscoveryAdvertisingState(newState);
    emitDiscoveryAdvertisingStateUpdate();
  }
);

thaliWifiInfrastructure.on(
  'discoveryAdvertisingStateUpdateWifiEvent',
  function (newState) {
    discoveryAdvertisingState.wifiDiscoveryActive =
      newState.discoveryActive;
    discoveryAdvertisingState.wifiAdvertisingActive =
      newState.advertisingActive;
    verifyDiscoveryAdvertisingState(newState);
    emitDiscoveryAdvertisingStateUpdate();
  }
);

var handleNetworkChanged = function (networkChangedValue) {
  if (networkChangedValue.wifi === 'off') {
    // If Wifi is off, we mark Wifi peers unavailable.
    changePeersUnavailable(connectionTypes.TCP_NATIVE);
    if (networkChangedValue.bluetooth === 'off') {
      // If Wifi and bluetooth is off, we know we can't talk to peers over
      // over MPCF so marking them unavailable.
      changePeersUnavailable(connectionTypes.MULTI_PEER_CONNECTIVITY_FRAMEWORK);
    }
  }
  if (networkChangedValue.bluetooth === 'off' &&
      networkChangedValue.bluetoothLowEnergy === 'off') {
    // If both Bluetooth and BLE are off, we mark Android peers unavailable.
    changePeersUnavailable(connectionTypes.BLUETOOTH);
  }
  var radioEnabled = false;
  Object.keys(networkChangedValue).forEach(function (key) {
    if (networkChangedValue[key] === 'on') {
      radioEnabled = true;
    }
  });
  if (!radioEnabled) {
    return;
  }
  // At least some radio was enabled so try to start
  // whatever can be potentially started.
  promiseResultSuccessOrFailure(module.exports.start())
  .then(function () {
    var checkErrors = function (operation, combinedResult) {
      Object.keys(combinedResult).forEach(function (resultType) {
        if (combinedResult[resultType] !== null) {
          logger.info('Failed operation %s with error: ' +
                      combinedResult[resultType], operation);
        }
      });
    };
    if (thaliMobileStates.listening) {
      module.exports.startListeningForAdvertisements()
      .then(function (combinedResult) {
        checkErrors('startListeningForAdvertisements', combinedResult);
      });
    }
    if (thaliMobileStates.advertising) {
      module.exports.startUpdateAdvertisingAndListening()
      .then(function (combinedResult) {
        checkErrors('startUpdateAdvertisingAndListening', combinedResult);
      });
    }
  });
};

var handleNetworkChangedNonTCP = function (networkChangedValue) {
  if (!thaliMobileStates.started) {
    logger.info(
      'Filtered out networkChangedNonTCP (was in stopped state).'
    );
    return;
  }

  handleNetworkChanged(networkChangedValue);
  module.exports.emitter.emit('networkChanged', networkChangedValue);
};

var handleNetworkChangedWifi = function (networkChangedValue) {
  logger.warn('networkChangedWifi should not be fired because it is not implemented');
  handleNetworkChangedNonTCP(networkChangedValue);
};

/**
 * Unless something went horribly wrong only one of thaliMobileNativeWrapper
 * or ThaliWifiInfrastructure should be enabled for this event at a time. We can
 * just pass the event value alone.
 *
 * @public
 * @event module:thaliMobile.event:networkChanged
 * @type {Object}
 * @property {module:thaliMobileNative~networkChanged} networkChangedValue
 */

ThaliMobileNativeWrapper.emitter
  .on('networkChangedNonTCP', handleNetworkChangedNonTCP);
thaliWifiInfrastructure
  .on('networkChangedWifi', handleNetworkChangedWifi);

/**
 * Fired when we get more peer discoveries than we have allocated space to
 * store. This is pretty much guaranteed to be an attack so we expect whomever
 * is listening to this event to shut everything down but it's up to them. We do
 * expect that the response to a discoveryDOS event will be immediate so we
 * aren't going to try and rate limit how many times we fire this event as the
 * system should be shut down before more than a few can fire.
 *
 * @public
 * @event module:thaliMobile.event:discoveryDOS
 * @type {Object}
 */

/**
 * Use this emitter to subscribe to events
 *
 * @public
 * @fires module:thaliMobile.event:peerAvailabilityChanged
 * @fires module:thaliMobile.event:discoveryAdvertisingStateUpdate
 * @fires module:thaliMobile.event:networkChanged
 * @fires module:thaliMobile.event:discoveryDOS
 */
module.exports.emitter = new EventEmitter();
