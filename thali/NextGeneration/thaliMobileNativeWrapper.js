'use strict';

var Promise = require('lie');
var PromiseQueue = require('./promiseQueue');
var EventEmitter = require('events').EventEmitter;
var logger = require('../ThaliLogger')('thaliMobileNativeWrapper');
var makeIntoCloseAllServer = require('./makeIntoCloseAllServer');
var express = require('express');
var TCPServersManager = require('./mux/thaliTcpServersManager');
var https = require('https');
var thaliConfig = require('./thaliConfig');
var platform = require('./utils/platform');

var states = {
  started: false
};

var targetStates = {
  started: false,
  advertising: false,
  listening: false
};

// We have to keep track of discovered peers to make sure
// 'listenerRecreatedAfterFailureHandler' event uses the same generation after
// connection was recreated
var peerGenerations = {};

var gPromiseQueue = new PromiseQueue();
var gRouterExpress = null;
var gRouterServer = null;
var gRouterServerPort = 0;
var gServersManager = null;
var gServersManagerLocalPort = 0;
var gNonTcpNetworkStatus = null;

// Exports below only used for testing.
module.exports._getServersManagerLocalPort = function () {
  return gServersManagerLocalPort;
};

module.exports._getRouterServerPort = function () {
  return gRouterServerPort;
};

module.exports._getServersManager = function () {
  return gServersManager;
};

module.exports._setServersManager = function (serversManager) {
  gServersManager = serversManager;
};

module.exports._isStarted = function () {
  return states.started;
};

module.exports._getPromiseQueue = function () {
  return gPromiseQueue;
};

// Turns off a warning that would otherwise go off on Mobile
/* jshint -W064 */

/** @module thaliMobileNativeWrapper */

/**
 * @file
 * This is the primary interface for those wishing to talk directly to the
 * native layer. All the methods defined in this file are asynchronous.
 * However, with the exception of {@link
 * module:thaliMobileNativeWrapper.emitter}, {@link
 * module:thaliMobileNativeWrapper.connect}, {@link
 * module:thaliMobileNativeWrapper.multiConnect} and {@link
 * module:thaliMObileNativeWrapper.disconnect), any time a method is called
 * the invocation will immediately return but the request will actually be put
 * on a queue and all incoming requests will be run out of that queue. This
 * means that if one calls two start methods on say advertising or discovery
 * then the first start method will execute, call back its promise and only
 * then will the second start method start running. This restriction is in
 * place to simplify the state model and reduce testing.
 *
 * A similar sort of queue exists for the connect/disconnect methods but it
 * only applies to calls with the same peerID.
 *
 * ## Why not just call {@link module:thaliMobileNative} directly?
 *
 * Our contract in {@link module:thaliMobileNative} stipulates some behaviors
 * that have to be enforced at the node.js layer. For example, we can only
 * issue a single outstanding non-connect/multi-connect/disconnect
 * Mobile().callNative command at a time. We also want to change the callbacks
 * from callbacks to promises as well as change registerToNative calls into
 * Node.js events. All of that is handled here. So as a general rule nobody
 * but this module should ever call {@link module:thaliMobileNative}. Anyone
 * who wants to use the {@link module:thaliMobileNative} functionality should
 * be calling this module.
 */

/**
 * Enum to define the types of connections
 *
 * @readonly
 * @enum {string}
 */
var connectionTypes = {
  MULTI_PEER_CONNECTIVITY_FRAMEWORK: 'MPCF',
  BLUETOOTH: 'AndroidBluetooth',
  TCP_NATIVE: 'tcp'
};
module.exports.connectionTypes = connectionTypes;

/*
        METHODS
 */

function failedConnectionHandler(failedConnection) {
  var peer = {
    peerIdentifier: failedConnection.peerIdentifier,
    peerAvailable: false,
    generation: failedConnection.generation,
    portNumber: null,
    recreated: failedConnection.recreated
  };
  handlePeerAvailabilityChanged(peer);

  var event = {
    error: failedConnection.error,
    peerIdentifier: failedConnection.peerIdentifier,
    recreated: failedConnection.recreated,
    connectionType: connectionTypes.BLUETOOTH
  };
  module.exports.emitter.emit('failedNativeConnection', event);
}

function routerPortConnectionFailedHandler(failedRouterPort) {
  logger.info('routerPortConnectionFailed - ' +
    JSON.stringify(failedRouterPort));

  if (!states.started) {
    // We are stopped anyway so no reason to kick up a fuss
    logger.info('got routerPortConnectionFailed while we were not in start');
    return;
  }

  if (failedRouterPort.routerPort !== gRouterServerPort) {
    // Some kind of race condition? This isn't for us
    logger.info('got routerPortConnectionFailed but not for our port, ' +
      ', our port is ' + gRouterServerPort + ' and the error was for ' +
      failedRouterPort.routerPort);
    return;
  }

  gPromiseQueue.enqueueAtTop(stop())
    .catch(function (err) {
      return err;
    })
    .then(function (err) {
      var errorArray = [failedRouterPort.error];
      if (err) {
        errorArray.push(err);
      }
      module.exports.emitter.emit('incomingConnectionToPortNumberFailed',
        {
          reason: module.exports.routerFailureReason.APP_LISTENER,
          errors: errorArray,
          routerPort: failedRouterPort.routerPort
        });
    });
}

