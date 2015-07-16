// native & cordova side - bridge between cordova side and native code
// and node.js
(function () {

  /****************************************************************************
  node - TCP/IP server side handling code
  *****************************************************************************/

  var net = require('net');
  var util = require('util');

  var server = 0;
  function startServerSocket(port) {

    if(server != 0){
      server.close();
      server = 0;
    }

    //'connection' listener
    server = net.createServer(function (c) {
      console.log('TCP/IP server connected');

      c.on('end', function () {
        console.log('TCP/IP server is ended');
      });
      c.on('close', function () {
        console.log('TCP/IP server is close');
      });
      c.on('error', function (err) {
        console.log('TCP/IP server got error : ' + err);
      });

      c.on('data', function (data) {
        // BUGBUG: On the desktop this event listener is not necessary. But on JXCore on Android
        // we have to include this handler or no data will ever arrive at the server.
        // Please see https://github.com/jxcore/jxcore/issues/411
        console.log("We received data on the socket the server is listening on - " + data.toString());
        gotMessage("data: " + data.toString());
        c.write("Got data : " + data.toString());
      });

      // when using piping, I don't get 'data' events, and as in debug time I want to log them
      // I'm doing write operations in the data event, instead doing the piping
      // c.pipe(c);
    });

    server.on('error', function (data) {
      console.log("serverSocket error: " + data.toString());
    });
    server.on('close', function () {
      console.log('server socket is disconnected');
    });

    server.listen(port, function() { //'listening' listener
    console.log('server is bound to : ' + port);
  });
}

/****************************************************************************
node - TCP/IP Client socket side handling code
*****************************************************************************/

var clientSocket = 0;
function startClientSocket(port,tmpAddress) {
  if(clientSocket != 0) {
    clientSocket.end();
    clientSocket = 0;
  }

  clientSocket = net.connect(port, function () { //'connect' listener
  peerConnectionStateChanged(tmpAddress,"Connected");
  console.log("We have successfully connected to the server.");
});
clientSocket.on('data', function (data) {
  console.log("clientSocket got data: " + data.toString());
  gotMessage("data: " + data.toString());
});
clientSocket.on('close', function () {
  peerConnectionStateChanged(tmpAddress,"Disconnected");
  console.log('clientSocket is closed');
});

clientSocket.on('error', function(ex) {
  console.log("clientSocket got error : " + ex);
  // we got error, the close should follow automatically.
  // DisconnectPeer(tmpAddress);
});
}
function sendGetRequest(message) {
  clientSocket.write(message);
}

function closeSockets() {
  if(clientSocket != 0){
    clientSocket.end();
    clientSocket = 0;
  }
  if(server != 0){
    server.close();
    server = 0;
  }
}


/****************************************************************************
Native methods
*****************************************************************************/

// Gets the device name. getDeviceName()
Mobile('getDeviceName').registerSync( function() {
  var result;
  Mobile('GetDeviceName').callNative(function (deviceName) {
    logInCordova('GetDeviceName return was ' + deviceName);
    result = deviceName;
  });
  return String(result);
});

// Gets the peer identifier. getPeerIdentifier(peerIdentifierKey)
Mobile('getPeerIdentifier').registerSync(function(peerIdentifierKey) {
  var peerIdentifier;
  Mobile('GetKeyValue').callNative(peerIdentifierKey, function (value) {
    peerIdentifier = value;
    logInCordova("peerIdentifier:"+peerIdentifier);
    if (peerIdentifier == undefined) {
      Mobile('MakeGUID').callNative(function (guid) {
        peerIdentifier = guid;
        Mobile('SetKeyValue').callNative(peerIdentifierKey, guid, function (response) {
          if (!response.result) {
            alert('Failed to save the peer identifier');
          }
        });
      });
    }
  });
  return peerIdentifier;
});

// *Notifies user. function notifyUser(title, message)
Mobile('notifyUser').registerSync(function (title, message) {
  var result;
  Mobile('NotifyUser').callNative(title, message, function (value) {
    result = Boolean(value);
  });
  return result;
});

// Register to native for connectingToPeerServer.
Mobile('connectingToPeerServer').registerToNative(function (args) {
  var peerIdentifier = args;
  logInCordova('    Connecting to peer server ' + peerIdentifier);
});

// Register to native for connectedToPeerServer.
Mobile('connectedToPeerServer').registerToNative(function (args) {
  var peerIdentifier = args;
  logInCordova('    Connected to peer server ' + peerIdentifier);

  //setTimeout(makePeerServerDisconnector(peerIdentifier), 30 * 1000);
});
// Test...
function makePeerServerDisconnector(peerIdentifier) {
  return function () {
    logInCordova('Peer disconnector called for ' + peerIdentifier);
    Mobile('Disconnect').call(peerIdentifier); //disconnectFromPeerServer(peerIdentifier);
  };
};

// Register to native for notConnectedToPeerServer.
Mobile('notConnectedToPeerServer').registerToNative(function (args) {
  var peerIdentifier = args;
  logInCordova('    Not connected to peer server ' + peerIdentifier);

  for (var i = 0; i < _peersSynchronizing.length; i++) {
    if (_peersSynchronizing[i].peerIdentifier === peerIdentifier) {
      _peersSynchronizing.splice(i, 1);
      return;
    }
  }
});

// Register to native for peerClientConnecting.
Mobile('peerClientConnecting').registerToNative(function (args) {
  var peerIdentifier = args;
  logInCordova('    Peer client connecting ' + peerIdentifier);
});

// Register to native for peerClientConnected.
Mobile('peerClientConnected').registerToNative(function (args) {
  var peerIdentifier = args;
  logInCordova('    Peer client connected ' + peerIdentifier);
});

// Register to native for peerClientNotConnected.
Mobile('peerClientNotConnected').registerToNative(function (args) {
  var peerIdentifier = args;
  logInCordova('    Peer client not connected ' + peerIdentifier);
});

/****************************************************************************
API for Cordova (story -1)
*****************************************************************************/

// Starts peer communications. Was StartConnector / startPeerCommunications(peerIdentifier, peerName)
Mobile('StartBroadcasting').registerAsync(function (peerIdentifier, peerName) {
  startServerSocket(0); // start server with port zero so it will get new port for us.
  serverport = server.address().port;
  logInCordova("@server listens port :" + serverport);
  var result;
  Mobile('StartPeerCommunications').callNative(peerIdentifier, peerName, function (value) {
    result = Boolean(value);
    logInCordova('Started peer communications');
    logInCordova('This peer is ' + peerIdentifier);
  });
  return result;
}); // requires: networkChanged, peerAvailabilityChanged

// Stops peer communications. was StopConnector / stopPeerCommunications(peerIdentifier, peerName)
Mobile('StopBroadcasting').registerAsync(function (peerIdentifier, peerName) {
  logInCordova('StopPeerCommunications');
  Mobile('StopPeerCommunications').callNative(function () {
  });
  closeSockets(); // jukka
});

//*
// Begins connecting to a peer server. was beginConnectToPeerServer(peerIdentifier)
Mobile('Connect').registerAsync(function (peerIdentifier) {
  var result;
  Mobile('BeginConnectToPeerServer').callNative(peerIdentifier, function (value) {
    result = Boolean(value);
  });
  return result;
});

// Disconnects from a peer server. was disconnectFromPeerServer(peerIdentifier)
Mobile('Disconnect').registerAsync(function (peerIdentifier) {
  var result;
  Mobile('DisconnectFromPeerServer').callNative(peerIdentifier, function (value) {
    result = Boolean(value);
  });
  return result;
});
//*/

// GetDeviceName
// GetKeyValue
// SetKeyValue
// MakeGUID
// GetFreePort 

/****************************************************************************
Registered event handlers
*****************************************************************************/

// Register to native for networkChanged.
Mobile('networkChanged').registerToNative(function (args) {
  print(args, 'networkChanged'); // { isReachable: true, isWiFi: true }
  var network = args; //JSON.parse(args); // SyntaxError: JSON.parse: unexpected character at line 1 column 2 of the JSON data
  if (network.isReachable) {
    logInCordova('****** NETWORK REACHABLE');
  } else {
    logInCordova('****** NETWORK NOT REACHABLE');
  }
});

var _peers = []; // Peers that we know about.
var _peersSynchronizing = []; // Peers we are synchronizing with.
// Register to native for peerAvailabilityChanged.
Mobile('peerAvailabilityChanged').registerToNative(function (args) {
  print(args, 'peerAvailabilityChanged'); // [ { peerIdentifier: '4A1DF264-EA0A-49E3-A28C-517BC970D393', peerName: 'iPhone5S', peerAvailable: true } ]
  var peers = args; // JSON.parse(args) // unexpected character at line 1 column 2 of the JSON data
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
  // peer list is handled in cordova app, so we simply forward it there
  if (isFunction(peerChangedCallback)) {
    nslog("call peerChangedCallback...");
    peerChangedCallback(_peers); // args
  } else {
    nslog("peerChangedCallback not set!");
  }
});

var peerChangedCallback;// calls cordova callback function
Mobile('setPeerChangedCallback').registerAsync(function (callback) {
  console.log("setConnectionStatusCallback");
  peerChangedCallback = callback;
});

var peerConnectionStatusCallback;// calls cordova callback function
Mobile('setConnectionStatusCallback').registerAsync(function (callback) {
  console.log("setConnectionStatusCallback");
  peerConnectionStatusCallback = callback;
});

Mobile('appEnteringBackground').registerToNative(function (args) {
  logInCordova('App entering background.');
});

// Register to native for appEnteredForeground.
Mobile('appEnteredForeground').registerToNative(function (args) {
  logInCordova('App entered foreground.');
});

// jukka
/*
var peerConnectionStatusCallback;
//*/

/****************************************************************************
Helpers
*****************************************************************************/

function isFunction(functionToCheck) {
  var getType = {};
  return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
}

// jxcore helper functions
function logInCordova(message) {
  //console.log("logInCordova -> " + message);
  Mobile('logInCordova').call(message);
}

function nslog(message) {
  console.log(message);
}

// print json of [object Object]
function print(object, message) {
  //console.log( "@"+ JSON.stringify(object,null,2) ); // "\t" or no. of spaces
  //console.log( object.toSource() ); // firefox only
  console.log( message +"\n"+ util.inspect(object) ); // nodejs
}

//
// cordova->jxcore helper functions.
//

// nslog(message)
Mobile('nslog').registerSync( function(message) {
  nslog(message); //console.log(message);
});

Mobile('print').registerSync( function(object, message) {
  print(object, message)
});

//
// jxcore->cordova helper functions. (shares functions in 'thali_main.js')
//

function alert(message) {
  Mobile('alert').call(message);
}

console.log("//app.js end"); //alert("app.js end");
})();
