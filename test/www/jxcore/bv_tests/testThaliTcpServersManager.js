'use strict';

var originalMobile = typeof Mobile === 'undefined' ? undefined : Mobile;
var mockMobile = require('../lib/MockMobile');
var net = require('net');
var multiplex = require('multiplex');
var tape = require('../lib/thali-tape');
var ThaliTCPServersManager = require('thali/NextGeneration/mux/thaliTcpServersManager');
var makeIntoCloseAllServer = require('thali/NextGeneration/makeIntoCloseAllServer');
var Promise = require('lie');

// Every call to Mobile trips this warning
/* jshint -W064 */

// Does not currently work in coordinated
// environment, because uses fixed port numbers.
if (tape.coordinated) {
  return;
}

var applicationPort = 4242;
var nativePort = 4040;
var serversManager = null;

var test = tape({
  setup: function (t) {
    global.Mobile = mockMobile;
    serversManager = new ThaliTCPServersManager(applicationPort);
    t.end();
  },
  teardown: function (t) {
    if (serversManager != null) {
      serversManager.stop()
        .catch(function (err) {
          t.fail(err);
          return Promise.resolve();
        }).then(function () {
          global.Mobile = originalMobile;
          t.end();
        });
    } else {
      global.Mobile = originalMobile;
      t.end();
    }
  }
});

test('can create servers manager', function (t) {
  t.ok(serversManager != null, 'serversManager must not be null');
  t.ok(typeof serversManager === 'object', 'serversManager must be an object');
  serversManager = null; // So we don't call stop when we had not called start
  t.end();
});

test('can start/stop servers manager', function (t) {
  serversManager.start()
  .then(function (localPort) {
    t.ok(localPort > 0 && localPort <= 65535, 'port must be in range');
  })
  .then(function () {
    t.end();
  })
  .catch(function (err) {
    t.fail('server should not get error - ' + err);
    t.end();
  });
});

test('starting twice resolves with listening port', function (t) {
  var localPort = null;
  serversManager.start()
  .then(function (localLocalPort) {
    localPort = localLocalPort;
    return serversManager.start();
  }).then(function (port) {
    t.equal(localPort, port, 'second start should return same port');
    t.end();
  }).catch(function (err) {
    t.fail('server should not get error - ' + err);
    t.end();
  });
});

test('calling startNativeListener directly throws', function (t) {
  serversManager.start()
  .then(function () {
    serversManager._createNativeListener();
  }).then(function () {
    t.fail('we should have gotten an error');
    t.end();
  })
  .catch(function (err) {
    t.equal(err.message, 'Don\'t call directly!', 'Should throw');
    t.end();
  });
});

test('emits incomingConnectionState', function (t) {
  // Ensure that dis/connecting to the the localPort of a servers manager
  // emits incomingConnectionState events

  serversManager.start()
  .then(function (localPort) {

    // Expect CONNECTED the DISCONNECTED
    serversManager.once('incomingConnectionState', function (state) {
      t.ok(state === 'CONNECTED',
        'initial connection state should be CONNECTED');
      serversManager.once('incomingConnectionState', function (state) {
        t.ok(state === 'DISCONNECTED',
          'final connection state should be DISCONNECTED');
        t.end();
      });

      // We've had CONNECTED, trigger DISCONNECTED
      client.end();
    });

    var client = net.createConnection(localPort, function () {
    });
  })
  .catch(function (err) {
    t.fail('server should not get error - ' + err);
    t.end();
  });
});

test('emits routerPortConnectionFailed', function (t) {

  // Make the server manager try and connect to a non-existent application

  serversManager.start()
  .then(function (localPort) {

    // Expect the routerPortConnectionFailed event
    serversManager.once('routerPortConnectionFailed', function () {
      t.ok(true, 'routerPortConnectionFailed is emitted');
      t.end();
    });

    var client = net.createConnection(localPort, function () {
      var mux = multiplex();
      client.pipe(mux).pipe(client);
      mux.createStream();
    });
  })
  .catch(function (err) {
    t.fail('server should not get error - ' + err);
    t.end();
  });
});

