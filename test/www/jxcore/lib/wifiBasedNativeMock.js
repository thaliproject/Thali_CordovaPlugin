'use strict';

var Promise = require('bluebird');
var EventEmitter = require('events').EventEmitter;
var uuid = require('node-uuid');
var express = require('express');
var assert = require('assert');
var net = require('net');
var platform = require('thali/NextGeneration/utils/platform');
var makeIntoCloseAllServer = require('thali/NextGeneration/makeIntoCloseAllServer');
var uuidValidator = require('uuid-validate');
var logger = require('./testLogger')('wifiBasedNativeMock');

var proxyquire = require('proxyquire');
proxyquire.noPreserveCache();

var mockEmitter = new EventEmitter();
var networkStatusCalled = false;

var peerConnections = {};
var peerProxyServers = {};
var peerProxySockets = {};

var peerAvailabilityChangedCallback = null;
var peerAvailabilities = {};

var BSSID = 'c1:5b:05:5a:41:1e'; // 'c1-5b-05-5a-41-1e' is valid too.
var SSID  = 'myWifi';

var currentNetworkStatus = {
  wifi:               'on',
  bluetooth:          'on',
  bluetoothLowEnergy: 'on',
  cellular:           'on',

  bssidName: BSSID,
  ssidName:  SSID
};

var getCurrentNetworkStatus = function () {
  return JSON.parse(JSON.stringify(currentNetworkStatus));
};

var ThaliWifiInfrastructure =
proxyquire('thali/NextGeneration/thaliWifiInfrastructure',
  {
    './thaliMobileNativeWrapper': {
      emitter: mockEmitter,
      getNonTCPNetworkStatus: function () {
        assert(!networkStatusCalled,
          'the mock network status should not be called twice');
        networkStatusCalled = true;
        return Promise.resolve(getCurrentNetworkStatus());
      },
      lockAndroidWifiMulticast: function () {
        return Promise.resolve();
      },
      unlockAndroidWifiMulticast: function () {
        return Promise.resolve();
      },
      '@noCallThru': true
    },
    './thaliConfig': {
      // Use a unique NT for messaging between mock code so
      // that the SSDP traffic doesn't get mixed up with real
      // Thali messaging (for example, if in a desktop test,
      // the native and Wifi layers are run simultaneously).
      SSDP_NT: (process.env.SSDP_NT || 'http://www.thaliproject.org') + '/mock'
    },
    'ip': {
      address: function () {
        // In desktop mocking scenario, all peers are running
        // in localhost.
        return '127.0.0.1';
      }
    }
  }
);

/** @module WifiBasedNativeMock */

/**
 * @file
 *
 * This is a mock of {@link module:thaliMobileNative}. It is intended to
 * replicate all the capabilities of {@link module:thaliMobileNative} so that we
 * can build and test code intended to use {@link module:thaliMobileNative} but
 * on the desktop.
 *
 * We are intentionally replicating the lowest layer of the stack in order to
 * to be able to test on the desktop all the layers on top of it. This includes
 * emulating behaviors unique to iOS and Android.
 *
 * For testing purposes if callNative or registerToNative do not get all the
 * parameters they were expecting then a "Bad Arguments" exception MUST be
 * thrown.
 *
 * ## Mocking iOS
 *
 * The file was original written from the perspective of Android and the
 * connect method (which we also used to use on iOS). But the new code uses
 * multiConnect for iOS. The challenge with this change is how do we model
 * a MCSession on the WiFi Mock? It was relatively easy to model an Android
 * Bluetooth socket because the mux in node is allowed to create exactly one
 * TCP/IP connection to the native layer. If node kills that connection then it
 * means that node wants the associated Bluetooth socket to die. And if the
 * native layer kills the connection it tells node that for some reason the
 * Bluetooth socket was lost. So by just killing that single TCP/IP connection
 * we could model kill the mocked Bluetooth socket either from node or from
 * the 'native' layer.
 *
 * But with iOS there can be many or even no connections to the native TCP/IP
 * listener. So the life span of the MCSession is largely separate from the
 * listener. I say 'largely' because if the listen is closed all together then
 * that tells the node layer that the MCSession was lost but this is not
 * something that is easily detected by the node layer so it isn't terribly
 * useful for us. More importantly, there is no way for the remote peer to
 * directly trigger the closure of the TCP/IP listener, at least not via any
 * TCP/IP mechanism. Where as a remote peer can trigger the closure of the
 * the single TCP/IP connection by closing its relayed connection.
 *
 * However for now we only support closing sessions we initiated, there is no
 * way for the remote peer to terminate from the node layer a session it was
 * invited to. This is obviously a bug and we'll eventually need to fix it but
 * for now that's that. So when we get a multiConnect call we just need to
 * have our listener and when we get a disconnect for that multiConnect then
 * we just shut down the listener and all incomning and outgoing connections.
 */

/**
 * This is the method that actually handles processing the native requests. In
 * general this method just records the arguments for later use.
 *
 * @param {string} mobileMethodName This is the name of the method that was
 * passed in on the mobile object
 * @param {module:platform.names} platform
 * @param {Object} router
 * @param {thaliWifiInfrastructure} thaliWifiInfrastructure
 * @constructor
 */
function MobileCallInstance(mobileMethodName, platform, router,
                            thaliWifiInfrastructure) {
  this.mobileMethodName = mobileMethodName;
  this.platform = platform;
  this.router = router;
  this.thaliWifiInfrastructure = thaliWifiInfrastructure;
}