function listenerRecreatedAfterFailureHandler(recreateAnnouncement) {
  if (!states.started) {
    // We aren't supposed to emit events when we aren't started
    return;
  }

  var generation = peerGenerations[recreateAnnouncement.peerIdentifier];

  logger.debug('listenerRecreatedAfterFailureHandler - We are emitting ' +
    'nonTCPPeerAvailabilityChangedEvent with peerIdentifier %s, ' +
    'generation %s, and portNumber %d',
    recreateAnnouncement.peerIdentifier, generation,
    recreateAnnouncement.portNumber);
  module.exports.emitter.emit('nonTCPPeerAvailabilityChangedEvent', {
    peerIdentifier: recreateAnnouncement.peerIdentifier,
    peerAvailable: true,
    generation: generation,
    portNumber: recreateAnnouncement.portNumber,
    recreated: true
  });
}

function stopServersManager() {
  if (!gServersManager) {
    return Promise.resolve();
  }
  var oldServersManager = gServersManager;
  gServersManager = null;
  return oldServersManager.stop()
    .then(function () {
      oldServersManager.removeListener('failedConnection',
        failedConnectionHandler);
      oldServersManager.removeListener('routerPortConnectionFailed',
        routerPortConnectionFailedHandler);
      oldServersManager.removeListener('listenerRecreatedAfterFailure',
        listenerRecreatedAfterFailureHandler);
    });
}

function stopCreateAndStartServersManager() {
  return stopServersManager()
    .then(function () {
      gServersManager = new TCPServersManager(gRouterServerPort);
      gServersManager.on('failedConnection', failedConnectionHandler);
      gServersManager.on('routerPortConnectionFailed',
        routerPortConnectionFailedHandler);
      gServersManager.on('listenerRecreatedAfterFailure',
        listenerRecreatedAfterFailureHandler);
      return gServersManager.start();
    })
    .then(function (localPort) {
      gServersManagerLocalPort = localPort;
    });
}

/**
 * Takes a PSK ID as input and returns either null if the ID is not supported or
 * a Buffer with the pre-shared secret associated with that identity if it
 * is supported.
 *
 * @public
 * @callback pskIdToSecret
 * @param {string} id
 * @returns {?Buffer} secret
 */

// jscs:disable jsDoc
/**
 * This method MUST be called before any other method here other than
 * registering for events on the emitter or calling {@link
 * module:thaliMobileNativeWrapper:getNonTCPNetworkStatus}. This method will
 * cause us to:
 *
 * - create a TCP server (which MUST use {@link
 * module:makeIntoCloseAllServer~makeIntoCloseAllServer}) on a random port and
 * host the router on that server.
 *
 * On `multiConnect` platforms (read: iOS) we will also do the following:
 *
 * - listen for the {@link
 * thaliMobileNative~incomingConnectionToPortNumberFailed} callback which will
 * then cause us to fire a {@link event:incomingConnectionToPortNumberFailed}.
 *
 * - listen for the {@link thaliMobileNative~multiConnectResolved} callback
 * which will then cause us to fire a {@link event:multiConnectResolvedEvent}.
 * Note however that this event is only consumed within thaliMobileNativeWrapper
 * and is not intended for external use.
 *
 * On `connect` platforms (read: Android) we will also do the following:
 *
 * - create a {@link module:tcpServersManager}.
 *
 * - listen for the {@link
 * module:tcpServersManager~failedConnection} event and then repeat it.
 *
 * - listen for the {@link module:tcpServersManager~routerPortConnectionFailed}
 * event which will then cause us to fire a {@link
 * event:incomingConnectionToPortNumberFailed}. *
 *
 * - call start on the {@link
 * module:tcpServersManager} object and record the returned port.
 *
 * We MUST register for the native layer handlers exactly once.
 *
 * If the start fails then the object is not in start state and vice versa.
 *
 * This method is not idempotent. If called two times in a row without an
 * intervening stop a "Call Stop!" Error MUST be returned.
 *
 * This method can be called after stop since this is a singleton object.
 *
 * If the given router can't be used as an express router, a "Bad Router"
 * error MUST be returned.
 *
 * @public
 * @param {Object} router This is an Express Router object (for example,
 * express-pouchdb is a router object) that the caller wants the non-TCP
 * connections to be terminated with. This code will put that router at '/' so
 * make sure your paths are set up appropriately.
 * @param {pskIdToSecret} pskIdToSecret
 * @returns {Promise<?Error>}
 */