test('native server connections all up', function (t) {

  // Start the servers manager and then connect muxed sockets directly
  // to it (would normally be done by the p2p layer)

  var clientSockets = 0;
  var applicationServer = net.createServer(function (client) {
    clientSockets += 1;
    client.pipe(client);
  });
  applicationServer = makeIntoCloseAllServer(applicationServer);
  applicationServer.listen(applicationPort);

  serversManager.start()
  .then(function (localPort) {
    var client = net.createConnection(localPort, function () {
      var mux = multiplex();
      client.pipe(mux).pipe(client);
      var stream1 = mux.createStream();
      var stream2 = mux.createStream();

      var toSend = 4096;
      var toSend1 = new Array(toSend + 1).join('1');
      var toSend2 = new Array(toSend + 1).join('2');

      var recvStream1 = '';
      var recvStream2 = '';

      var doneStream1 = false;
      var doneStream2 = false;

      stream1.on('data', function (data) {
        recvStream1 += data.toString();
        if (recvStream1.length >= toSend) {

          doneStream1 = true;
          t.ok(recvStream1.length === toSend,
            'Send/recvd #1 should be equal length');
          t.ok(recvStream1 === toSend1, 'Send/recvd #1 should be same');

          if (doneStream2) {
            t.ok(clientSockets === 2, 'Should be exactly 2 client sockets');
            applicationServer.closeAll(function () {
              t.end();
            });
          }
        }
      });

      stream2.on('data', function (data) {
        recvStream2 += data.toString();
        if (recvStream2.length >= toSend) {

          doneStream2 = true;
          t.ok(recvStream2.length === toSend,
            'Send/recvd #2 should be equal length');
          t.ok(recvStream2 === toSend2, 'Send/recvd #2 should be same');

          if (doneStream1) {
            t.ok(clientSockets === 2, 'Should be exactly 2 client sockets');
            applicationServer.closeAll(function () {
              t.end();
            });
          }
        }
      });

      stream1.write(toSend1);
      stream2.write(toSend2);
    });
  })
  .catch(function (err) {
    t.fail('server should not get error: ', err);
    t.end();
  });
});

test('can call createPeerListener (pleaseConnect === false)', function (t) {
  serversManager.start()
  .then(function () {
    serversManager.createPeerListener('peerId', false)
    .then(function (peerPort) {
      t.ok(peerPort > 0 && peerPort <= 65535, 'port must be in range');
      t.end();
    });
  })
  .catch(function () {
    t.fail('server should not get error');
    t.end();
  });
});

test('calling createPeerListener (pleaseConnect === true) with unknown peer ' +
  'is error',
  function (t) {
    Mobile('connect').nextNative(function (peerIdentifier, cb) {
      cb('Unknown peer', null);
    });

    serversManager.start()
    .then(function () {
      serversManager.createPeerListener('peerId', true)
      .catch(function (err) {
        // Should get an error here, we haven't yet started browsing or
        // discovered any peers
        t.ok(err, 'should get error');
        t.end();
      });
    })
    .catch(function (err) {
      t.fail('server should not get error - ' + err);
      t.end();
    });
  }
);

/*
 //////////////////////////////////////////////////////////////////////////
 Now we get to the complex stuff
 //////////////////////////////////////////////////////////////////////////

 ///////////////////////
 Some utility functions
 */

function waitForPeerAvailabilityChanged(t, serversManager, dontFail, then) {
  Mobile('peerAvailabilityChanged').registerToNative(function (peers) {
    peers.forEach(function (peer) {
      if (peer.peerAvailable) {
        serversManager.createPeerListener(peer.peerIdentifier,
                                          peer.pleaseConnect)
        .then(function (peerPort) {
          if (then) {
            then(peerPort);
          }
        })
        .catch(function (err) {
          if (!dontFail) {
            t.fail('Unexpected rejection creating peer listener' + err);
            console.warn(err);
          }
        });
      }
    });
  });
}