MobileCallInstance.prototype.thaliWifiInfrastructure = null;
MobileCallInstance.prototype.mobileMethodName = null;
MobileCallInstance.prototype.platform = null;
MobileCallInstance.prototype.router = null;

/**
 * Most of the functions we are mocking are supposed to have at most one
 * outstanding call to them at a time. This wrapper enforces that requirement
 * by asserting if there is more than one outstanding call.
 * @param {Object} funSelf The 'this' for the method being called
 * @param {Object} fun The function to be invoked
 * @constructor
 */
function CallOnce(funSelf, fun) {
  this.called = false;
  this.fun = fun;
  this.funSelf = funSelf;
}

/**
 * This checks if the function being wrapped in CallOnce has been wrapped and
 * if not it will wrap it. Note that we assume that for any function that
 * is submitted its last argument when invoked is always a callback.
 * @param {Object} self The self that the function to be invoked should be
 * called with
 * @param {string} funName The name of the function to be invoked
 * @param {Object[]} args The args that were submitted to the function being
 * invoked.
 */
CallOnce.check = function (self, funName, args) {
  var callOnceFunName = funName + 'CallOnce';
  if (!self[callOnceFunName]) {
    self[callOnceFunName] =
      new CallOnce(self, self[funName]);
  }

  return self[callOnceFunName].startCall.apply(self[callOnceFunName], args);
};

CallOnce.prototype.startCall = function () {
  var self = this;
  assert(!self.called, 'Only one call at a time');
  self.called = true;
  // arguments isn't a real array so we make it into one, bad perf
  // but we don't care
  var functionArgs = Array.prototype.slice.call(arguments);
  var originalCallback = functionArgs.slice(-1)[0];
  var callbackWrapper = function () {
    assert(self.called, 'Stop should only be called after start');
    self.called = false;
    return originalCallback.apply(self.funSelf, arguments);
  };
  functionArgs[functionArgs.length - 1] = callbackWrapper;
  return self.fun.apply(self.funSelf, functionArgs);
};

function debugLogWithId(message, peerIdentifier) {
  var optionalExtension = peerIdentifier ? ' - for peerID ' + peerIdentifier :
    '';
  logger.debug(message + optionalExtension);
}

function setUpSocketListeners(socket, socketName, pipedSocket, peerIdentifier) {
  socket.on('error', function (err) {
    debugLogWithId('error on ' + socketName + ' - ' + err, peerIdentifier);
  });

  socket.on('end', function() {
    debugLogWithId(socketName + ' ended ', peerIdentifier);
    pipedSocket.end();
  });

  socket.on('close', function () {
    debugLogWithId(socketName + ' closed ', peerIdentifier);
    pipedSocket.destroy();
  });
}

function createAndStartProxyRelayServer(portNumber, peerIdentifier) {
  return new Promise(function (resolve, reject) {
    var server = makeIntoCloseAllServer(
      net.createServer(
        function (incomingSocket) {
          var outgoingSocket = net.connect(portNumber, function () {
            debugLogWithId('received incoming socket', peerIdentifier);
          });

          setUpSocketListeners(incomingSocket, 'incomingSocket', outgoingSocket,
            peerIdentifier);

          setUpSocketListeners(outgoingSocket, 'outgoingSocket', incomingSocket,
            peerIdentifier);

          incomingSocket.pipe(outgoingSocket).pipe(incomingSocket);
        }), true);

    server.on('error', function (err) {
      debugLogWithId('got error on server object', peerIdentifier);
      reject(err);
    });

    server.listen(0, function () {
      resolve(server);
    });

    return null;
  });
}

var startListeningForAdvertisementsIsActive = false;
/**
 * In effect this listens for SSDP:alive and SSDP:byebye messages along with
 * the use of SSDP queries to find out who is around. These will be translated
 * to peer availability callbacks as specified below. This code MUST meet the
 * same requirements for using a unique SSDP port, syntax for requests, etc. as
 * {@link module:ThaliWifiInfrastructure}.
 *
 * Other requirements for this method MUST match those of {@link
 * external:"Mobile('startListeningForAdvertisements')".callNative} in terms of
 * idempotency. This also means we MUST return "Radio Turned Off" if we are
 * emulating Bluetooth as being off.
 *
 * @public
 * @param {module:thaliMobileNative~ThaliMobileCallback} callback
 */
MobileCallInstance.prototype.startListeningForAdvertisements =
  function (callback) {// eslint-disable-line no-unused-vars
    return CallOnce.check(this, '_startListeningForAdvertisements', arguments);
  };

MobileCallInstance.prototype._startListeningForAdvertisements =
  function (callback) {
    this.thaliWifiInfrastructure.startListeningForAdvertisements()
    .then(function () {
      startListeningForAdvertisementsIsActive = true;
      callback();
    })
    .catch(function (error) {
      callback(error.message);
    });
  };

/**
 * This shuts down the SSDP listener/query code. It MUST otherwise behave as
 * given for {@link
 * external:"Mobile('stopListeningForAdvertisements')".callNative}.
 *
 * @public
 * @param {module:thaliMobileNative~ThaliMobileCallback} callBack
 */
MobileCallInstance.prototype.stopListeningForAdvertisements =
  function (callBack) {// eslint-disable-line no-unused-vars
    return CallOnce.check(this, '_stopListeningForAdvertisements', arguments);
  };