// jscs:enable jsDoc
module.exports.start = function (router, pskIdToSecret) {
  targetStates.started = true;
  return gPromiseQueue.enqueue(function (resolve, reject) {
    if (states.started) {
      return reject(new Error('Call Stop!'));
    }
    gRouterExpress = express();
    try {
      gRouterExpress.use('/', router);
    } catch (error) {
      logger.error('Unable to use the given router: %s', error.toString());
      return reject(new Error('Bad Router'));
    }
    var options = {
      ciphers: thaliConfig.SUPPORTED_PSK_CIPHERS,
      pskCallback : function (id) {
        return pskIdToSecret(id);
      },
      key: thaliConfig.BOGUS_KEY_PEM,
      cert: thaliConfig.BOGUS_CERT_PEM
    };
    // listen(port, ...) port = 0 for random port
    gRouterServer = https.createServer(options, gRouterExpress).listen(0,
      function () {
        gRouterServerPort = gRouterServer.address().port;
        logger.debug('listening', gRouterServerPort);

        stopCreateAndStartServersManager()
          .then(function () {
            states.started = true;
            resolve();
          })
          .catch(function (err) {
            reject(err);
          });
      });
    gRouterServer = makeIntoCloseAllServer(gRouterServer);
  });
};

function stop() {
  return function (resolve, reject) {
    if (!states.started) {
      return resolve();
    }

    states.started = false;

    var errorDescriptions = {};

    Mobile('stopAdvertisingAndListening').callNative(function (error) {
      if (error) {
        errorDescriptions.stopAdvertisingError = new Error(error);
      }
      Mobile('stopListeningForAdvertisements').callNative(function (error) {
        if (error) {
          errorDescriptions.stopListeningError = new Error(error);
        }
        stopServersManager()
          .catch(function (err) {
            errorDescriptions.stopServersManagerError = err;
          })
          .then(function () {
            var oldRouterServer = gRouterServer;
            gRouterServer = null;
            return oldRouterServer ? oldRouterServer.closeAllPromise() :
              Promise.resolve();
          })
          .catch(function (err) {
            errorDescriptions.stopRouterServerError = err;
          })
          .then(function () {
            if (Object.getOwnPropertyNames(errorDescriptions).length === 0) {
              return resolve();
            }

            var error = new Error('check errorDescriptions property');
            error.errorDescriptions = errorDescriptions;

            return reject(error);
          });
      });
    });
  };
}

/**
 * This method will call all the stop methods, call stop on the {@link
 * module:tcpServersManager} object (if we are on a `connect` platform) and
 * close the TCP server hosting the router.
 *
 * Once called the object is in stop state.
 *
 * This method is idempotent and so MUST be able to be called multiple times in
 * a row without changing state.
 *
 * @returns {Promise<?Error>}
 */
module.exports.stop = function () {
  targetStates.started = false;
  targetStates.listening = false;
  targetStates.advertising = false;
  return gPromiseQueue.enqueue(stop());
};

/* eslint-disable max-len */
/**
 * This method instructs the native layer to discover what other devices are
 * within range using the platform's non-TCP P2P capabilities. When a device is
 * discovered its information will be published via {@link
 * event:nonTCPPeerAvailabilityChangedEvent}.
 *
 * This method is idempotent so multiple consecutive calls without an
 * intervening call to stop will not cause a state change.
 *
 * This method MUST NOT be called if the object is not in start state or a "Call
 * Start!" error MUST be returned.
 *
 * | Error String | Description |
 * |--------------|-------------|
 * | No Native Non-TCP Support | There are no non-TCP radios on this platform. |
 * | Radio Turned Off | The radio(s) needed for this method are not turned on. |
 * | Unspecified Error with Radio infrastructure | Something went wrong with the radios. Check the logs. |
 * | Call Start! | The object is not in start state. |
 *
 * @public
 * @returns {Promise<?Error>}
 * @throws {Error}
 */
module.exports.startListeningForAdvertisements = function () {
/* eslint-enable max-len */
  targetStates.listening = true;
  return gPromiseQueue.enqueue(function (resolve, reject) {
    if (!states.started) {
      return reject(new Error('Call Start!'));
    }
    Mobile('startListeningForAdvertisements').callNative(function (error) {
      if (error) {
        return reject(new Error(error));
      }
      resolve();
    });
  });
};

/**
 * This method instructs the native layer to stop listening for discovery
 * advertisements. Note that so long as discovery isn't occurring (because, for
 * example, the radio needed isn't on) this method will return success.
 *
 * This method is idempotent and MAY be called even if
 * startListeningForAdvertisements has not been called.
 *
 * This method MUST NOT terminate any existing connections created locally using
 * {@link module:thaliMobileNativeWrapper.connect}.
 *
 * | Error String | Description |
 * |--------------|-------------|
 * | Failed | Somehow the stop method couldn't do its job. Check the logs. |
 *
 * @public
 * @returns {Promise<?Error>}
 */
module.exports.stopListeningForAdvertisements = function () {
  targetStates.listening = false;
  return gPromiseQueue.enqueue(function (resolve, reject) {
    Mobile('stopListeningForAdvertisements').callNative(function (error) {
      if (error) {
        return reject(new Error(error));
      }
      peerGenerations = {};
      resolve();
    });
  });
};