function startAdvertisingAndListening(t, applicationPort, pleaseConnect) {

  Mobile('startUpdateAdvertisingAndListening').callNative(applicationPort,
  function (err) {
    t.notOk(err, 'Can call startUpdateAdvertisingAndListening without error');
    Mobile('startListeningForAdvertisements').callNative(function (err) {
      t.notOk(err, 'Can call startListeningForAdvertisements without error');
      Mobile('peerAvailabilityChanged').callRegistered([{
        peerIdentifier : 'peer1',
        pleaseConnect : pleaseConnect,
        peerAvailable: true
      }]);
    });
  });
}

function startServersManager(t, serversManager) {
  serversManager.start().then(function () {
  })
  .catch(function (err) {
    t.fail('server should not get error: ' + err);
  });
}

function setUp(t, serversManager, appPort, forwardConnection, pleaseConnect,
               dontFail, then) {
  waitForPeerAvailabilityChanged(t, serversManager, dontFail, then);
  startServersManager(t, serversManager);

  if (forwardConnection !== 0) {
    Mobile('connect').nextNative(function (peerIdentifier, cb) {
      cb(null, {listeningPort:forwardConnection, clientPort:0, serverPort:0});
    });
  }
  else {
    Mobile('connect').nextNative(function (peerIdentifier, cb) {
      cb(null, {
        listeningPort:0,
        clientPort:0, serverPort:serversManager._nativeServer.address().port
      });
    });
  }

  startAdvertisingAndListening(t, appPort, pleaseConnect);
}

/*
 End of Utility functions
 /////////////////////////
 */

test('peerListener - forwardConnection, pleaseConnect === true - no native ' +
  'server',
  function (t) {
    var promiseRejected = false;
    var failedConnection = false;

    // We expect 'failedConnection' since there's no native listener
    serversManager.on('failedConnection', function (err) {
      t.equal(err.error, 'Cannot Connect To Peer',
        'reason should be as expected');
      failedConnection = true;
      if (promiseRejected) {
        t.end();
      }
    });

    // Have the next Mobile("connect") call complete with a forward connection
    Mobile('connect').nextNative(function (peerIdentifier, cb) {
      cb(null, {listeningPort:nativePort, clientPort:0, serverPort:0});
    });

    // Promise should be rejected when we fail to open a socket to the native
    // listener
    Mobile('peerAvailabilityChanged').registerToNative(function (peers) {
      peers.forEach(function (peer) {
        if (peer.peerAvailable) {
          serversManager.createPeerListener(peer.peerIdentifier,
                                            peer.pleaseConnect)
          .then(function (peerPort) {
            if (then) {
              then(peerPort);
            }
          })
          .catch(function () {
            t.ok(true, 'Expected a reject');
            promiseRejected = true;
            console.log(serversManager);
            if (failedConnection) {
              t.end();
            }
          });
        }
      });
    });

    startServersManager(t, serversManager);
    startAdvertisingAndListening(t, applicationPort, true);
  }
);

test('peerListener - forwardConnection, pleaseConnect === false - no native ' +
  'server',
  function (t) {
    var firstConnection = false;

    // We expect 'failedConnection' since there's no native listener
    serversManager.on('failedConnection', function (err) {
      t.ok(firstConnection, 'Should not get event until connection is made');
      t.equal(err.error, 'Cannot Connect To Peer',
                'reason should be as expected');
      t.end();
    });

    setUp(t, serversManager, applicationPort, nativePort, false, false,
      function (peerPort) {
        t.notEqual(peerPort, nativePort, 'peerPort should not be nativePort');
        net.createConnection(peerPort);
        firstConnection = true;
      });
  }
);

test('peerListener - forwardConnection, pleaseConnect === true - with native ' +
  'server',
  function (t) {
    var outgoingSocket;
    var serverAccepted = false;
    var clientConnected = false;

    serversManager.on('failedConnection', function () {
      t.fail('Shouldn\'t fail to connect to native listener');
    });

    var nativeServer = net.createServer(function (socket) {
      serverAccepted = true;
      outgoingSocket = socket;
      t.ok(true, 'Should get spontaneous connection');
      if (clientConnected) {
        outgoingSocket.end();
        nativeServer.close();
        t.end();
      }
    });

    nativeServer.listen(nativePort, function (err) {
      if (err) {
        t.fail('nativeServer should not fail');
        t.end();
      }
    });

    setUp(t, serversManager, applicationPort, nativePort, true, false,
      function (peerPort) {
        clientConnected = true;
        t.notEqual(peerPort, nativePort, 'peerPort != nativePort');
        if (serverAccepted) {
          outgoingSocket.end();
          nativeServer.close();
          t.end();
        }
      }
    );
  }
);