MobileCallInstance.prototype._stopListeningForAdvertisements =
function (callBack) {
  this.thaliWifiInfrastructure.stopListeningForAdvertisements()
  .then(function () {
    startListeningForAdvertisementsIsActive = false;
    callBack();
  }).catch(function (err) {
    callBack(err);
  });
};

var incomingConnectionsServer = null;
var startUpdateAdvertisingAndListeningIsActive = false;
/**
 * This method tells the system to both start advertising and to accept
 * incoming connections. In both cases we need to accept incoming connections.
 * The main challenge is simulating what happens when stop is called. This is
 * supposed to shut down all incoming connections. So we can't just advertise
 * our 127.0.0.1 port and let the other mocks running on the same machine
 * connect since stop wouldn't behave properly. To handle the stop behavior,
 * that is to disconnect all incoming connections, we have to introduce a TCP
 * level proxy. The reason we need a TCP proxy is that we are using direct SSL
 * connections in a way that may or may not properly work through a HTTPS proxy.
 * So it's simpler to just introduce the TCP proxy. We will advertise the TCP
 * proxy's listener port in SSDP and when someone connects we will create a TCP
 * client connection to portNumber and then pipe the two connections together.
 *
 * __Open Issue:__ If we directly pipe the TCP listener socket (from connect)
 * and the TCP client socket (that we created) then will the system
 * automatically kill the pipe if either socket is killed? We need to test this.
 * If it doesn't then we just need to hook the close event and close the other
 * side of the pipe.
 *
 * __Note:__ For now we are going to not simulate the Bluetooth handshake for
 * Android. This covers the scenario where device A doesn't discover device B
 * over BLE but device B discovered device A over BLE and then connected over
 * Bluetooth. The handshake would create a simulated discovery event but we are
 * going to assume that the SSDP discovery will arrive in a timely manner and so
 * the behavior should be the same.
 *
 * For advertising we will use SSDP both to make SSDP:alive as well as to
 * answer queries as given in {@link module:ThaliWifiInfrastructure}.
 *
 * For incoming connections we will, as described above, just rely on everyone
 * running on 127.0.0.1.
 *
 * Otherwise the behavior MUST be the same as defined for (@link
 * external:"Mobile('startUpdateAdvertisingAndListening')".callNative}. That
 * includes returning the "Call Start!" error as appropriate as
 * well as returning "Radio Turned Off" if we are emulating Bluetooth as being
 * off.
 *
 * @param {number} portNumber
 * @param {module:thaliMobileNative~ThaliMobileCallback} callback
 */
MobileCallInstance.prototype.startUpdateAdvertisingAndListening =
  function (portNumber, callback) {// eslint-disable-line no-unused-vars
    return CallOnce.check(this, '_startUpdateAdvertisingAndListening',
                          arguments);
  };

MobileCallInstance.prototype._startUpdateAdvertisingAndListening =
function (portNumber, callback) {
  var self = this;
  var doStart = function () {
    self.thaliWifiInfrastructure.startUpdateAdvertisingAndListening()
    .then(function () {
      startUpdateAdvertisingAndListeningIsActive = true;
      callback();
    }).catch(function (err) {
      callback(err);
    });
  };
  if (incomingConnectionsServer !== null) {
    doStart();
  } else {
    createAndStartProxyRelayServer(portNumber, 'Incoming connection relay')
      .then(function (server) {
        incomingConnectionsServer = server;
        self.thaliWifiInfrastructure.advertisedPortOverride =
          incomingConnectionsServer.address().port;
        doStart();
      });
  }
  return null;
};

function closeAndDeleteOutgoingProxyServer(peerIdentifier) {
  return peerProxyServers[peerIdentifier].closeAllPromise()
    .then(function () {
      delete peerProxyServers[peerIdentifier];
      if (platform.isIOS) {
        multiConnectConnectionFailureCallbackHandler(peerIdentifier,
          'Disconnect was called');
      }
    })
    .catch(function (err) {
      delete peerProxyServers[peerIdentifier];
      if (platform.isIOS) {
        multiConnectConnectionFailureCallbackHandler(peerIdentifier, err);
      }
    });
}

/**
 * This function MUST behave like {@link module:ThaliWifiInfrastructure} and
 * send a proper SSDP:byebye and then stop responding to queries or sending
 * SSDP:alive messages. Otherwise it MUST act like
 * (@link external:"Mobile('stopAdvertisingAndListening')".callNative}
 * including terminating the TCP proxy and all of its connections to simulate
 * killing all incoming connections.
 *
 * @param {module:thaliMobileNative~ThaliMobileCallback} callBack
 */
MobileCallInstance.prototype.stopAdvertisingAndListening =
  function (callBack) {// eslint-disable-line no-unused-vars
    return CallOnce.check(this, '_stopAdvertisingAndListening', arguments);
  };

MobileCallInstance.prototype._stopAdvertisingAndListening =
function (callBack) {
  var self = this;
  return (incomingConnectionsServer ?
          incomingConnectionsServer.closeAllPromise() :
          Promise.resolve())
    .then(function () {
      incomingConnectionsServer = null;
      peerAvailabilities = {};
      for (var peerIdentifier in peerConnections) {
        var peerConnection = peerConnections[peerIdentifier];
        peerConnection.end();
        delete peerConnections[peerIdentifier];
      }

      var peerProxyServerClosePromises = [];
      for (var peerIdentifier in peerProxyServers) {
        peerProxyServerClosePromises.push(
          closeAndDeleteOutgoingProxyServer(peerIdentifier));
      }

      for (var peerIdentifier in peerProxySockets) {
        peerProxySockets[peerIdentifier].destroy();
        delete peerProxySockets[peerIdentifier];
      }

      return Promise.all(peerProxyServerClosePromises);
    })
    .then(function () {
      return self.thaliWifiInfrastructure.stopAdvertisingAndListening();
    })
    .then(function () {
      startUpdateAdvertisingAndListeningIsActive = false;
      callBack();
    })
    .catch(function (err) {
      callBack(err);
    });
};

