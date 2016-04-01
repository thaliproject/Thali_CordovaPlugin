'use strict';

var net = require('net');
var multiplex = require('multiplex');
var tape = require('../lib/thaliTape');
var ThaliTCPServersManager = require('thali/NextGeneration/mux/thaliTcpServersManager');
var makeIntoCloseAllServer = require('thali/NextGeneration/makeIntoCloseAllServer');
var Promise = require('lie');

// Every call to Mobile trips this warning
/* jshint -W064 */

var serversManager = null;
var applicationServer = null;

var test = tape({
  setup: function (t) {
    function listenError(err) {
      t.fail('could not listen, failed with error - ' + err);
      t.end();
    }
    applicationServer = makeIntoCloseAllServer(net.createServer())
      .listen(0, function () {
        serversManager = new ThaliTCPServersManager(this.address().port);
        applicationServer.removeListener('error', listenError);
        t.end();
      });
    applicationServer.once('error', listenError);
  },
  teardown: function (t) {
    (applicationServer !== null ? applicationServer.closeAllPromise() :
        Promise.resolve())
      .catch(function (err) {
        t.fail('applicationServer had stop err ' + err);
      })
      .then(function () {
        return serversManager !== null && serversManager.stop();
      })
      .catch(function (err) {
        t.fail('serversManager had stop failed ' + err);
      })
      .then(function () {
        t.end();
      });
  }
});