test('peerListener - forwardConnection, pleaseConnect === false - with ' +
  'native server',
  function (t) {
    var firstConnection = false;

    serversManager.on('failedConnection', function () {
      t.fail('connection shouldn\'t fail');
    });

    var nativeServer = net.createServer(function (socket) {
      t.ok(firstConnection, 'Should not get unexpected connection');
      t.ok(true, 'Should get connection');
      nativeServer.close();
      socket.end();
      t.end();
    });
    nativeServer.listen(nativePort, function (err) {
      if (err) {
        t.fail('nativeServer should not fail');
        t.end();
      }
    });

    setUp(t, serversManager, applicationPort, nativePort, false, false,
      function (peerPort) {
        t.notEqual(peerPort, nativePort, 'peerPort != nativePort');
        // Need to connect a socket to force the outgoing
        net.createConnection(peerPort);
        firstConnection = true;
      }
    );
  }
);

test('createPeerListener is idempotent', function (t) {
  serversManager.on('failedConnection', function () {
    t.fail('connection shouldn\'t fail');
    t.end();
  });

  waitForPeerAvailabilityChanged(t, serversManager, false, function (peerPort) {
    // Create another peerListener to peer1
    serversManager.createPeerListener('peer1', false)
    .then(function (port) {
      t.equal(peerPort, port,
        'Second call to existing peerListener returns existing port');
      t.end();
    })
    .catch(function (err) {
      t.fail('should not get error - ' + err);
      t.end();
    });
  });

  startServersManager(t, serversManager);
  startAdvertisingAndListening(t, applicationPort, false);
});

test('createPeerListener - pleaseConnect === true, failed connection rejects ' +
  'promise',
  function (t) {
    Mobile('connect').nextNative(function (peerIdentifier, cb) {
      cb('a nasty error', null);
    });

    serversManager.on('failedConnection', function () {
      t.fail('connection shouldn\'t fail');
      t.end();
    });

    Mobile('peerAvailabilityChanged').registerToNative(function (peers) {
      peers.forEach(function (peer) {
        if (peer.peerAvailable) {
          serversManager.createPeerListener(peer.peerIdentifier,
                                            peer.pleaseConnect)
          .then(function () {
            t.fail('should not succeed when connection fails');
            t.end();
          })
          .catch(function (err) {
            t.equal('a nasty error', err,
                    'failed connection should reject with error');
            t.end();
          });
        }
      });
    });

    startServersManager(t, serversManager);
    startAdvertisingAndListening(t, applicationPort, true);
  }
);

test('createPeerListener - pleaseConnect === true, connection resolves promise',
  function (t) {
    Mobile('connect').nextNative(function (peerIdentifier, cb) {
      cb(null, {
        listeningPort:nativePort, clientPort:0, serverPort: 0
      });
    });

    serversManager.on('failedConnection', function () {
      if (!serversManager._closing) {
        t.fail('Shouldn\'t fail to connect to native listener');
        t.end();
      }
    });

    var nativeServer = net.createServer(function (socket) {
      t.ok(true, 'Should get spontaneous connection');
      socket.end();
    });

    nativeServer.listen(nativePort, function (err) {
      if (err) {
        t.fail('nativeServer should not fail');
        t.end();
      }
    });

    Mobile('peerAvailabilityChanged').registerToNative(function (peers) {
      peers.forEach(function (peer) {
        if (peer.peerAvailable) {
          serversManager.createPeerListener(peer.peerIdentifier,
                                            peer.pleaseConnect)
          .then(function () {
            t.ok(true, 'promise should resolve');
            nativeServer.close();
            t.end();
          })
          .catch(function (err) {
            t.fail('should not fail - ' + err);
            nativeServer.close();
            t.end();
          });
        }
      });
    });

    startServersManager(t, serversManager);
    startAdvertisingAndListening(t, applicationPort, true);
  }
);