MobileCallInstance.prototype._disconnect =
  function (peerIdentifier, callback) {
    var connection = peerConnections[peerIdentifier];
    var socket = peerProxySockets[peerIdentifier];
    var server = peerProxyServers[peerIdentifier];

    if (connection) {
      connection.destroy();
      delete peerConnections[peerIdentifier];
    }
    if (socket) {
      socket.destroy();
      delete peerProxySockets[peerIdentifier];
    }
    if (server) {
      closeAndDeleteOutgoingProxyServer(peerIdentifier)
      .then(function () {
        callback(null);
      })
      .catch(callback);

      return;
    }

    callback(null);
  };

function returnPort(peerIdentifier, callback) {
  callback(null, JSON.stringify({
    listeningPort: peerProxyServers[peerIdentifier].address().port
  }));
}

function returnConnectResponse(peerIdentifier, callback,
                               cleanProxyServer) {
  var server = peerProxyServers[peerIdentifier];

  if (!server || !server.address())  {
    return callback('Server was either closed or is not yet listening');
  }

  returnPort(peerIdentifier, callback);

  setTimeout(function () {
    if (!peerProxySockets[peerIdentifier]) {
      // Either the code that called connect didn't connect within the allowed
      // window or the server already failed.
      cleanProxyServer();
    }
  }, 2000);
}

MobileCallInstance.prototype._androidConnectLogic =
  function (peerIdentifier, peerToConnect, callback) {
    var self = this;
    var cleanProxyServerCalled = false;
    function cleanProxyServer() {
      if (cleanProxyServerCalled) {
        return;
      }
      cleanProxyServerCalled = true;
      self._disconnect(peerIdentifier, function (error) {
        logger.debug('Got error while disconnecting a peer: ' + error);
      });
    }

    peerProxyServers[peerIdentifier] = makeIntoCloseAllServer(
      net.createServer(function (socket) {
        if (peerProxySockets[peerIdentifier]) {
          socket.destroy();
          return;
        }

        var peerConnection = peerConnections[peerIdentifier];

        if (!peerConnection || peerConnection.destroyed) {
          socket.destroy();
          return;
        }

        peerProxySockets[peerIdentifier] = socket;
        peerProxySockets[peerIdentifier].pipe(peerConnection)
          .pipe(peerProxySockets[peerIdentifier]);
        socket.on('end', function () {
          logger.debug('got an end on peerProxySockets');
          socket.end();
        });
        socket.on('error', function (err) {
          logger.debug('error on peerProxyServers socket for ' +
            peerIdentifier + ', err - ' + err);
        });
        socket.on('close', function () {
          cleanProxyServer();
        });
      }),
      true
    );

    peerProxyServers[peerIdentifier].listen(0, function () {
      function simplePeerConnectionError(err) {
        logger.debug('error on peerConnections socket for ' + peerIdentifier +
          ', err - ' + err);
      }

      function failedPeerConnectionError(err) {
        simplePeerConnectionError(err);
        callback(err);
      }

      peerConnections[peerIdentifier] = net.connect(peerToConnect.portNumber,
        function () {
          setTimeout(function () {
            if (!peerProxyServers[peerIdentifier]) {
              var error = 'Unspecified Error with Radio infrastructure';
              return callback(error);
            }
            peerConnections[peerIdentifier]
                .removeListener('error', failedPeerConnectionError);
            peerConnections[peerIdentifier]
                .on('error', simplePeerConnectionError);
            returnConnectResponse(peerIdentifier, callback,
                cleanProxyServer);
          },
            100);
        });
      peerConnections[peerIdentifier].on('end', function () {
        peerConnections[peerIdentifier] &&
        peerConnections[peerIdentifier].end();
      });

      peerConnections[peerIdentifier].on('error', failedPeerConnectionError);
      peerConnections[peerIdentifier].on('close', function () {
        cleanProxyServer();
      });
    });

    peerProxyServers[peerIdentifier].on('close', function () {
      cleanProxyServer();
    });
  };

MobileCallInstance.prototype._iOSConnectLogic =
  function (peerIdentifier, peerToConnect, callback) {
    var self = this;
    var cleanProxyServerCalled = false;
    function cleanProxyServer() {
      if (cleanProxyServerCalled) {
        return;
      }
      cleanProxyServerCalled = true;
      self._disconnect(peerIdentifier, function (error) {
        logger.debug('Got error while disconnecting a peer: ' + error);
      });
    }

    createAndStartProxyRelayServer(peerToConnect.portNumber, peerIdentifier)
      .then(function (server) {
        peerProxyServers[peerIdentifier] = server;
        return returnConnectResponse(peerIdentifier, callback,
                                                cleanProxyServer);
      })
      .catch(function (err) {
        return callback(err);
      });
  };