/* eslint-disable max-len */
/**
 * This method has two separate but related functions. It's first function is to
 * begin advertising the Thali peer's presence to other peers. The second
 * purpose is to accept incoming non-TCP/IP connections (that will then be
 * bridged to TCP/IP) from other peers.
 *
 * In Android these functions can be separated but with iOS the multi-peer
 * connectivity framework is designed such that it is only possible for remote
 * peers to connect to the current peer if and only if the current peer is
 * advertising its presence. So we therefore have put the two functions together
 * into a single method.
 *
 * This method MUST NOT be called unless in the start state otherwise a "Call
 * Start!" error MUST be returned.
 *
 * ## Discovery
 *
 * Thali currently handles discovery by announcing over the discovery channel
 * that the Thali peer has had a state change without providing any additional
 * information, such as who the peer is or who the state changes are relevant
 * to. The remote peers, when they get the state change notification, will have
 * to connect to this peer in order to retrieve information about the state
 * change.
 *
 * Therefore the purpose of this method is just to raise the "state changed"
 * flag. Each time it is called a new event will be generated that will tell
 * listeners that the system has changed state since the last call. This
 * usually translates to a change in the peer's generation counter. Therefore
 * this method is not idempotent since each call causes a state change.
 *
 * Once an advertisement is sent out as a result of calling this method
 * typically any new peers who come in range will be able to retrieve the
 * existing advertisement. So this is not a one time event but rather more of a
 * case of publishing an ongoing advertisement regarding the peer's state.
 *
 * ## Incoming Connections
 *
 * On `connect` platforms all incoming TCP connections generated by {@link
 * external:"Mobile('startUpdateAdvertisingAndListening')".callNative} MUST be
 * passed through a multiplex layer. The details of how this layer works are
 * given in {@link module:TCPServersManager}. This method will pass the port
 * from {@link module:TCPServersManager.start} output to {@link
 * external:"Mobile('startUpdateAdvertisingAndListening')".callNative}.
 *
 * If the TCP connection established by the native layer to the previously
 * specified port is terminated by the server for any reason then the native
 * layer MUST tear down the associated non-TCP connection.
 *
 * On `multiConnect` platforms all incoming TCP connections are sent directly to
 * the router started by {@link module:thaliMobileNativeWrapper.start} since we
 * have no need for {@link module:TCPServersManager} on these platforms.
 *
 * ## Repeated calls
 *
 * By design this method is intended to be called multiple times without calling
 * stop as each call causes the currently notification flag to change.
 *
 * | Error String | Description |
 * |--------------|-------------|
 * | No Native Non-TCP Support | There are no non-TCP radios on this platform. |
 * | Radio Turned Off | The radio(s) needed for this method are not turned on. |
 * | Unspecified Error with Radio infrastructure | Something went wrong with the radios. Check the logs. |
 * | Call Start! | The object is not in start state. |
 *
 * @public
 * @returns {Promise<?Error>}
 */
/* eslint-enable max-len */
module.exports.startUpdateAdvertisingAndListening = function () {
  targetStates.advertising = true;
  return gPromiseQueue.enqueue(function (resolve, reject) {
    if (!states.started) {
      return reject(new Error('Call Start!'));
    }
    Mobile('startUpdateAdvertisingAndListening').callNative(
      gServersManagerLocalPort,
      function (error) {
        if (error) {
          return reject(new Error(error));
        }
        resolve();
      }
    );
  });
};

/**
 * This method tells the native layer to stop advertising the presence of the
 * peer, stop accepting incoming connections over the non-TCP/IP transport and
 * to disconnect all existing non-TCP/IP transport incoming connections.
 *
 * Note that so long as advertising has stopped and there are no incoming
 * connections or the ability to accept them then this method will return
 * success. So, for example, if advertising was never started then this method
 * will return success.
 *
 * | Error String | Description |
 * |--------------|-------------|
 * | Failed | Somehow the stop method couldn't do its job. Check the logs. |
 *
 * @public
 * @returns {Promise<?Error>}
 */
module.exports.stopAdvertisingAndListening = function () {
  targetStates.advertising = false;
  return gPromiseQueue.enqueue(function (resolve, reject) {
    Mobile('stopAdvertisingAndListening').callNative(function (error) {
      if (error) {
        return reject(new Error(error));
      }
      resolve();
    });
  });
};

/**
 * This method returns the last value sent by the
 * {@link module:thaliMobileNativeWrapper.event:networkChangedNonTCP}
 * event.
 *
 * The reason we use a promise is that there is a race condition where someone
 * could call this before we have gotten the first network status event. Rather
 * than force everyone to play the game where they have to subscribe to the
 * event and call this method just to figure out the status for things like UX
 * that says "Hey you don't have the right radio!" we just use a promise that
 * won't return until we have a value.
 *
 * Unlike other methods, this can be called also before calling start.
 *
 * @public
 * @returns {Promise<module:thaliMobileNative~networkChanged>}
 */
module.exports.getNonTCPNetworkStatus = function () {
  return gPromiseQueue.enqueue(function (resolve) {
    if (gNonTcpNetworkStatus === null) {
      module.exports.emitter.once('networkChangedNonTCP',
      function (networkChangedValue) {
        gNonTcpNetworkStatus = networkChangedValue;
        return resolve(gNonTcpNetworkStatus);
      });
    } else {
      return resolve(gNonTcpNetworkStatus);
    }
  });
};