/*
 reverseConnections
 ///////////////////
 */

test('peerListener - reverseConnection, pleaseConnect === true', function (t) {
  // We expect 'failedConnection' since pleaseConnect should
  // never result in a reverseConnection
  serversManager.on('failedConnection', function (err) {
    t.equal(err.error, 'Cannot Connect To Peer',
      'reason should be as expected');
    t.end();
  });

  // Note: Here we're saying dontFail on createPeerListener rejecting
  // since we expect to fail because of the unexpected reverse connection
  setUp(t, serversManager, applicationPort, 0, true, true, function (peerPort) {
    t.notEqual(peerPort, nativePort, 'peerPort should not be nativePort');
  });
});

test('peerListener - reverseConnection, pleaseConnect === false - no incoming',
  function (t) {
    var firstConnection = false;

    // We expect 'Incoming connction died' since we're forcing a reverse
    // connection but there's been no incoming connection
    serversManager.on('failedConnection', function (err) {
      t.ok(firstConnection, 'should not get event until connection is made');
      t.equal(err.error, 'Incoming connection died',
        'reason should be as expected');
      t.end();
    });

    setUp(t, serversManager, applicationPort, 0, false, false,
      function (peerPort) {
        t.notEqual(peerPort, nativePort, 'peerPort should not be nativePort');
        net.createConnection(peerPort);
        firstConnection = true;
      }
    );
  }
);

test('peerListener - reverseConnection, pleaseConnect === false - with ' +
  'incoming',
  function (t) {
    serversManager.on('failedConnection', function () {
      t.fail('connection shouldn\'t fail');
    });

    // We're going to unroll setUp here 'cause we want to do some
    // funky stuff

    var toSend = 'hello';
    Mobile('connect').nextNative(function (peerIdentifier, cb) {
      // Here we're pretending to be the p2p layer connecting to the
      // servers manager
      var serverPort = serversManager._nativeServer.address().port;
      var incoming = net.createConnection(serverPort, function () {
        var mux = multiplex(function onStream(stream) {
          stream.write(toSend);
        });
        incoming.pipe(mux).pipe(incoming);
        process.nextTick(function () {
          cb(null, {listeningPort:0, clientPort:incoming.address().port,
            serverPort:serverPort});
        });
      });

    });

    waitForPeerAvailabilityChanged(t, serversManager, false,
      function (peerPort) {
        // Create a client connection to our local server, this'll cause the p2p
        // connection to be established. We've arranged for this to result in a
        // reverse connection so when out connection completes we expect there
        // to be a mux available on which we'll create a new stream which we'll
        // pipe to our client socket
        var client = net.createConnection(peerPort, function () {
        });
        var toRecv = '';
        client.on('data', function (data) {
          toRecv += data.toString();
          if (toRecv.length >= toSend.length) {
            t.equal(toSend, toRecv, 'sent and received should be the same');
            t.end();
          }
        });
      }
    );

    startServersManager(t, serversManager);
    startAdvertisingAndListening(t, applicationPort, false);
  }
);

test('peerListener - reverseConnection, pleaseConnect === false - no server',
  function (t) {
    serversManager.on('failedConnection', function () {
      t.fail('connection shouldn\'t fail');
    });

    // We expect the stream created by the incoming socket to
    // trigger routerPortConnection failed since there's no app listening
    serversManager.on('routerPortConnectionFailed', function () {
      t.ok(true, 'should get routerPortConnectionFailed');
      t.end();
    });

    Mobile('connect').nextNative(function (peerIdentifier, cb) {
      var serverPort = serversManager._nativeServer.address().port;
      var incoming = net.createConnection(serverPort, function () {
        var mux = multiplex(function onStream() {
        });
        incoming.pipe(mux).pipe(incoming);
        // Force the other side to connect to it's (non-existent in this case)
        // application server
        mux.createStream();
        process.nextTick(function () {
          cb(null, {listeningPort:0, clientPort:incoming.address().port,
            serverPort:serverPort});
        });
      });
    });

    waitForPeerAvailabilityChanged(t, serversManager, false,
      function (peerPort) {
        net.createConnection(peerPort, function () {});
      }
    );

    startServersManager(t, serversManager);
    startAdvertisingAndListening(t, applicationPort, false);
  }
);