MobileCallInstance.prototype._connect =
  function (peerIdentifier, callback) {
    if (!platform.isMobile) {
      throw new Error('Unsupported platform - ' + platform.name);
    }

    if (!startListeningForAdvertisementsIsActive) {
      return callback('startListeningForAdvertisements is not active');
    }

    var peerToConnect = peerAvailabilities[peerIdentifier];
    if (!peerToConnect) {
      setImmediate(function () {
        callback('Connection could not be established');
      });
      return;
    }

    if (peerProxyServers[peerIdentifier]) {
      if (platform.isAndroid) {
        return callback('Already connect(ing/ed)');
      }

      if (platform.isIOS) {
        return returnPort(peerIdentifier, callback);
      }
    }

    if (platform.isAndroid) {
      this._androidConnectLogic(peerIdentifier, peerToConnect, callback);
    }

    if (platform.isIOS) {
      this._iOSConnectLogic(peerIdentifier, peerToConnect, callback);
    }
  };

// jscs:disable jsDoc
/**
 * All the usual restrictions on connect apply including throwing errors if
 * start listening isn't active, handling consecutive calls, etc. Please see the
 * details in {@link external:"Mobile('connect')".callNative}. In this case the
 * mock MUST keep track of the advertised IP and port for each peerIdentifier
 * and then be able to establish a TCP/IP listener on 127.0.0.1 and use a TCP
 * proxy to relay any connections to the 127.0.0.1 port to the IP address and
 * port that was advertised over SSDP. The point of all this redirection is to
 * fully simulate the native layer so we can run tests of the Wrapper and above
 * with full fidelity. This lets us do fun things like simulate turning off
 * radios as well as properly enforce behaviors such as those below that let our
 * local listener only accept one connection and simulating time outs on a
 * single peer correctly (e.g. the other side is still available but we had no
 * activity locally and so need to tear down).
 *
 * In the case of simulating Android we just have to make sure that at any time
 * we have exactly one outgoing connection to any peerIdentifier. So if we get a
 * second connect for the same peerIdentifier while the first is active then we
 * need to return an 'Already connect(ing/ed)' error. We also need the right
 * tear down behavior so that if the local app connection to the local TCP
 * listener (that will then relay to the remote peer's port) is torn down then
 * we tear down the connection to the remote peer and vice versa.
 *
 * We have to throw the same errors as for connect so, for example, if this
 * method is called while we are simulating iOS then we MUST throw a
 * 'Platform does not support connect' error.
 *
 * @param {string} peerIdentifier
 * @param {module:thaliMobileNative~ConnectCallback} callback
 */
// jscs:enable jsDoc
MobileCallInstance.prototype.connect = function (peerIdentifier, callback) {
  if (platform.isIOS) {
    return callback('Platform does not support connect');
  }
  return this._connect(peerIdentifier, callback);
};

/**
 * All the usual restrictions on multiConnect apply including throwing errors if
 * start listening isn't active, handling consecutive calls, etc. Please see the
 * details in {@link external:"Mobile('multiConnect')".callNative}. In this case
 * the mock MUST keep track of the advertised IP and port for each
 * peerIdentifier and then be able to establish a TCP/IP listener on 127.0.0.1
 * and use a TCP proxy to relay any connections to the 127.0.0.1 port to the IP
 * address and port that was advertised over SSDP. The point of all this
 * redirection is to fully simulate the native layer so we can run tests of the
 * Wrapper and above with full fidelity. This lets us do fun things like
 * simulate turning off radios as well as properly enforce behaviors such as
 * supporting the disconnect method.
 *
 * Although this is going to sound fairly nuts probably the easiest way to make
 * this all work is to re-use thaliTcpServersManager and friends from the mux.
 * The idea is that in iOS we have a MCSession which contains within it all
 * the connections between two peers going in a particular direction (meaning
 * we have two MCSessions at a time between two peers). We need a way to
 * simulate a MCSession ending (which can be initiated by either peer) and have
 * that harvest all the associated TCP/IP connections. The way we can do this is
 * by having startUpdateAdvertisingAndListening actually call
 * thaliTcpServersManager passing in the port it was given and then advertising
 * over SSDP the port returned by calling start on ThaliTcpServersManager. This
 * will automatically create a listener that turns each single TCP connection
 * into a mux and so lets many connections be generated but we can simulate
 * disconnect or turning off radios either by calling
 * terminateIncomingConnection on ThaliTcpServersManager or even stop.
 *
 * For multiConnect what we would do is call createPeerListener on
 * ThaliTcpServersManager and return the port of the TCP Listener that
 * createPeerListener created as the response to multiConnect. This will allow
 * arbitrary TCP/IP connections but they will all be passed through the mux
 * layer and so disconnect is trivially easy to implement, we just call
 * terminateOutgoingConnection.
 *
 * We could then issue multiConnectConnectionFailure events by trapping the
 * failedConnection events from the ThaliTcpServersManager.
 *
 * We have to make sure that if we get multiple calls to multiConnect for the
 * same peer that we already have a connection outstanding for that we return
 * the same address and port. (Which ThaliTcpServersManager would handle for us
 * for free).
 *
 * We have to throw the same errors as for multiConnect so, for example, if this
 * method is called while we are simulating Android then we MUST throw a
 * "Platform does not support `multiConnect`" error.
 */
 /**
 * @param {string} peerIdentifier
 * @param {string} syncValue
 * @param {module:thaliMobileNative~ThaliMobileCallback} callback
 */