/**
 * This calls the native multiConnect method. This code is responsible for
 * honoring the restrictions placed on calls to multiConnect. Which is that
 * there cannot be more than one call waiting for an async response to
 * multiConnect or disconnect for the same peerIdentifier at any one time.
 * If we receive multiple calls for the same peerIdentifier then we must
 * queue them up in the same way we queue up requests to calls like
 * startListeningForAdvertisements.
 *
 * This call is also responsible for connecting together the multiConnect call
 * with its eventual multiConnectResolved callback response. This means that
 * when we call multiConnect we MUST generate a unique identifier (a counter
 * would work fine) to pass in as the syncValue and then we MUST listen on the
 * multiConnectResolved callback waiting to hear that same syncValue and then
 * return the result to the caller of this method.
 *
 * @private
 * @param  {string} peerIdentifier The value taken from a
 * peerAvailabilityChanged event.
 * @return {Promise<number|Error>} The promise will either return an integer
 * with the localhost port to connect to or an Error object.
 */
module.exports._multiConnect = function (peerIdentifier) { // eslint-disable-line no-unused-vars
  return Promise.reject(new Error('Not yet implemented'));
};

// jscs:disable jsDoc
/**
 * This is used on `connect` platforms for native connections and calls through
 * to ThaliTcpServersManager.
 *
 * If called on a non-`connect` platform then a 'Not connect platform' error
 * MUST be returned.
 *
 * @private
 * @param {Object} incomingConnectionId
 * @returns {Promise<?Error>}
 */
// jscs:enable jsDoc
module.exports._terminateConnection = function (incomingConnectionId) {
  return gPromiseQueue.enqueue(function (resolve, reject) {
    gServersManager.terminateIncomingConnection(incomingConnectionId)
    .then(function () {
      resolve();
    })
    .catch(function (error) {
      reject(error);
    });
  });
};

/**
 * This calls the native disconnect method. This code is responsible for
 * honoring the restrictions placed on calls to multiConnect/disconnect in terms
 * of parallel calls with the same ID as described in the _multiConnect command.
 *
 * @private
 * @param {string} peerIdentifier The value taken from a peerAvailabilityChanged
 * event.
 * @returns {Promise<?Error>} Unless something bad happens (in which case a
 * reject with an Error will be returned) the response will be a resolve with
 * a null result.
 */
module.exports._disconnect = function (peerIdentifier) {
  return gPromiseQueue.enqueue(function (resolve, reject) {
    Mobile('disconnect').callNative(peerIdentifier, function (errorMsg) {
      if (errorMsg) {
        reject(new Error(errorMsg));
      } else {
        resolve();
      }
    });
  });
};

/**
 * Terminates a connection with the named peer. If there is no such connection
 * then the method will still return success.
 *
 * On 'connect' platforms this calls terminateListener method and on
 * `multiConnect` platforms this calls _disconnect.
 *
 * @param {string} peerIdentifier The value taken from a peerAvailabilityChanged
 * event.
 * @param {string} portNumber
 * @returns {Promise<?Error>} Unless something bad happens (in which case a
 * reject with an Error will be returned) the response will be a resolve with
 * a null result.
 */
module.exports.disconnect = function(peerIdentifier, portNumber) {
  if (platform.isAndroid) {
    return this._terminateListener(peerIdentifier, portNumber);
  }
  if (platform.isIOS) {
    return this._disconnect(peerIdentifier);
  }

  return Promise.reject(new Error('Disconnect can not be called on ' +
    platform.name + ' platform'));
};

/**
 * Used on `connect` platforms to terminate a TCP/IP listener waiting for
 * connections to be sent to a remote device.
 *
 * It is NOT an error to terminate a listener that has already been terminated.
 *
 * This method MUST be idempotent so multiple calls with the same value MUST NOT
 * cause an error or a state change.
 *
 * If called on a non-`connect` platform then a 'Not connect platform' error
 * MUST be returned.
 *
 * @private
 * @param {string} peerIdentifier
 * @param {number} port
 * @returns {Promise<?error>}
 */
module.exports._terminateListener = function (peerIdentifier, port) {
  if (!platform.isAndroid) {
    return Promise.reject(new Error('Not connect platform'));
  }
  return gPromiseQueue.enqueue(function (resolve, reject) {
    gServersManager.terminateOutgoingConnection(peerIdentifier, port)
    .then(function () {
      delete peerGenerations[peerIdentifier];
      resolve();
    })
    .catch(function (error) {
      reject(error);
    });
  });
};


// jscs:disable jsDoc
/**
 * # WARNING: This method is intended for internal Thali testing only. DO NOT
 * USE!
 *
 * This method is only intended for iOS. It's job is to terminate all incoming
 * and outgoing multipeer connectivity framework browser, advertiser, MCSession
 * and stream connections immediately without using the normal stop and start
 * interfaces or TCP/IP level connections. The goal is to simulate what would
 * happen if we switched the phone to something like airplane mode. This
 * simulates what would happen if peers went out of range.
 *
 * This method MUST return "Not Supported" if called on Android. On Android we
 * can get this functionality by using JXCore's ability to disable the local
 * radios.
 *
 * | Error String | Description |
 * |--------------|-------------|
 * | Failed | Somehow the stop method couldn't do its job. Check the logs. |
 * | Not Supported | This method is not support on this platform. |
 *
 * @private
 * @returns {Promise<?Error>}
 */
