(function () {
  
  var _peerIdentifierKey = 'PeerIdentifier';
  
  // Peers that we know about.
  var _peers = new Array();
  
  // Peers were synchronizing with.
  var _peersSynchronizing = new Array();

  // Logs in Cordova.
  function logInCordova(text) {
    cordova('logInCordova').call(text);
  };
  
  // Notifies user.
  function notifyUser(title, message) {
    var result;
    cordova('NotifyUser').callNative(title, message, function (value) {
      result = Boolean(value);
    });
    return result;
  };

  // Gets the device name.
  function getDeviceName() {
    var deviceNameResult;
    cordova('GetDeviceName').callNative(function (deviceName) {
      logInCordova('GetDeviceName return was ' + deviceName);
      deviceNameResult = deviceName;
    });      
    return deviceNameResult;
  };
  
  // Gets the peer identifier.
  function getPeerIdentifier() {
    var peerIdentifier;
    cordova('GetKeyValue').callNative(_peerIdentifierKey, function (value) {
      peerIdentifier = value;
      if (peerIdentifier == undefined) {
        cordova('MakeGUID').callNative(function (guid) {
          peerIdentifier = guid;
          cordova('SetKeyValue').callNative(_peerIdentifierKey, guid, function (response) {
            if (!response.result) {
              alert('Failed to save the peer identifier');
            }
          });
        });
      }
    });
    return peerIdentifier;    
  };
  
  // Starts peer communications.
  function startPeerCommunications(peerIdentifier, peerName) {
    var result;
    cordova('StartPeerCommunications').callNative(peerIdentifier, peerName, function (value) {
      result = Boolean(value);
      
      logInCordova('Started peer communications');
      logInCordova('This peer is ' + peerIdentifier);

    });
    return result;
  };

  // Stops peer communications.
  function stopPeerCommunications(peerIdentifier, peerName) {
    cordova('StopPeerCommunications').callNative(function () {});
  };
      
  // Begins connecting to a peer server.
  function beginConnectToPeerServer(peerIdentifier) {
    var result;
    cordova('BeginConnectToPeerServer').callNative(peerIdentifier, function (value) {
      result = Boolean(value);
    });
    return result;
  };

  // Disconnects from a peer server.
  function disconnectFromPeerServer(peerIdentifier) {
    var result;
    cordova('DisconnectFromPeerServer').callNative(peerIdentifier, function (value) {
      result = Boolean(value);
    });
    return result;
  };

  // Register to native for appEnteringBackground.
  cordova('appEnteringBackground').registerToNative(function (callback, args) {
    logInCordova(callback + ' called');
  });

  // Register to native for appEnteredForeground.
  cordova('appEnteredForeground').registerToNative(function (callback, args) {
    logInCordova(callback + ' called');
  });

  // Register to native for logInCordova.
  cordova('logInCordova').registerToNative(function (callback, args) {
    logInCordova(args[0]);
  });

  // Register to native for networkChanged.
  cordova('networkChanged').registerToNative(function (callback, args) {
    logInCordova(callback + ' called');
    var network = args[0];
    logInCordova(JSON.stringify(network));
    
    if (network.isReachable) {
      logInCordova('****** NETWORK REACHABLE');
    } else {
      logInCordova('****** NETWORK NOT REACHABLE');      
    }
  });
    
  // Register to native for peerAvailabilityChanged.
  cordova('peerAvailabilityChanged').registerToNative(function (callback, args) {
    // Process each peer availability change.
    var peers = args[0];
    for (var i = 0; i < peers.length; i++) {
      // Get the peer.
      var peer = peers[i];

      // Log.
      logInCordova(JSON.stringify(peer));
      logInCordova('peerIdentifier: ' + peer.peerIdentifier);
      logInCordova('      peerName: ' + peer.peerName);
      logInCordova(' peerAvailable: ' + peer.peerAvailable);
      
      // Find and replace peer.
      for (var i = 0; i < _peers.length; i++) {
        if (_peers[i].peerIdentifier === peer.peerIdentifier) {
          _peers[i] = peer;
          return;
        }
      }
      
      // If we didn't find peer, add it.
      _peers.push(peer);
    }                             
  });
  
  // Test...
  function makePeerServerDisconnector(peerIdentifier) {
    return function () {
      logInCordova('Peer disconnector called for ' + peerIdentifier);
      disconnectFromPeerServer(peerIdentifier);
    };
  };
  
  // Register to native for connectingToPeerServer.
  cordova('connectingToPeerServer').registerToNative(function (callback, args) {
    var peerIdentifier = args[0];
    logInCordova('    Connecting to peer server ' + peerIdentifier);
  });
  
  // Register to native for connectedToPeerServer.
  cordova('connectedToPeerServer').registerToNative(function (callback, args) {
    var peerIdentifier = args[0];
    logInCordova('    Connected to peer server ' + peerIdentifier);

    setTimeout(makePeerServerDisconnector(peerIdentifier), 30 * 1000);      
  });

  // Register to native for notConnectedToPeerServer.
  cordova('notConnectedToPeerServer').registerToNative(function (callback, args) {
    var peerIdentifier = args[0];
    logInCordova('    Not connected to peer server ' + peerIdentifier);

    for (var i = 0; i < _peersSynchronizing.length; i++) {
      if (_peersSynchronizing[i].peerIdentifier === peerIdentifier) {
        _peersSynchronizing.splice(i, 1);
        return;
      }
    }
  });
  
  // Register to native for peerClientConnecting.
  cordova('peerClientConnecting').registerToNative(function (callback, args) {
    var peerIdentifier = args[0];
    logInCordova('    Peer client connecting ' + peerIdentifier);
  });
  
  // Register to native for peerClientConnected.
  cordova('peerClientConnected').registerToNative(function (callback, args) {
    var peerIdentifier = args[0];
    logInCordova('    Peer client connected ' + peerIdentifier);
  });

  // Register to native for peerClientNotConnected.
  cordova('peerClientNotConnected').registerToNative(function (callback, args) {
    var peerIdentifier = args[0];
    logInCordova('    Peer client not connected ' + peerIdentifier);
  });
  
  // Testing...
  setTimeout(function () {
    notifyUser('Title', 'Message contents.');
    }, 30 * 1000);      

  // Get the peer identifier and peer name.
  var peerIdentifier = getPeerIdentifier();
  var peerName = getDeviceName();
  
  // Start peer communications.
  startPeerCommunications(peerIdentifier, peerName);

    if (peerName === 'DX 2') {
      var peerSyncInterval = setInterval(function () {
        // If we're still synchonizing one or more peers, skip this interval.
        if (_peersSynchronizing.length != 0) {
          logInCordova('peerSync still running');      
          return;
        }
        
        // Start sync.
        logInCordova('peerSync starting');
        for (var i = 0; i < _peers.length; i++) {
          var peer = _peers[i];
    
          if (peer.peerAvailable && beginConnectToPeerServer(peer.peerIdentifier)) {
            _peersSynchronizing.push(peer);        
            logInCordova('    Begin connect to peer server ' + peer.peerIdentifier);
          } else {
            logInCordova("    Can't connect to peer server " + peer.peerIdentifier);        
          }
        }
      }, 10000);
    }
})();