MobileCallInstance.prototype.multiConnect =
  function (peerIdentifier, syncValue, callback) {
    if (platform.isAndroid) {
      return callback('Platform does not support multiConnect');
    }

    if (!uuidValidator(peerIdentifier)) {
      callback(null);
      return multiConnectResolvedCallbackHandler(syncValue, 'Illegal peerID');
    }

    // The immediate return just says we got the request.
    callback(null);
    return this._connect(peerIdentifier, function (error, response) {
      var listeningPort = null;
      if (!error && response) {
        var connection = JSON.parse(response);
        listeningPort = connection.listeningPort;
      }
      return multiConnectResolvedCallbackHandler(syncValue, error,
                                                  listeningPort);
    });
  };


/**
 * Emulates disconnect. If we have a session for the peerIdentifier via the
 * TCP proxy then we MUST kill the proxy. If there is no session for the
 * peerIdentifier then we return success.
 *
 * @param {string} peerIdentifier
 * @param {module:thaliMobileNative~ThaliMobileCallback} callback
 */
MobileCallInstance.prototype.disconnect = function(peerIdentifier, callback) {
  if (platform.isAndroid) {
    return callback('Platform does not support multiConnect');
  }

  this._disconnect(peerIdentifier, callback);
};

/**
 * If we aren't emulating iOS then this method has to return the "Not
 * Supported" error. If we are emulating iOS then we have to kill all the TCP
 * listeners we are using to handling outgoing connections and the TCP proxy we
 * are using to handle incoming connections.
 *
 * @public
 * @param {module:thaliMobileNative~ThaliMobileCallback} callback
 */
MobileCallInstance.prototype.killConnections = function (callback) {
  // TODO: Implement specified behavior
  callback('Not Supported');
};

MobileCallInstance.prototype.lockAndroidWifiMulticast =
  function (callback) {// eslint-disable-line no-unused-vars
    return CallOnce.check(this, '_lockAndroidWifiMulticast', arguments);
  };


MobileCallInstance.prototype._lockAndroidWifiMulticast =
  function (callback) {
    callback(null);
  };

MobileCallInstance.prototype.unlockAndroidWifiMulticast =
  function (callback) {// eslint-disable-line no-unused-vars
    return CallOnce.check(this, '_unlockAndroidWifiMulticast', arguments);
  };

MobileCallInstance.prototype._unlockAndroidWifiMulticast =
  function (callback) {
    callback(null);
  };


var fakeDeviceName = uuid.v4();
/**
 * Generates a UUID that will be used as the name of the current device.
 *
 * @public
 * @param {module:thaliMobileNative~ThaliMobileCallback} callback
 */
MobileCallInstance.prototype.getDeviceName = function (callback) {
  setImmediate(function () {
    callback(fakeDeviceName);
  });
};

MobileCallInstance.prototype.didRegisterToNative = function (method, callback) {
  // No need to do anything, because the mock gets to handle the
  // registerToNative calls directly and thus doesn't need to
  // to handle this additional step.
  setImmediate(callback);
};


/**
 * Handles processing callNative requests. The actual params differ based on
 * the particular Mobile method that is being called.
 */
MobileCallInstance.prototype.callNative = function () {
  switch (this.mobileMethodName) {
    case 'startListeningForAdvertisements': {
      return this.startListeningForAdvertisements(arguments[0]);
    }
    case 'stopListeningForAdvertisements': {
      return this.stopListeningForAdvertisements(arguments[0]);
    }
    case 'startUpdateAdvertisingAndListening': {
      return this.startUpdateAdvertisingAndListening(
          arguments[0], arguments[1]);
    }
    case 'stopAdvertisingAndListening': {
      return this.stopAdvertisingAndListening(
          arguments[0]);
    }
    case 'connect': {
      return this.connect(arguments[0], arguments[1]);
    }
    case 'multiConnect': {
      return this.multiConnect(arguments[0], arguments[1], arguments[2]);
    }
    case 'disconnect': {
      return this.disconnect(arguments[0], arguments[1]);
    }
    case 'killConnections': {
      return this.killConnections(arguments[0]);
    }
    case 'lockAndroidWifiMulticast': {
      return this.lockAndroidWifiMulticast(arguments[0]);
    }
    case 'unlockAndroidWifiMulticast': {
      return this.unlockAndroidWifiMulticast(arguments[0]);
    }
    case 'GetDeviceName': {
      return this.getDeviceName(arguments[0]);
    }
    case 'didRegisterToNative': {
      return this.didRegisterToNative(arguments[0], arguments[1]);
    }
    default: {
      throw new Error('The supplied mobileName does not have a matching ' +
          'callNative method: ' + this.mobileMethodName);
    }
  }
};

var setupListeners = function (thaliWifiInfrastructure) {
  thaliWifiInfrastructure.on(
    'wifiPeerAvailabilityChanged',
    function (wifiPeer) {
      if (peerAvailabilityChangedCallback === null) {
        return;
      }

      // No sending events until at least one of the two start methods is
      // running.
      if (!startListeningForAdvertisementsIsActive &&
          !startUpdateAdvertisingAndListeningIsActive) {
        return;
      }

      var peerAvailable = !!wifiPeer.hostAddress;
      if (peerAvailable) {
        peerAvailabilities[wifiPeer.peerIdentifier] = wifiPeer;
      } else {
        delete peerAvailabilities[wifiPeer.peerIdentifier];
      }
      peerAvailabilityChangedCallback([{
        peerIdentifier: wifiPeer.peerIdentifier,
        peerAvailable: peerAvailable,
        generation: wifiPeer.generation
      }]);
    }
  );
  thaliWifiInfrastructure.on(
    'discoveryAdvertisingStateUpdateWifiEvent',
    function (discoveryAdvertisingStateUpdateValue) {
      if (discoveryAdvertisingStateUpdateNonTCPCallback !== null) {
        discoveryAdvertisingStateUpdateNonTCPCallback(
          discoveryAdvertisingStateUpdateValue
        );
      }
    }
  );
};