// jscs:enable jsDoc
module.exports.killConnections = function () {
  return gPromiseQueue.enqueue(function (resolve, reject) {
    Mobile('killConnections').callNative(function (error) {
      if (error) {
        reject(new Error(error));
        return;
      }
      resolve();
    });
  });
};

/**
 * This method is to toggle wifi.
 *
 * @param {boolean} value If true then enable wifi, else disable it.
 * @returns {Promise<?Error>}
 */
module.exports.toggleWiFi = function (value) {
  if (platform.isIOS) {
    return Promise.reject(new Error(
      'Mobile(\'toggleWiFi\') is not implemented on ios'
    ));
  }

  return gPromiseQueue.enqueue(function (resolve, reject) {
    Mobile.toggleWiFi(value, function (error) {
      if (error) {
        reject(error);
      } else {
        resolve();
      }
    });
  });
};

/**
 * This method takes out a wifi multicast lock on Android.
 *
 * @return {Promise<?Error>}
 */
module.exports.lockAndroidWifiMulticast = function () {
  if (platform.isIOS) {
    return Promise.reject(new Error(
      'Mobile(\'lockAndroidWifiMulticast\') is not implemented on ios'));
  }

  return gPromiseQueue.enqueue(function (resolve, reject) {
    Mobile('lockAndroidWifiMulticast').callNative(function (error) {
      if (error) {
        return reject(new Error(error));
      }
      resolve();
    });
  });
};


/**
 * This method removes a wifi multicast lock on Android.
 *
 * @return {Promise<?Error>}
 */
module.exports.unlockAndroidWifiMulticast = function () {
  if (platform.isIOS) {
    return Promise.reject(new Error(
      'Mobile(\'unlockAndroidWifiMulticast\') is not implemented on ios'));
  }

  return gPromiseQueue.enqueue(function (resolve, reject) {
    Mobile('unlockAndroidWifiMulticast').callNative(function (error) {
      if (error) {
        return reject(new Error(error));
      }
      resolve();
    });
  });
};

/* EVENTS */

/**
 *
 * @public
 * @typedef {Object} failedNativeConnection
 * @property {Error} error
 * @property {string} peerIdentifier
 * @property {connectionTypes} connectionType
 */

/**
 * Fired when a native connection is lost. This event is fired either as a
 * result of {@link module:ThaliTcpServersManager.event:failedConnection} or
 * as a result of
 * {@link module:ThaliMobileNative.event:multiConnectConnectionFailure}.

 * @public
 * @event failedNativeConnectionEvent
 * @type {Object}
 * @property {failedNativeConnection} failedConnection
 */

/**
 * When a {@link module:thaliMobileNative~peerAvailabilityChangedCallback}
 * occurs each peer MUST be placed into a queue. Each peer in the queue MUST be
 * processed as given below and only once all processing related to that peer
 * has completed MAY the next peer be taken from the queue.
 *
 * If a peer's peerAvailable is set to false then we MUST use platform specific
 * heuristics to decide how to process this. For example, on Android it is
 * possible for a peer to go into the background at which point their BLE radio
 * will go to low power even though their Bluetooth radio may still be
 * reachable. So the system might decide to wait for a bit before issuing a
 * peerAvailable = false for that peer. But when the system decides to issue a
 * peer not available event it MUST issue a {@link
 * event:nonTCPPeerAvailabilityChangedEvent} with peerIdentifier set to the
 * value in the peer object, the generation set as in the event and
 * peerAvailable set to false.
 *
 * @public
 * @typedef {Object} nonTCPPeerAvailabilityChanged
 * @property {string} peerIdentifier See {@link
 * module:thaliMobileNative~peer.peerIdentifier}.
 * @property {boolean} peerAvailable If false then the system is advertising
 * that it no longer believes this peer is available.
 * @property {?number} generation An integer which counts changes in the peer's
 * database. On Android this integer has only 8 bytes and so will roll over.
 * This value MUST be null if peerAvailable is set to false.
 * @property {?number} portNumber This value MUST be null if peerAvailable is
 * false. If this value is non-null then it is a port on 127.0.0.1 at which the
 * local peer can connect in order to establish a TCP/IP connection to the
 * remote peer. This value will only be set on `connect` platforms, it will
 * always be null for `multiConnect`.
 */

/* eslint-disable max-len */
/**
 * This event MAY start firing as soon as either of the start methods is called.
 * Start listening for advertisements obviously looks for new peers but in some
 * cases so does start advertising. This is because in some cases it's possible
 * for peer A to discover peer B but not vice versa. This can result in peer A
 * connecting to peer B who previously didn't know peer A exists. When that
 * happens we will fire a discovery event.
 *
 * This event MUST stop firing when both stop methods have been called.
 *
 * The native layer does not guarantee that it will filter out duplicate
 * peerAvailabilityChanged callbacks. This means it is possible to receive
 * multiple announcements about the same peer in the same state.
 *
 * While the native layer can return multiple peers in a single callback the
 * wrapper breaks them into individual events. See {@link
 * module:thaliMobileNativeWrapper~nonTCPPeerAvailabilityChanged} for details on
 * how to process each peer.
 *
 * @public
 * @event nonTCPPeerAvailabilityChangedEvent
 * @type {Object}
 * @property {nonTCPPeerAvailabilityChanged} peer
 */
