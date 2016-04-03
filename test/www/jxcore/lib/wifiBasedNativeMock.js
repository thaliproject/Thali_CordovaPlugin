'use strict';

var Promise = require('lie');
var EventEmitter = require('events').EventEmitter;
var uuid = require('node-uuid');
var express = require('express');
var assert = require('assert');
var net = require('net');
var makeIntoCloseAllServer = require('thali/NextGeneration/makeIntoCloseAllServer');
var logger = require('thali/thalilogger')('wifiBasedNativeMock');

var proxyquire = require('proxyquire');
proxyquire.noPreserveCache();

var mockEmitter = new EventEmitter();
var networkStatusCalled = false;

var peerConnections = {};
var peerProxyServers = {};
var peerProxySockets = {};

var peerAvailabilityChangedCallback = null;
var peerAvailabilities = {};

/**
 * Enum to describe the platforms we can simulate, this mostly controls how we
 * handle connect
 *
 * @public
 * @readonly
 * @enum {string}
 */
var platformChoice = {
  ANDROID: 'Android',
  IOS: 'iOS'
};

var currentNetworkStatus = {
  wifi: 'on',
  bluetooth: 'on',
  bluetoothLowEnergy: 'doNotCare',
  cellular: 'doNotCare'
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
      '@noCallThru': true
    },
    './thaliConfig': {
      // Use a unique NT for messaging between mock code so
      // that the SSDP traffic doesn't get mixed up with real
      // Thali messaging (for example, if in a desktop test,
      // the native and Wifi layers are run simultaneously).
      SSDP_NT: 'http://www.thaliproject.org/mock'
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
 */

/**
 * This is the method that actually handles processing the native requests. In
 * general this method just records the arguments for later use.
 *
 * @param {string} mobileMethodName This is the name of the method that was
 * passed in on the mobile object
 * @param {platformChoice} platform
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
  function (callback) {// jscs:ignore disallowUnusedParams
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
  function (callBack) {// jscs:ignore disallowUnusedParams
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
 * external:"Mobile('startUpdateAdvertisingAndListening')".ca
 * llNative}. That includes returning the "Call Start!" error as appropriate as
 * well as returning "Radio Turned Off" if we are emulating Bluetooth as being
 * off.
 *
 * @param {number} portNumber
 * @param {module:thaliMobileNative~ThaliMobileCallback} callback
 */
MobileCallInstance.prototype.startUpdateAdvertisingAndListening =
  function (portNumber, callback) {// jscs:ignore disallowUnusedParams
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
    incomingConnectionsServer = makeIntoCloseAllServer(
      net.createServer(function (socket) {
        var proxySocket = net.connect(portNumber, function () {
          logger.debug('proxy socket connected');
        });

        proxySocket.on('error', function (err) {
          logger.debug('error on proxy socket - ' + err);
        });

        proxySocket.on('close', socket.destroy);

        proxySocket.pipe(socket).pipe(proxySocket);

        socket.on('error', function (err) {
          logger.debug('error on socket - ' + err);
        });

        socket.on('close', proxySocket.destroy);
      }));

    incomingConnectionsServer.listen(0, function () {
      self.thaliWifiInfrastructure.advertisedPortOverride =
        incomingConnectionsServer.address().port;
      doStart();
    });
    
    incomingConnectionsServer.on('error', function (err) {
      logger.debug('got error on incoming connection server ' + err);
    });
  }
};

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
  function (callBack) {// jscs:ignore disallowUnusedParams
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
        var peerProxyServer = peerProxyServers[peerIdentifier];
        peerProxyServerClosePromises.push(peerProxyServer.closeAll());
        delete peerProxyServers[peerIdentifier];
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
 * On iOS we need the same behavior as Android plus we have to deal with the
 * MCSession problem. This means we have to look at the peerIdentifier, compare
 * it to the peerIdentifier that we generated at the SSDP layer and do a lexical
 * comparison. If we are lexically smaller then we have to simulate the trick
 * that iOS uses where we create a MCSession but don't establish any connections
 * over it. The MCSession is just used as a signaling mechanism to let the
 * lexically larger peer know that the lexically smaller peer wants to connect.
 * See the sections below on /ConnectToMeForMock and /IConnectedMock for
 * details.
 *
 * ## Making requests to /ConnectToMeForMock
 *
 * After we receive a connect when we are simulating iOS and the requester is
 * lexically smaller than the target peerIdentifier then we MUST make a GET
 * request to the target peer's /ConnectToMeForMock endpoint with a query
 * argument of the form "?port=x&peerIdentifier=y". The port is the port the
 * current peer wishes the target peer to connect over and the peerIdentifier is
 * the current peer's peerIdentifier.
 *
 * If we get a 400 response then we MUST return the "Connection could not be
 * established" error.
 *
 * If we get a 200 OK then we just have to wait for a /IConnectedMock request
 * to come in telling us that the remote peer has established a connection. See
 * the section below on how we handle this. Note that the usual timeout rules
 * apply so if the /IConnectedMock request does not come within the timeout
 * period the we MUST issue a "Connection wait time out" error.
 *
 * We do not include IP addresses in the request or response because we are
 * only running the mock amongst instances that are all hosted on the same box
 * and talking over 127.0.0.1.
 *
 * ## Sending responses to /ConnectToMeForMock
 *
 * If we are not currently simulating an iOS device then we MUST return a 500
 * Server Error because something really bad has happened. We do not currently
 * support simulating mixed scenarios, everyone in the test run needs to be
 * either simulating iOS or Android.
 *
 * If we are not currently listening for incoming connections then we MUST
 * return a 400 Bad Request. But we MUST also log the fact that this happened
 * since baring some nasty race conditions we really shouldn't get a call to
 * this endpoint unless we are listening.
 *
 * If we are listening then we MUST issue a peerAvailabilityChanged callback
 * and set the peerIdentifier to the value in the query argument, peerAvailable
 * to true and pleaseConnect to true. We MUST also record the port in the query
 * argument so that if we get a connect request we know what port to submit.
 *
 * In theory it's possible for us to get into a situation where we get one
 * port for a peerIdentifier in the /ConnectToMeForMock request and a different
 * port in a SSDP request. We should just publish the PeerAvailablityChanged
 * event as they come in and for internal mapping of peerIdentifier to port we
 * should just record whatever came in last. And yes, this can lead to fun race
 * conditions which is the situation in the real world too.
 *
 * ## Making requests to /IConnectedMock
 *
 * If we are simulating iOS and if we are establishing a TCP connection to a
 * remote peer then by definition we are the lexically larger peer. However the
 * iOS protocol shares our peerIdentifier with the remote peer, TCP does not. To
 * work around this anytime we are simulating iOS and have successfully
 * established a TCP connection to a remote peer we MUST issue a GET request to
 * the /IConnectedMock endpoint of the remote peer with the query string
 * "?clientPort=x&serverPort=z&peerIdentifier=y". The clientPort and serverPort
 * are the client port and server port values from the TCP connection that
 * caused us to send this request in the first place. The peerIdentifier is our
 * peerIdentifier. If we get a 400 response back then we MUST log this event as
 * it really should not have happened.
 *
 * ## Sending response to /IConnectedMock
 *
 * If we are not currently simulating an iOS device then we MUST return a 500
 * Server Error because something really bad has happened. We do not currently
 * support simulating mixed scenarios, everyone in the test run needs to be
 * either simulating iOS or Android.
 *
 * If we are not currently listening for incoming connections then we MUST
 * return a 400 Bad Request. But we MUST also log the fact that this happened
 * since baring some nasty race conditions we really shouldn't have been able to
 * set up the TCP connection in the first place.
 *
 * Otherwise we MUST return a 200 OK.
 *
 * When we return a 200 OK we MUST issue a peerAvailabilityChanged callback
 * with peerIdentifier set to the submitted peerIdentifier, peerAvailable set to
 * true and pleaseConnect set to false. If we have an outstanding connect
 * request to the specified peerIdentifier then we MUST look up the specified
 * clientPort/serverPort and see if we can match it to any of the incoming
 * connections to the TCP proxy. If we can then we MUST return the
 * clientPort/serverPort being used by the TCP proxy as the connect response
 * with listeningPort set to null and clientPort/serverPort set to the values
 * the TCP proxy is using. If we cannot match the connection via the TCP proxy
 * then this means that the connection might have died or been killed while this
 * request to /IConnectedMock was being sent. In that case we should send bogus
 * values in the connect response to simulate a situation where a peer connects
 * but then the connection dies before the connect callback is returned.
 *
 * @param {string} peerIdentifier
 * @param {module:thaliMobileNative~ConnectCallback} callback
 */
// jscs:enable jsDoc
MobileCallInstance.prototype.connect = function (peerIdentifier, callback) {
  if (!startListeningForAdvertisementsIsActive) {
    return callback('startListeningForAdvertisements is not active');
  }
  
  function returnSuccessfulConnectResponse() {
    var server = peerProxyServers[peerIdentifier];
    
    if (!server || !server.address())  {
      return callback('Server was either closed or is not yet listening');
    }
    
    callback(null, JSON.stringify({
      listeningPort: peerProxyServers[peerIdentifier].address().port,
      clientPort: 0,
      serverPort: 0
    }));
    
    setTimeout(function () {
      if (!peerProxySockets[peerIdentifier]) {
        // Either the code that called connect didn't connect within the allowed
        // window or the server already failed.
        cleanProxyServer();
      }
    }, 2000);
  }
  
  var cleanProxyServerCalled = false;
  function cleanProxyServer() {
    if (cleanProxyServerCalled) {
      return;
    }
    cleanProxyServerCalled = true;
    peerConnections[peerIdentifier] &&
      peerConnections[peerIdentifier].destroy();
    peerProxySockets[peerIdentifier] &&
      peerProxySockets[peerIdentifier].destroy();
    peerProxyServers[peerIdentifier] &&
      peerProxyServers[peerIdentifier].closeAllPromise()
        .then(function () {
          delete peerConnections[peerIdentifier];
          delete peerProxySockets[peerIdentifier];
          delete peerProxyServers[peerIdentifier];
        })
        .catch(function (err) {
          logger.debug('Got error closing server ' + err);
          throw err;
        });
  }

  var peerToConnect = peerAvailabilities[peerIdentifier];
  if (!peerToConnect) {
    setImmediate(function () {
      callback('Connection could not be established');
    });
    return;
  }

  if (peerProxyServers[peerIdentifier]) {
    return callback('Already connect(ing/ed)');
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
        logger.debug('error on peerProxyServers socket for ' + peerIdentifier +
          ', err - ' + err);
      });
      socket.on('close', function () {
        cleanProxyServer();
      });
    }),
    true
  );

  peerProxyServers[peerIdentifier].listen(0, function () {
    peerConnections[peerIdentifier] = net.connect(peerToConnect.portNumber,
      function () {
        setTimeout(function () {
            if (!peerProxyServers[peerIdentifier]) {
              var error = 'Unspecified Error with Radio infrastructure';
              callback(error);
            }
            returnSuccessfulConnectResponse();
          },
          100);
      });
    peerConnections[peerIdentifier].on('end', function () {
      peerConnections[peerIdentifier] &&
        peerConnections[peerIdentifier].end();
    });
    peerConnections[peerIdentifier].on('error', function (err) {
      logger.debug('error on peerConnections socket for ' + peerIdentifier +
        ', err - ' + err);
    });
    peerConnections[peerIdentifier].on('close', function () {
      cleanProxyServer();
    });
  });
  
  peerProxyServers[peerIdentifier].on('close', function () {
    cleanProxyServer();
  });
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
    case 'startListeningForAdvertisements':
    {
      return this.startListeningForAdvertisements(arguments[0]);
    }
    case 'stopListeningForAdvertisements':
    {
      return this.stopListeningForAdvertisements(arguments[0]);
    }
    case 'startUpdateAdvertisingAndListening':
    {
      return this.startUpdateAdvertisingAndListening(
          arguments[0], arguments[1]);
    }
    case 'stopAdvertisingAndListening':
    {
      return this.stopAdvertisingAndListening(
          arguments[0]);
    }
    case 'connect':
    {
      return this.connect(arguments[0], arguments[1]);
    }
    case 'killConnections':
    {
      return this.killConnections(arguments[0]);
    }
    case 'GetDeviceName':
    {
      return this.getDeviceName(arguments[0]);
    }
    case 'didRegisterToNative':
    {
      return this.didRegisterToNative(arguments[0], arguments[1]);
    }
    default:
    {
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
        pleaseConnect: false
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
 * peerIdentifier is the USN from the SSDP message, peerAvailable is true or
 * false based on the SSDP response and pleaseConnect is false except for the
 * situation described above for /ConnectToMeforMock.
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

MobileCallInstance.prototype.registerToNative = function () {
  switch (this.mobileMethodName) {
    case 'peerAvailabilityChanged':
    {
      return this.peerAvailabilityChanged(arguments[0]);
    }
    case 'discoveryAdvertisingStateUpdateNonTCP':
    {
      return this.discoveryAdvertisingStateUpdateNonTCP(arguments[0]);
    }
    case 'networkChanged':
    {
      return this.networkChanged(arguments[0]);
    }
    case 'incomingConnectionToPortNumberFailed':
    {
      return this.incomingConnectionToPortNumberFailed(arguments[0]);
    }
    default:
    {
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
  setImmediate(callback);
};

// jscs:disable jsDoc
/**
 * This simulates turning Bluetooth on and off.
 *
 * If we are emulating Android then we MUST start with Bluetooth and WiFi
 * turned off.
 *
 * __Open Issue:__ I believe that JXCore will treat this as a NOOP if called
 * on iOS. We need to check and emulate their behavior.
 *
 * @param {platformChoice} platform
 * @param {ThaliWifiInfrastructure} thaliWifiInfrastructure
 * @returns {Function}
 */
// jscs:enable jsDoc
function toggleBluetooth () {
  return function (setting, callback) {
    doToggle(setting, 'bluetooth', callback);
  };
}

// jscs:disable jsDoc
/**
 * If we are on Android then then is a NOOP since we don't care (although to
 * be good little programmers we should still fire a network changed event). We
 * won't be using Wifi for discovery or connectivity in the near future.
 *
 * __Open Issue:__ I believe that JXCore will treat this as a NOOP if called
 * on iOS. We need to check and emulate their behavior.
 *
 * @param {platformChoice} platform
 * @param {ThaliWifiInfrastructure} thaliWifiInfrastructure
 * @returns {Function}
 */
// jscs:enable jsDoc
function toggleWiFi() {
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
  return function (peerIdentifier) {
    thaliWifiInfrastructure.emit('wifiPeerAvailabilityChanged',
      {
        peerIdentifier: peerIdentifier,
        hostAddress: '127.0.0.1',
        portNumber: thaliWifiInfrastructure.advertisedPortOverride
      });
  };
}

// jscs:disable jsDoc
/**
 * To use this mock save the current global object Mobile (if it exists) and
 * replace it with this object. In general this object won't exist on the
 * desktop.
 *
 * If we are simulating iOS then we MUST add the /ConnectToMeForMock and
 * /IConnectedMock endpoints as described above to the router object.
 *
 * @public
 * @constructor
 * @param {platformChoice} platform
 * @param {Object} router This is the express router being used up in the
 * stack. We need it here so we can add a router to simulate the iOS case where
 * we need to let the other peer know we want a connection.
 */
// jscs:enable jsDoc
function WifiBasedNativeMock(platform, router) {
  if (!platform) {
    platform = platformChoice.ANDROID;
  }
  if (!router) {
    router = express.Router();
  }
  var thaliWifiInfrastructure = new ThaliWifiInfrastructure();
  // In the native side, there is no equivalent for the start call,
  // but it needs to be done once somewhere before calling other functions.
  // In practice, the stop function never gets called, but that is okay
  // for the purpose of this mock Mobile object.
  thaliWifiInfrastructure.start(router);
  setupListeners(thaliWifiInfrastructure);

  var mobileHandler = function (mobileMethodName) {
    return new MobileCallInstance(mobileMethodName, platform, router,
                                  thaliWifiInfrastructure);
  };

  mobileHandler.toggleBluetooth =
    toggleBluetooth(platform, thaliWifiInfrastructure);

  mobileHandler.toggleWiFi =
    toggleWiFi(platform, thaliWifiInfrastructure);

  mobileHandler.firePeerAvailabilityChanged =
    firePeerAvailabilityChanged(platform, thaliWifiInfrastructure);

  mobileHandler.fireIncomingConnectionToPortNumberFailed =
    fireIncomingConnectionToPortNumberFailed(platform, thaliWifiInfrastructure);

  mobileHandler.fireDiscoveryAdvertisingStateUpdateNonTCP =
    fireDiscoveryAdvertisingStateUpdateNonTCP(platform,
                                              thaliWifiInfrastructure);

  mobileHandler.wifiPeerAvailabilityChanged =
    wifiPeerAvailabilityChanged(platform, thaliWifiInfrastructure);

  return mobileHandler;
}

module.exports = WifiBasedNativeMock;