// jscs:disable jsDoc
/**
 * Anytime we are looking for advertising and we receive a SSDP:alive,
 * SSDP:byebye or a response to one of our periodic queries we should use it to
 * create a peerAvailabilityChanged call back. In practice we don't really need
 * to batch these messages so we can just fire them as we get them. The
 * peerIdentifier is the USN from the SSDP message, and peerAvailable is true or
 * false based on the SSDP response.
 *
 * @param {module:thaliMobileNative~peerAvailabilityChangedCallback} callback
 */
// jscs:enable jsDoc
MobileCallInstance.prototype.peerAvailabilityChanged = function (callback) {
  peerAvailabilityChangedCallback = callback;
};

var discoveryAdvertisingStateUpdateNonTCPCallback = null;
// jscs:disable maximumLineLength
/**
 * Any time there is a call to start and stop or if Bluetooth is turned off on
 * Android (which also MUST mean that we have disabled both advertising and
 * discovery) then we MUST fire this event.
 *
 * @public
 * @param {module:thaliMobileNative~discoveryAdvertisingStateUpdateNonTCPCallback} callback
 */
// jscs:enable maximumLineLength
MobileCallInstance.prototype.discoveryAdvertisingStateUpdateNonTCP =
function (callback) {
  discoveryAdvertisingStateUpdateNonTCPCallback = callback;
};

var networkChangedCallback = null;
// jscs:disable jsDoc
/**
 * At this point this event would only fire because we called toggleBluetooth
 * or toggleWifi. For the moment we will treat toggleBluetooth and turning
 * on/off both bluetoothLowEnergy and bluetooth.
 *
 * __Open Issue:__ Near as I can tell both Android and iOS have a single
 * Bluetooth switch that activates and de-activates Bluetooth and BLE. Note
 * however that in theory it's possible to still have one available and not the
 * other to a particular application because of app level permissions but that
 * isn't an issue for the mock.
 *
 * @public
 * @param {module:thaliMobileNative~networkChangedCallback} callback
 */
// jscs:enable jsDoc
MobileCallInstance.prototype.networkChanged = function (callback) {
  networkChangedCallback = callback;
  // Implement the logic to emit networkChangedNonTCP
  // when the first listener is registered.
  setImmediate(function () {
    networkChangedCallback(getCurrentNetworkStatus());
  });
};

var incomingConnectionToPortNumberFailedCallback = null;
// jscs:disable maximumLineLength
/**
 * This is used anytime the TCP proxy for incoming connections cannot connect
 * to the portNumber set in
 * {@link module:WifiBasedNativeMock~MobileCallInstance.startUpdateAdvertisingAndListening}.
 *
 * @public
 * @param {module:thaliMobileNative~incomingConnectionToPortNumberFailedCallback} callback
 */
// jscs:enable maximumLineLength
MobileCallInstance.prototype.incomingConnectionToPortNumberFailed =
function (callback) {
  incomingConnectionToPortNumberFailedCallback = callback;
};

var multiConnectResolvedCallbackHandler = function() {};
/**
 * {@link module:WifiBasedNativeMock~MobileCallInstance.multiConnectResolved}.
 *
 * @public
 * @param {module:thaliMobileNative~multiConnectResolved} callback
 */
MobileCallInstance.prototype.multiConnectResolved = function (callback) {
  multiConnectResolvedCallbackHandler = callback;
};

var multiConnectConnectionFailureCallbackHandler = function() {};

MobileCallInstance.prototype.multiConnectConnectionFailure =
  function (callback) {
    multiConnectConnectionFailureCallbackHandler = callback;
  };

MobileCallInstance.prototype.registerToNative = function () {
  switch (this.mobileMethodName) {
    case 'peerAvailabilityChanged': {
      return this.peerAvailabilityChanged(arguments[0]);
    }
    case 'discoveryAdvertisingStateUpdateNonTCP': {
      return this.discoveryAdvertisingStateUpdateNonTCP(arguments[0]);
    }
    case 'networkChanged': {
      return this.networkChanged(arguments[0]);
    }
    case 'incomingConnectionToPortNumberFailed': {
      return this.incomingConnectionToPortNumberFailed(arguments[0]);
    }
    case 'multiConnectResolved': {
      return this.multiConnectResolved(arguments[0]);
    }
    case 'multiConnectConnectionFailure': {
      return this.multiConnectConnectionFailure(arguments[0]);
    }
    default: {
      throw new Error('The supplied mobileName does not have a matching ' +
          'registerToNative method: ' + this.mobileMethodName);
    }
  }
};

var doToggle = function (setting, property, callback) {
  var newStatus = setting ? 'on' : 'off';
  if (newStatus === currentNetworkStatus[property]) {
    setImmediate(callback);
    return;
  }
  currentNetworkStatus[property] = newStatus;
  if (property === 'wifi') {
    if (setting) {
      currentNetworkStatus.bssidName = BSSID;
      currentNetworkStatus.ssidName  = SSID;
    } else {
      currentNetworkStatus.bssidName = null;
      currentNetworkStatus.ssidName  = null;
    }
  }

  if (networkChangedCallback !== null) {
    // Record the status on this event loop to make sure
    // the right values are received.
    var statusSnapshot = getCurrentNetworkStatus();
    setImmediate(function () {
      // Inform the listener asynchronously, because this
      // is how the callback would get called on iOS and
      // Android.
      networkChangedCallback(statusSnapshot);
    });
  }
  return setImmediate(callback);
};