test('calling createNativeListener directly rejects', function (t) {
  serversManager.start()
    .then(function () {
      return serversManager._createNativeListener();
    }).then(function () {
    t.fail('we should have gotten an error');
    t.end();
  }).catch(function (err) {
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
      serversManager.once('incomingConnectionState',
        function (incomingConnectionState) {
          t.ok(incomingConnectionState.state ===
            serversManager.incomingConnectionState.CONNECTED,
            'initial connection state should be CONNECTED');
          serversManager.once('incomingConnectionState',
            function (incomingConnectionState) {
              t.ok(incomingConnectionState.state ===
                serversManager.incomingConnectionState.DISCONNECTED,
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
  var applicationServerPort = applicationServer.address().port;
  applicationServer.closeAllPromise()
    .then(function () {
      applicationServer = null;
      return serversManager.start();
    })
    .then(function (localPort) {
      // Expect the routerPortConnectionFailed event
      serversManager.once(serversManager.ROUTER_PORT_CONNECTION_FAILED,
        function (routerPortConnectionFailed) {
          t.equals(routerPortConnectionFailed.routerPort,
            applicationServerPort, 'tried to connect to right port');
          t.equals(routerPortConnectionFailed.error.errno,
            'ECONNREFUSED', 'failed due to refused connection');
          t.ok(true, 'routerPortConnectionFailed is emitted');
          t.end();
        });

      var client = net.createConnection(localPort, function () {
        var mux = multiplex();
        client.pipe(mux).pipe(client);
        var stream = mux.createStream();
        stream.on('error', function () {});
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
  applicationServer.on('connection', function (client) {
    clientSockets += 1;
    client.pipe(client);
  });

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

        stream1.on('error', function () {});
        stream2.on('error', function () {});
        stream1.on('data', function (data) {
          recvStream1 += data.toString();
          if (recvStream1.length >= toSend) {

            doneStream1 = true;
            t.ok(recvStream1.length === toSend,
              'Send/recvd #1 should be equal length');
            t.ok(recvStream1 === toSend1, 'Send/recvd #1 should be same');

            if (doneStream2) {
              t.ok(clientSockets === 2, 'Should be exactly 2 client sockets');
              t.end();
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
              t.end();
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
    applicationServer.on('connection', function (socket) {
      socket.on('data', function () {
      });
      socket.on('error', function () {

      });
      socket.on('end', function () {
        t.ok(streamClosed, 'socket shouldn\'t close until after stream');
        t.equal(serversManager._nativeServer._incoming.length, 1,
          'incoming remains open');
        t.end();
      });
      streamClosed = true;
      stream.end();
    });

    serversManager.start()
      .then(function (localPort) {
        var incoming = net.createConnection(localPort, function () {
          var mux = multiplex(function onStream() {
          });
          incoming.pipe(mux).pipe(incoming);
          stream = mux.createStream();
          stream.on('error', function () {});
        });
      })
      .catch(function () {
        t.fail('server should not get error - ');
        t.end();
      });
  }
);

test('native server - closing incoming connection cleans outgoing socket',
  function (t) {
    // An incoming socket to native listener creates a mux, each stream created
    // on that mux should create a new outgoing socket. When we close the stream
    // the outgoing socket to the app should get closed.

    // This is different than the previous test in that here we are closing the
    // incoming TCP connection, not the mux behind the stream.

    var incomingClosed = false;
    applicationServer.on('connection', function (socket) {
      socket.on('data', function () {
      });
      socket.on('end', function () {
        t.ok(incomingClosed, 'socket shouldn\'t close until after incoming');
        t.equal(serversManager._nativeServer._incoming.length, 0,
          'incoming is cleaned up');
        t.end();
      });
    });
    serversManager.start()
      .then(function (localPort) {
        var incoming = net.createConnection(localPort, function () {
          var mux = multiplex(function onStream() {
            t.fail('We should not have gotten a stream here');
          });
          mux.on('error', function (err) {
            t.fail(err, 'mux got error');
          });
          incoming.pipe(mux).pipe(incoming);
          var stream = mux.createStream();
          stream.on('error', function () {});
          stream.write(new Buffer('something'), function (err) {
            t.notOk(err, 'we should not have gotten an error');
            incomingClosed = true;
            incoming.destroy();
          });
        });
      })
      .catch(function () {
        t.fail('server should not get error - ');
        t.end();
      });
  });

test('native server - closing outgoing socket cleans associated mux stream',
  function (t) {
    // An incoming socket to native listener creates a mux, each stream created
    // on that mux should create a new outgoing socket. When we close the stream
    // the outgoing socket to the app should get closed.

    var stream = null;
    applicationServer.on('connection', function (socket) {
      socket.end();
    });

    serversManager.start()
      .then(function (localPort) {
        var incoming = net.createConnection(localPort, function () {
          var mux = multiplex(function onStream() {});
          incoming.pipe(mux).pipe(incoming);
          stream = mux.createStream();
          stream.on('error', function () {});
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

test('native server - closing the whole server cleans everything up',
  function (t) {
    var nativeServerClosed = false;
    var allDoneButSocket = false;
    applicationServer.on('connection', function (socket) {
      socket.on('data', function (data) {
        t.ok(Buffer.compare(data, new Buffer('quick test')) === 0,
          'Buffers are identical');
        var nativeServer = serversManager._nativeServer;
        var incoming = nativeServer._incoming[0];
        var incomingMux = incoming._mux;
        var incomingMuxStream = incomingMux._streams[0];
        serversManager.stop()
          .then(function () {
            t.equal(serversManager._nativeServer, null, 'native server is ' +
              'nulled out');
            t.ok(nativeServerClosed, 'native server should be closed');

            t.equal(nativeServer._incoming.length, 0, 'incoming has been ' +
              'removed');

            t.ok(incoming.destroyed, 'Incoming should be done');

            t.ok(incomingMux.destroyed, 'The mux object should be closed');

            t.ok(incomingMuxStream.destroyed,
              'The mux stream should be closed');

            if (socket.destroyed) {
              return t.end();
            }

            // Still waiting for socket to close
            allDoneButSocket = true;
          }).catch(function (err) {
          t.fail(err, 'stop failed when it should not have');
          t.end();
        });
      });
      socket.on('close', function () {
        if (allDoneButSocket) {
          return t.end();
        }
      });
    });
    serversManager.start()
      .then(function (localPort) {
        serversManager._nativeServer.on('close', function () {
          nativeServerClosed = true;
        });
        var incoming = net.createConnection(localPort,
          function () {
            var mux = multiplex(function onStream() {

            });
            mux.on('error',
              function (err) {
                t.fail('mux failed with ' + JSON.stringify(err));
              });
            incoming.pipe(mux).pipe(incoming);
            var stream = mux.createStream();
            stream.on('error', function () {});
            stream.write(new Buffer('quick test'), function (err) {
              t.notOk(err, 'we should not have gotten an error');
            });
          });
      });
  });


test('native server - we can get a ton of connections and data through ' +
  'and still clean up the server completely',
  function (t) {
    // Create multiple connections with multiple streams and make sure they all
    // clean up when we stop the tcpSeversManager

    var numberOfConnections = 10;
    var numberOfStreams = 4;
    var totalConfirmedReads = 0;
    var randomBuffer = new Buffer(10000);
    var nativeServerClosed = false;
    var allDoneButSocketCloses = false;
    var incomingConnections = [];
    var closedSockets = [];
    var shutDownCalled = false;

    function shutDown(failureMessage) {
      if (shutDownCalled) {
        return;
      }

      if (failureMessage) {
        t.fail(failureMessage);
      }

      shutDownCalled = true;
      return t.end();
    }

    applicationServer.on('connection', function (socket) {
      var totalData = new Buffer(0);
      socket.on('data', function (data) {
        totalData = Buffer.concat([totalData, data]);
        if (totalData.length === randomBuffer.length) {
          if (Buffer.compare(totalData, randomBuffer) !== 0) {
            return shutDown('buffers do not equal!');
          }
          ++totalConfirmedReads;
        }

        if (totalData.length > randomBuffer.length) {
          shutDown('buffer length is too long!');
        }

        if (totalConfirmedReads === numberOfConnections * numberOfStreams) {
          var nativeServer = serversManager._nativeServer;
          serversManager.stop()
            .then(function () {
              t.equal(serversManager._nativeServer, null, 'native server is '+
                'nulled out');

              t.ok(nativeServerClosed, 'native server should be closed');

              t.equal(nativeServer._incoming.length, 0, 'incoming has been ' +
                'removed');

              incomingConnections.forEach(function (connection) {
                if (!connection.destroyed) {
                  t.fail('Connect should be done');
                }

                if (!connection.incomingMux.destroyed) {
                  t.fail('The mux object should be closed');
                }

                connection.incomingMuxStreams.forEach(function (stream) {
                  if (!stream.destroyed) {
                    t.fail('all streams are closed');
                  }
                });
              });

              allDoneButSocketCloses = true;
            }).catch(function (err) {
            return shutDown('stop failed when it should not have' + err);
          });
        }
      });
      socket.on('error', function (err) {
        return shutDown('Got error in socket ' + err);
      });
      socket.on('close', function () {
        closedSockets.push(socket);
        if (closedSockets.length === numberOfConnections * numberOfStreams) {
          return shutDown(allDoneButSocketCloses ? null :
            'We did not get all the data before closing.');
        }
      });
    });

    applicationServer.on('error', function (err) {
      shutDown('application server failed with ' + err);
    });

    function connectAndSend(localPort) {
      var incoming = net.createConnection(localPort,
        function () {
          function noError(err) {
            // Don't want to fill logs
            if (err) {
              shutDown('got error on connection ' + err);
            }
          }

          function sendStream(mux) {
            var stream = mux.createStream();
            stream.on('error', function () {
              setTimeout(function () {
                sendStream(mux);
              }, 100);
            });
            if (!stream.write(randomBuffer, noError)) {
              shutDown('write got buffered');
            }
          }

          var mux = multiplex(function onStream() {
            shutDown('we should not have gotten an incoming stream');
          });
          mux.on('error',
            function (err) {
              shutDown('mux failed with ' + JSON.stringify(err));
            });
          incoming.pipe(mux).pipe(incoming);
          for (var i = 0; i < numberOfStreams; ++i) {
            sendStream(mux);
          }
        });
      incoming.setTimeout(1000 * 60 * 10);
      incoming.on('timeout', function () {
        incoming.end();
        shutDown('incoming timed out');
      });
      incoming.on('error', function () {
        setTimeout(function () {
          connectAndSend(localPort);
        }, 100);
      });
    }

    serversManager.on('incomingConnectionState',
      function (incomingConnectionState) {
        if (incomingConnectionState.state ===
          serversManager.incomingConnectionState.DISCONNECTED) {
          return;
        }
        var connection = incomingConnectionState.incomingConnectionId;
        incomingConnections.push(connection);
        // Keeps state around even after server cleans it up
        connection.incomingMux = connection._mux;
        connection.incomingMuxStreams = [];
        connection.incomingMux.on('stream', function (stream) {
          connection.incomingMuxStreams.push(stream);
        });
      });

    serversManager.start()
      .then(function (localPort) {
        serversManager._nativeServer.on('close', function () {
          nativeServerClosed = true;
        });
        for (var i = 0; i < numberOfConnections; ++i) {
          connectAndSend(localPort);
        }
      });
  });


function causeDisaster(t, disasterFn) {
  var nativeServerClosed = false;

  var nativeServer = null;
  var incoming = null;
  var incomingMux = null;
  var incomingMuxStream = null;

  applicationServer.on('connection', function (socket) {
    socket.on('data', function (data) {
      t.ok(Buffer.compare(data, new Buffer('quick test')) === 0,
        'Buffers are identical');
      nativeServer = serversManager._nativeServer;
      incoming = nativeServer._incoming[0];
      incomingMux = incoming._mux;
      incomingMuxStream = incomingMux._streams[0];
      disasterFn(incoming);
      incoming.on('close', function () {
        // This would be closed by the mux so it tells us that the mux
        // cleanup code has run.
        t.ok(serversManager._nativeServer, 'server should be fine');
        t.notOk(nativeServerClosed, 'server should be open');

        t.equal(nativeServer._incoming.length, 0, 'incoming has been ' +
          'removed');

        t.ok(incomingMux.destroyed, 'The mux object should be closed');

        t.ok(incomingMuxStream.destroyed,
          'The mux stream should be closed');

        t.end();
      });
    });
    socket.on('close', function () {

    });
  });

  serversManager.start()
    .then(function (localPort) {
      serversManager._nativeServer.on('close', function () {
        nativeServerClosed = true;
      });
      var incoming = net.createConnection(localPort,
        function () {
          var mux = multiplex(function onStream() {

          });
          mux.on('error',
            function (err) {
              t.fail('mux failed with ' + JSON.stringify(err));
            });
          incoming.pipe(mux).pipe(incoming);
          var stream = mux.createStream();
          stream.on('error', function () {});
          stream.write(new Buffer('quick test'), function (err) {
            t.notOk(err, 'we should not have gotten an error');
          });
        });
    });
}

test('native server - simulate mux failure, make sure everything is cleaned up',
  function (t) {
    // Closing a mux causes its incoming connection to be closed as well as its
    // streams and outgoing connections
    causeDisaster(t, function (incoming) {
      incoming._mux.destroy();
    });
  });

test('native server - timing out the incoming connection cleans everything up',
  function (t) {
    causeDisaster(t, function (incoming) {
      incoming.setTimeout(1);
    });
  });