/*
 Check stream error handling
 ////////////////////////////
 */

test('native server - closing incoming stream cleans outgoing socket',
  function (t) {
    // An incoming socket to native listener creates a mux, each stream created
    // on that mux should create a new outgoing socket. When we close the stream
    // the outgoing socket to the app should get closed.

    var stream = null;
    var streamClosed = false;
    var applicationServer = net.createServer(function (socket) {
      socket.on('data', function () {
      });
      socket.on('end', function () {
        t.ok(streamClosed, 'socket shouldn\'t close until after stream');
        t.ok(true, 'socket gets closed when stream is');
        t.equal(serversManager._nativeServer._incoming.length, 1,
                'incoming remains open');
        applicationServer.close();
        t.end();
      });
      streamClosed = true;
      stream.end();
    });
    applicationServer.listen(applicationPort);

    serversManager.start()
    .then(function (localPort) {
      var incoming = net.createConnection(localPort, function () {
        var mux = multiplex(function onStream() {
        });
        incoming.pipe(mux).pipe(incoming);
        stream = mux.createStream();
      });
    })
    .catch(function () {
      t.fail('server should not get error - ');
      t.end();
    });
  }
);

//test('native server - closing incoming connection cleans outgoing socket',
//  function (t) {
//    // An incoming socket to native listener creates a mux, each stream created
//    // on that mux should create a new outgoing socket. When we close the stream
//    // the outgoing socket to the app should get closed.
//
//    // This is different than the previous test in that here we are closing the
//    // incoming TCP connection, not the mux behind the stream.
//
//    var incomingClosed = false;
//    var applicationServer = net.createServer(function (socket) {
//      socket.on('data', function () {
//      });
//      socket.on('end', function () {
//        t.ok(incomingClosed, 'socket shouldn\'t close until after incoming');
//        t.equal(serversManager._nativeServer._incoming.length, 0,
//          'incoming is cleaned up');
//        applicationServer.close();
//        t.end();
//      });
//    });
//    applicationServer.listen(applicationPort, function (err) {
//      t.notOk(err, 'listening should have started without problem');
//      serversManager.start()
//        .then(function (localPort) {
//          var incoming = net.createConnection(localPort, function () {
//            var mux = multiplex(function onStream() {
//            });
//            incoming.pipe(mux).pipe(incoming);
//            var stream = mux.createStream();
//            stream.write(new Buffer('something'), function(err) {
//              t.notOk(err, 'we should not have gotten an error');
//              incomingClosed = true;
//              incoming.destroy();
//            });
//          });
//        })
//        .catch(function () {
//          t.fail('server should not get error - ');
//          t.end();
//        });
//    });
//  }
//);

test('native server - closing incoming stream cleans outgoing socket',
  function (t) {
    // An incoming socket to native listener creates a mux, each stream created
    // on that mux should create a new outgoing socket. When we close the stream
    // the outgoing socket to the app should get closed.

    var stream = null;
    var applicationServer = net.createServer(function (socket) {
      socket.end();
    });
    applicationServer.listen(applicationPort);

    serversManager.start()
    .then(function (localPort) {
      var incoming = net.createConnection(localPort, function () {
        var mux = multiplex(function onStream() {});
        incoming.pipe(mux).pipe(incoming);
        stream = mux.createStream();
        stream.on('data', function () {
          // Need to read data or we never get end
        });
        stream.on('end', function () {
          t.ok(true, 'stream was closed');
          t.equal(serversManager._nativeServer._incoming.length, 1,
            'incoming should survive');
          t.equal(
            serversManager._nativeServer._incoming[0]._mux._streams.length, 0,
            'mux should have no streams');
          applicationServer.close();
          t.end();
        });
      });
    })
    .catch(function () {
      t.fail('server should not get error - ');
      t.end();
    });
  }
);