// jscs:disable jsDoc
/**
 * This simulates turning Bluetooth on and off.
 *
 * __Open Issue:__ I believe that JXCore will treat this as a NOOP if called
 * on iOS. We need to check and emulate their behavior.
 *
 * @param {module:platform.names} platform
 * @param {ThaliWifiInfrastructure} thaliWifiInfrastructure
 * @returns {Function}
 */
// jscs:enable jsDoc
function toggleBluetooth () {
  return function (setting, callback) {
    if (platform.isIOS) {
      callback(new Error('toggleBluetooth not supported on iOS'));
    }
    doToggle(setting, 'bluetooth', callback);
  };
}

function toggleWiFi () {
  return function (setting, callback) {
    doToggle(setting, 'wifi', callback);
  };
}

function firePeerAvailabilityChanged() {
  return function (peers) {
    peerAvailabilityChangedCallback(peers);
  };
}

function fireIncomingConnectionToPortNumberFailed() {
  return function (portNumber) {
    portNumber = portNumber || incomingConnectionsServer.address().port;
    incomingConnectionToPortNumberFailedCallback(portNumber);
  };
}

function fireDiscoveryAdvertisingStateUpdateNonTCP() {
  return function (discoveryAdvertisingStateUpdateValue) {
    discoveryAdvertisingStateUpdateNonTCPCallback(
      discoveryAdvertisingStateUpdateValue
    );
  };
}

function fireMultiConnectResolved() {
  return function(syncValue, error, listeningPort) {
    multiConnectResolvedCallbackHandler(syncValue, error, listeningPort);
  };
}

function fireMultiConnectConnectionFailure() {
  return function(peerIdentifier, error) {
    multiConnectConnectionFailureCallbackHandler(peerIdentifier, error);
  };
}

// jscs:disable maximumLineLength
/**
 * This is a sleazy trick to let us use this mobile infrastructure when we
 * are testing without the coordinator. We create a server on localhost
 * and pass its port here and have it announce itself with a fake
 * wifiPeerAvailabilityChanged event which then triggers a
 * peerAvailabilityChanged event and lets us connect to that local server.
 *
 * @param {Object} platform
 * @param {module:thaliWifiInfrastructure~ThaliWifiInfrastructure} thaliWifiInfrastructure
 */
// jscs:enable maximumLineLength
function wifiPeerAvailabilityChanged(platform, thaliWifiInfrastructure) {
  return function (peerIdentifier, generation) {
    thaliWifiInfrastructure.emit('wifiPeerAvailabilityChanged',
      {
        peerIdentifier: peerIdentifier,
        hostAddress: '127.0.0.1',
        generation: generation,
        portNumber: thaliWifiInfrastructure.advertisedPortOverride
      });
  };
}

/**
 * To use this mock save the current global object Mobile (if it exists) and
 * replace it with this object. In general this object won't exist on the
 * desktop.
 *
 * @public
 * @constructor
 * @param {module:platform.names} platformName
 * @param {Object} router This is the express router being used up in the
 * stack. We need it here so we can add a router to simulate the iOS case where
 * we need to let the other peer know we want a connection.
 */
function WifiBasedNativeMock(platformName, router) {
  assert(platformName, 'platformName must be set');
  if (!router) {
    router = express.Router();
  }
  // Issue #902
  platform._override(platformName);

  var thaliWifiInfrastructure = new ThaliWifiInfrastructure();
  // In the native side, there is no equivalent for the start call,
  // but it needs to be done once somewhere before calling other functions.
  // In practice, the stop function never gets called, but that is okay
  // for the purpose of this mock Mobile object.
  thaliWifiInfrastructure.start(router);
  setupListeners(thaliWifiInfrastructure);

  var mobileHandler = function (mobileMethodName) {
    return new MobileCallInstance(mobileMethodName, platformName, router,
                                  thaliWifiInfrastructure);
  };

  mobileHandler.toggleBluetooth =
    toggleBluetooth(platformName, thaliWifiInfrastructure);

  mobileHandler.toggleWiFi =
    toggleWiFi(platform, thaliWifiInfrastructure);

  mobileHandler.firePeerAvailabilityChanged =
    firePeerAvailabilityChanged(platformName, thaliWifiInfrastructure);

  mobileHandler.fireIncomingConnectionToPortNumberFailed =
    fireIncomingConnectionToPortNumberFailed(platformName,
                                             thaliWifiInfrastructure);

  mobileHandler.fireDiscoveryAdvertisingStateUpdateNonTCP =
    fireDiscoveryAdvertisingStateUpdateNonTCP(platformName,
                                              thaliWifiInfrastructure);

  mobileHandler.fireMultiConnectResolved =
    fireMultiConnectResolved(platformName, thaliWifiInfrastructure);

  mobileHandler.fireMultiConnectConnectionFailure =
    fireMultiConnectConnectionFailure(platformName, thaliWifiInfrastructure);

  mobileHandler.wifiPeerAvailabilityChanged =
    wifiPeerAvailabilityChanged(platformName, thaliWifiInfrastructure);

  mobileHandler._platform = platformName;

  return mobileHandler;
}

module.exports = WifiBasedNativeMock;