/* eslint-enable max-len */
var peerAvailabilityChangedQueue = new PromiseQueue();
function handlePeerAvailabilityChanged (peer) {
  logger.debug('Received peer availability changed event with ' +
    JSON.stringify(peer));
  if (!states.started) {
    logger.debug('Filtered out nonTCPPeerAvailabilityChangedEvent ' +
                 'due to not being in started state');
    return;
  }
  return peerAvailabilityChangedQueue.enqueue(function (resolve) {
    var handlePeerUnavailable = function () {
      // TODO: Should the created peer listener be cleaned up when
      // peer becomes unavailable and which function should be used
      // for that?
      var event = {
        peerIdentifier: peer.peerIdentifier,
        peerAvailable: false,
        generation: null,
        portNumber: null,
        recreated: peer.recreated
      };
      if (!peer.recreated) {
        // The whole purpose of storing peer generations is to make sure that
        // after recreation we use the same generation. So we don't delete it
        // during listener recreation
        delete peerGenerations[peer.peerIdentifier];
      }
      logger.debug('handlePeerUnavailable - Emitting %s',
        JSON.stringify(event));
      module.exports.emitter.emit('nonTCPPeerAvailabilityChangedEvent', event);
      resolve();
    };
    if (peer.peerAvailable) {
      gServersManager.createPeerListener(peer.peerIdentifier)
      .then(function (portNumber) {
        var peerAvailabilityChangedEvent = {
          peerIdentifier: peer.peerIdentifier,
          peerAvailable: true,
          generation: peer.generation,
          portNumber: portNumber
        };
        peerGenerations[peer.peerIdentifier] = peer.generation;

        logger.debug('handlePeerAvailabilityChanged - Emitting %s',
          JSON.stringify(peerAvailabilityChangedEvent));
        module.exports.emitter.emit('nonTCPPeerAvailabilityChangedEvent',
          peerAvailabilityChangedEvent);
        resolve();
      })
      .catch(function (error) {
        logger.warn('Received error from createPeerListener: ' + error);
        // In case there is an error creating a peer listener,
        // handle the peer as if we would have received an unavailability
        // message since the upper layers couldn't connect to the peer
        // anyways.
        handlePeerUnavailable();
      });
    } else {
      handlePeerUnavailable();
    }
  });
}

module.exports._handlePeerAvailabilityChanged = handlePeerAvailabilityChanged;

function handleNetworkChanges (newStatus) {
  var oldStatus = gNonTcpNetworkStatus;

  var someRadioEnabled = oldStatus ?
    ['wifi', 'bluetooth', 'bluetoothLowEnergy'].some(function (radio) {
      return (newStatus[radio] === 'on' && oldStatus[radio] !== 'on');
    }) :
    true;

  if (!someRadioEnabled) {
    return;
  }

  // At least some radio was enabled so try to start whatever can be potentially
  // started as soon as possible.

  if (targetStates.started) {
    if (targetStates.listening) {
      module.exports.startListeningForAdvertisements()
        .catch(function (error) {
          logger.warn('Failed startListeningForAdvertisements with error ' +
            error.message);
        });
    }
    if (targetStates.advertising) {
      module.exports.startUpdateAdvertisingAndListening()
        .catch(function (error) {
          logger.warn('Failed startUpdateAdvertisingAndListening with error ' +
            error.message);
        });
    }
  }
}


/* eslint-disable max-len */
/**
 * This is used whenever discovery or advertising starts or stops. Since it's
 * possible for these to be stopped (in particular) due to events outside of
 * node.js's control (for example, someone turned off a radio) we provide a
 * callback to track these changes. Note that there is no guarantee that the
 * same callback value couldn't be sent multiple times in a row.
 *
 * But the general rule we will only fire this event in response to receiving
 * the event from the native layer. That is, we won't fire it ourselves when
 * someone calls start or stop advertising/incoming on the wrapper.
 *
 * @public
 * @event discoveryAdvertisingStateUpdateNonTCP
 * @type {Object}
 * @property {module:thaliMobileNative~discoveryAdvertisingStateUpdate} discoveryAdvertisingStateUpdateValue
 */
/* eslint-enable max-len */

/**
 * Provides a notification when the network's state changes as well as when our
 * use of the network changes, specifically when discovery or
 * advertising/listening starts and stops. This event MUST fire with the current
 * network state when the first subscription to the event is received.
 *
 * @public
 * @event networkChangedNonTCP
 * @type {Object}
 * @property {module:thaliMobileNative~networkChanged} networkChangedValue
 */

/**
 * @readonly
 * @enum {string}
 */
module.exports.routerFailureReason = {
  NATIVE_LISTENER: 'nativeListener',
  APP_LISTENER: 'appListener'
};

/**
 * This event specifies that one of our two internal TCP servers has failed.
 *
 * If we got {@link
 * external:"Mobile('incomingConnectionToPortNumberFailed')".registerToNative}
 * this means that our TCP listener for native connections has failed.
 *
 * If we got
 * {@link module:thaliTcpServersManager.event:routerPortConnectionFailed}
 * then this means that the app server we are hosting has failed.
 *
 * We will indicate which type of failure occurred using the reason entry.
 *
 * But in either case these are unrecoverable errors indicating something has
 * gone seriously wrong. As such if we get these errors we will stop the
 * thaliMobileNativeWrapper and will emit this event to let the listener know
 * they are in serious trouble.
 *
 * @public
 * @event incomingConnectionToPortNumberFailed
 * @property {routerFailureReason} reason
 * @property {Error[]} errors If the reason is NATIVE_LISTENER then the errors,
 * if any, will be from calling stop. If the reason is APP_LISTENER then the
 * first error will be the one returned with routerPortConnectionFailed from
 * thaliTcpServersManager and the rest, if any, will be from stop.
 * @property {number} routerPort If the reason is NATIVE_LISTENER then this is
 * the port we were listening to native connections on. If APP_LISTENER then
 * this is the port we were listening for application connections on.
 */

/**
 * Repeats multiConnectResolved callbacks. This is only used internally within
 * this file and is not intended to be exposed externally.
 *
 * @public
 * @event multiConnectResolvedEvent
 * @type {Object}
 * @property {string} syncValue
 * @property {?string} error
 * @property {?number} port
 */

/**
 * Use this emitter to subscribe to events.
 *
 * @public
 * @fires event:nonTCPPeerAvailabilityChangedEvent
 * @fires event:networkChangedNonTCP
 * @fires event:incomingConnectionToPortNumberFailed
 * @fires event:discoveryAdvertisingStateUpdateNonTCP
 * @fires event:failedNativeConnectionEvent
 * @fires module:TCPServersManager~incomingConnectionState we repeat these
 * events.
 */
module.exports.emitter = new EventEmitter();

/**
 * Function to register event handler functions
 * for events emitted from the native side.
 *
 * Exported only so that it can be used from automated
 * tests to make sure right functions are registered
 * certain tests are executed.
 *
 * @private
 */
module.exports._registerToNative = function () {
  // Function to register a method to the native side
  // and inform that the registration was done.
  var registerToNative = function (methodName, callback) {
    Mobile(methodName).registerToNative(callback);
    Mobile('didRegisterToNative').callNative(methodName, function () {
      logger.debug('Method %s registered to native', methodName);
    });
  };

  registerToNative('peerAvailabilityChanged', function (peers) {
    logger.debug('Received peerAvailabilityChanged event from native ' +
      'layer %j', peers);
    if (typeof peers.forEach !== 'function') {
      peers = [peers];
    }
    peers.forEach(function (peer) {
      handlePeerAvailabilityChanged(peer);
    });
  });

  registerToNative('discoveryAdvertisingStateUpdateNonTCP',
    function (discoveryAdvertisingStateUpdateValue) {
      logger.debug('discoveryAdvertisingStateUpdateNonTCP: %s',
        JSON.stringify(discoveryAdvertisingStateUpdateValue));
      module.exports.emitter.emit(
        'discoveryAdvertisingStateUpdateNonTCP',
        discoveryAdvertisingStateUpdateValue
      );
    }
  );

  registerToNative('networkChanged', function (networkChangedValue) {
    logger.debug('networkChanged: %s', JSON.stringify(networkChangedValue));
    // The value needs to be assigned here to gNonTcpNetworkStatus
    // so that {@link module:thaliMobileNativeWrapper:getNonTCPNetworkStatus}
    // can return it.
    handleNetworkChanges(networkChangedValue);
    gNonTcpNetworkStatus = networkChangedValue;
    module.exports.emitter.emit('networkChangedNonTCP', gNonTcpNetworkStatus);
  });

  registerToNative('incomingConnectionToPortNumberFailed',
    function (portNumber) {
      logger.info('incomingConnectionToPortNumberFailed: %s', JSON.stringify(portNumber));

      if (!states.started) {
        logger.info('got incomingConnectionToPortNumberFailed while not in ' +
          'start');
        return;
      }

      if (gServersManagerLocalPort !== portNumber) {
        logger.info('got incomingConnectionToPortNumberFailed for port ' +
          portNumber + ' but we are listening on ' + gServersManagerLocalPort);
        return;
      }

      // Enqueue the restart to prevent other calls being handled
      // while the restart is ongoing.
      gPromiseQueue.enqueueAtTop(stop())
        .catch(function (err) {
          return err;
        })
        .then(function (err) {
          module.exports.emitter.emit('incomingConnectionToPortNumberFailed',
            {
              reason: module.exports.routerFailureReason.NATIVE_LISTENER,
              errors: err ? [err] : [],
              routerPort: portNumber
            });
        });
    }
  );
};

// Perform the registration when this file first required.
module.exports._registerToNative();
