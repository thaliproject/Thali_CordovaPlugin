'use strict';

var net = require('net');
var randomstring = require('randomstring');
var tape = require('../lib/thaliTape');
var makeIntoCloseAllServer = require('thali/NextGeneration/makeIntoCloseAllServer');
var logger = require('thali/thaliLogger')('testThaliMobileNative');
var Promise = require('lie');
var assert = require('assert');

// jshint -W064

// A variable that can be used to store a server
// that will get closed in teardown.
var serverToBeClosed = null;

var test = tape({
  setup: function (t) {
    serverToBeClosed = {
      closeAll: function (callback) {
        callback();
      }
    };
    t.end();
  },
  teardown: function (t) {
    serverToBeClosed.closeAll(function () {
      Mobile('stopListeningForAdvertisements').callNative(function (err) {
        t.notOk(
          err,
          'Should be able to call stopListeningForAdvertisements in teardown'
        );
        Mobile('stopAdvertisingAndListening').callNative(function (err) {
          t.notOk(
            err,
            'Should be able to call stopAdvertisingAndListening in teardown'
          );
          t.end();
        });
      });
    });
  }
});

test('Can call start/stopListeningForAdvertisements', function (t) {
  Mobile('startListeningForAdvertisements').callNative(function (err) {
    t.notOk(err, 'Can call startListeningForAdvertisements without error');
    Mobile('stopListeningForAdvertisements').callNative(function (err) {
      t.notOk(err, 'Can call stopListeningForAdvertisements without error');
      t.end();
    });
  });
});

test('Calling startListeningForAdvertisements twice is NOT an error',
function (t) {
  Mobile('startListeningForAdvertisements').callNative(function (err) {
    t.notOk(err, 'Can call startListeningForAdvertisements without error');
    Mobile('startListeningForAdvertisements').callNative(function (err) {
      t.notOk(
        err,
        'Can call startListeningForAdvertisements twice without error'
      );
      t.end();
    });
  });
});

test('Calling stopListeningForAdvertisements without calling start is NOT ' +
  'an error', function (t) {
  Mobile('stopListeningForAdvertisements').callNative(function (err) {
    t.notOk(err, 'Can call stopListeningForAdvertisements without error');
    Mobile('stopListeningForAdvertisements').callNative(function (err) {
      t.notOk(err, 'Can call stopListeningForAdvertisements without error');
      t.end();
    });
  });
});

test('Can call start/stopUpdateAdvertisingAndListening', function (t) {
  Mobile('startUpdateAdvertisingAndListening').callNative(4242, function (err) {
    t.notOk(err, 'Can call startUpdateAdvertisingAndListening without error');
    Mobile('stopAdvertisingAndListening').callNative(function (err) {
      t.notOk(
        err, 'Can call stopAdvertisingAndListening without error'
      );
      t.end();
    });
  });
});

test('Calling startUpdateAdvertisingAndListening twice is NOT an error',
function (t) {
  Mobile('startUpdateAdvertisingAndListening').callNative(4242, function (err) {
    t.notOk(err, 'Can call startUpdateAdvertisingAndListening without error');
    Mobile('startUpdateAdvertisingAndListening').callNative(4243,
    function (err) {
      t.notOk(
        err,
        'Can call startUpdateAdvertisingAndListening twice without error'
      );
      t.end();
    });
  });
});

test('Can call stopUpdateAdvertisingAndListening twice without start and ' +
  'it is not an error', function (t) {
  Mobile('stopAdvertisingAndListening').callNative(function (err) {
    t.notOk(err, 'Can call startUpdateAdvertisingAndListening without error');
    Mobile('stopAdvertisingAndListening').callNative(function (err) {
      t.notOk(err, 'Can call stopAdvertisingAndListening without error');
      t.end();
    });
  });
});

test('cannot call connect when start listening for advertisements is not ' +
  'active', function (t) {
  Mobile('connect').callNative('foo', function (err) {
    t.equal(err, 'startListeningForAdvertisements is not active',
      'got right error');
    t.end();
  });
});

if (!tape.coordinated) {
  return;
}

test('peerAvailabilityChange is called', function (t) {
  var complete = false;
  Mobile('peerAvailabilityChanged').registerToNative(function (peers) {
    if (!complete)
    {
      t.ok(peers instanceof Array, 'peers must be an array');
      t.ok(peers.length !== 0, 'peers must not be zero-length');

      t.ok(peers[0].hasOwnProperty('peerIdentifier'),
        'peer must have peerIdentifier');
      t.ok(typeof peers[0].peerIdentifier === 'string',
        'peerIdentifier must be a string');

      t.ok(peers[0].hasOwnProperty('peerAvailable'),
        'peer must have peerAvailable');
      t.ok(peers[0].hasOwnProperty('pleaseConnect'),
        'peer must have pleaseConnect');

      complete = true;
      t.end();
    }
  });

  Mobile('startUpdateAdvertisingAndListening').callNative(4242, function (err) {
    t.notOk(err, 'Can call startUpdateAdvertisingAndListeningwithout error');
    Mobile('startListeningForAdvertisements').callNative(function (err) {
      t.notOk(err, 'Can call startListeningForAdvertisements without error');
    });
  });
});

function getMessageByLength(socket, lengthOfMessage) {
  return new Promise(function (resolve, reject) {
    var readData = new Buffer(0);
    var dataHandlerFunc = function (data) {
      readData = Buffer.concat([readData, data]);
      if (readData.length >= lengthOfMessage) {
        socket.removeListener('data', dataHandlerFunc);
        if (readData.length === lengthOfMessage) {
          resolve(readData);
        } else {
          reject(new Error('data is too long - ' + readData.length + ', ' +
            'expected - ' + lengthOfMessage));
        }
      }
    };
    socket.on('data', dataHandlerFunc);
  });
}

function getMessageAndThen(t, socket, messageToReceive, cb) {
  return getMessageByLength(socket, messageToReceive.length)
    .then(function (data) {
      t.ok(Buffer.compare(messageToReceive, data) === 0, 'Data matches');
      return cb();
    })
    .catch(function (err) {
      t.fail(err);
      t.end();
    });
}

function connectToPeer(peer, retries, successCb, failureCb, quitSignal) {
  var TIME_BETWEEN_RETRIES = 3000;

  retries--;
  Mobile('connect').callNative(peer.peerIdentifier, function (err, connection) {
    if (quitSignal && quitSignal.raised) {
      successCb(null, null);
    }
    if (err == null) {
      // Connected successfully..
      successCb(err, connection);
    } else {
      logger.info('Connect returned an error: ' + err);

      // Retry a failed connection..
      if (retries > 0) {
        logger.info('Scheduling a connect retry - retries left: ' + retries);
        var timeoutCancel = setTimeout(function () {
          quitSignal && quitSignal.removeTimeout(timeoutCancel);
          connectToPeer(peer, retries, successCb, failureCb);
        }, TIME_BETWEEN_RETRIES);
        quitSignal && quitSignal.addTimeout(timeoutCancel, successCb);
      } else {
        if (failureCb) {
          logger.warn('Too many connect retries!');
          // Exceeded retries..
          failureCb(err, connection);
        }
      }
    }
  });
}

function connectToPeerPromise(peer, retries, quitSignal) {
  return new Promise(function (resolve, reject) {
    connectToPeer(peer, retries, function (err, connection) {
      resolve(connection);
    }, function (err) {
      reject(err);
    }, quitSignal);
  });
}

function connectionDiesClean(t, connection) {
  var errorFired = false;
  var endFired = false;
  var closedFired = false;
  connection.on('error', function () {
    assert(!errorFired, 'On error handle to a socket');

    // if (endFired) {
    //   logger.debug('Got error after end');
    // }

    errorFired = true;
  });
  connection.on('end', function () {
    assert(!endFired, 'One end handle to a socket');
    assert(!errorFired, 'Should not get an end after error');
    endFired = true;
  });
  connection.on('close', function () {
    assert(!closedFired, 'One close to a customer');
    // if (!errorFired && !endFired) {
    //   logger.debug('Got to close without error or end!');
    // }
    // t.ok(errorFired || endFired,
    //   'At least one should fire before we hit close');
    closedFired = true;
  });
}

function connectToListenerSendMessageGetResponseLength(t, port, request,
                                                        responseLength,
                                                        timeout) {
  return new Promise(function (resolve, reject) {
    var dataResult = null;
    var connection = net.connect(port, function () {
      connection.write(request);
      getMessageByLength(connection, responseLength)
        .then(function (data) {
          dataResult = data;
        })
        .catch(function (err) {
          err.connection = connection;
          reject(err);
        });
    });

    function rejectWithError(message) {
      var error = new Error(message);
      error.connection = connection;
      reject(error);
    }

    connectionDiesClean(t,  connection);
    connection.setTimeout(timeout, function () {
      rejectWithError('We timed out');
    });
    connection.on('end', function () {
      if (!dataResult) {
        return rejectWithError('Got end without data result');
      }
      dataResult.connection = connection;
      resolve(dataResult);
    });
    connection.on('error', function (err) {
      rejectWithError('Got error in ' +
        'connectToListenerSendMessageGetResponseAndThen - ' + err);
    });
  });
}

function startAndListen(t, server, peerAvailabilityChangedHandler) {
  server.listen(0, function () {

    var applicationPort = server.address().port;

    Mobile('peerAvailabilityChanged')
      .registerToNative(peerAvailabilityChangedHandler);

    Mobile('startUpdateAdvertisingAndListening').callNative(applicationPort,
      function (err) {
        t.notOk(err,
          'Can call startUpdateAdvertisingAndListening without error');
        Mobile('startListeningForAdvertisements').callNative(function (err) {
          t.notOk(err,
            'Can call startListeningForAdvertisements without error');
        });
      });
  });
}

function startAndGetConnection(t, server, onConnectSuccess, onConnectFailure) {
  var connecting = false;
  startAndListen(t, server, function (peers) {
    logger.info('Received peerAvailabilityChanged with peers: ' +
      JSON.stringify(peers)
    );
    peers.forEach(function (peer) {
      if (peer.peerAvailable && !connecting) {
        connecting = true;
        var RETRIES = 10;
        connectToPeer(peer, RETRIES, onConnectSuccess, onConnectFailure);
      }
    });
  });
}

test('Can connect to a remote peer', function (t) {
  var connecting = false;

  var echoServer = net.createServer(function (socket) {
    socket.pipe(socket);
  });
  echoServer = makeIntoCloseAllServer(echoServer);
  serverToBeClosed = echoServer;

  function onConnectSuccess(err, connection) {

    // Called if we successfully connect to to a peer
    connection = JSON.parse(connection);
    logger.info(connection);

    t.ok(connection.hasOwnProperty('listeningPort'),
      'Must have listeningPort');
    t.ok(typeof connection.listeningPort === 'number',
      'listeningPort must be a number');
    t.ok(connection.hasOwnProperty('clientPort'),
      'Connection must have clientPort');
    t.ok(typeof connection.clientPort === 'number',
      'clientPort must be a number');
    t.ok(connection.hasOwnProperty('serverPort'),
      'Connection must have serverPort');
    t.ok(typeof connection.serverPort === 'number',
      'serverPort must be a number');

    if (connection.listeningPort !== 0)
    {
      // Forward connection
      t.ok(connection.clientPort === 0,
        'forward connection must have clientPort == 0');
      t.ok(connection.serverPort === 0,
        'forward connection must have serverPort == 0');
    }
    else
    {
      // Reverse connection
      t.ok(connection.clientPort !== 0,
        'reverse connection must have clientPort != 0');
      t.ok(connection.serverPort !== 0,
        'reverse connection must have serverPort != 0');
    }

    t.end();
  }

  function onConnectFailure () {
    t.fail('Connect failed!');
    t.end();
  }

  echoServer.listen(0, function () {

    var applicationPort = echoServer.address().port;

    Mobile('peerAvailabilityChanged').registerToNative(function (peers) {
      logger.info('Received peerAvailabilityChanged with peers: ' +
        JSON.stringify(peers)
      );
      peers.forEach(function (peer) {
        if (peer.peerAvailable && !connecting) {
          connecting = true;
          var RETRIES = 10;
          connectToPeer(peer, RETRIES, onConnectSuccess, onConnectFailure);
        }
      });
    });

    Mobile('startUpdateAdvertisingAndListening').callNative(applicationPort,
    function (err) {
      t.notOk(err, 'Can call startUpdateAdvertisingAndListening without error');
      Mobile('startListeningForAdvertisements').callNative(function (err) {
        t.notOk(err, 'Can call startListeningForAdvertisements without error');
      });
    });
  });
});

function getConnectionToOnePeerAndTest(t, connectTest) {
  var echoServer = net.createServer(function (socket) {
    socket.pipe(socket);
  });
  echoServer = makeIntoCloseAllServer(echoServer);
  serverToBeClosed = echoServer;
  var runningTest = false;
  var currentTestPeer = null;
  var failedPeers = 0;
  var maxFailedPeers = 5;


  function tryToConnect() {
    runningTest = true;
    var RETRIES = 10;
    connectToPeerPromise(currentTestPeer, RETRIES)
      .then(function (connectionCallback) {
        connectionCallback = JSON.parse(connectionCallback);
        if (connectionCallback.listeningPort === 0) {
          runningTest = false;
          return;
        }

        connectTest(connectionCallback.listeningPort, currentTestPeer);
      })
      .catch(function () {
        ++failedPeers;
        if (failedPeers >= maxFailedPeers) {
          t.fail('Could not get connection to anyone');
          t.end();
        } else {
          runningTest = false;
        }
      });
  }

  startAndListen(t, echoServer, function (peers) {
    if (runningTest) {
      return;
    }
    for (var i = 0; i < peers.length; ++i) {
      currentTestPeer = peers[i];
      if (!currentTestPeer.peerAvailable) {
        continue;
      }
      tryToConnect();
      break;
    }
  });
}

test('Get error when trying to double connect to a peer', function (t) {
  /*
  We call connect twice in a row synchronously and one should connect and
  the other should get an error
   */
  var successfulFailures = 0;
  getConnectionToOnePeerAndTest(t, function (listeningPort, currentTestPeer) {
    function badConnect() {
      Mobile('connect').callNative(currentTestPeer.peerIdentifier,
        function (err, connection) {
          t.equal(err, 'Already connect(ing/ed)', 'Expected error');
          t.notOk(connection, 'Null connection as expected');
          ++successfulFailures;
          if (successfulFailures === 2) {
            t.end();
          }
        });
    }

    var connection = net.connect(listeningPort,
      function () {
        badConnect();
        badConnect();
      });
    connection.on('error', function (err) {
      t.fail('lost connection because of ' + err);
      t.end();
    });
  });
});

test('Connect port dies if not connected to in time', function (t) {
  /*
  If we don't connect to the port returned by the connect call in time
  then it should close down and we should get a connection error.

  This test should not be ran on Android until #714 is solved (implemented).
   */
  if (jxcore.utils.OSInfo().isAndroid) {
    t.ok(true, 'This test is not ran on Android, since it lacks the timeout implementation');
    t.end();
  } else {
    getConnectionToOnePeerAndTest(t, function (listeningPort) {
      setTimeout(function () {
        var connection = net.connect(listeningPort,
          function () {
            t.fail('Connection should have failed due to time out');
          });
        connection.on('error', function (err) {
          t.equal(err.message, 'connect ECONNREFUSED', 'failed correctly due to' +
            ' refused connection');
          t.end();
        });
      }, 3000);
    });
  }
});

test('Can shift large amounts of data', function (t) {
  var connecting = false;

  var sockets = {};
  var echoServer = net.createServer(function (socket) {
    socket.on('data', function (data) {
      socket.write(data);
    });
    socket.on('end', socket.end);
    socket.on('error', function (error) {
      logger.warn('Error on echo server socket: ' + error);
      t.fail();
    });
    sockets[socket.remotePort] = socket;
  });
  echoServer = makeIntoCloseAllServer(echoServer);
  serverToBeClosed = echoServer;

  var dataSize = 4096;
  var toSend = randomstring.generate(dataSize);

  function shiftData(sock, reverseConnection) {

    sock.on('error', function (error) {
      logger.warn('Error on client socket: ' + error);
      t.fail();
    });

    var toRecv = '';

    if (reverseConnection) {
      // Since this is a reverse connection, the socket we've been handed has
      // already been accepted by our server and there's a client on the other
      // end already sending data.
      // Without multiplex support we can't both talk at the same time so
      // wait for the other side to finish before sending our data.

      var totalRecvd = 0;
      sock.on('data', function (data) {

        logger.info('reverseData');
        totalRecvd += data.length;

        if (totalRecvd === dataSize) {
          logger.info('reverseSend');
          // We've seen all the remote's data, send our own
          sock.write(toSend);
        }

        if (totalRecvd > dataSize) {
          // This should now be our own data echoing back
          toRecv += data.toString();
        }

        if (toRecv.length === dataSize) {
          // Should have an exact copy of what we sent
          t.ok(toRecv === toSend, 'received should match sent reverse');
          t.end();
        }
      });
    }
    else {

      // This one's more straightforward.. we're going to send first,
      // read back our echo and then echo out any extra data

      var done = false;
      sock.on('data', function (data) {

        logger.info('forwardData');

        var remaining = dataSize - toRecv.length;

        if (remaining >= data.length) {
          toRecv += data.toString();
          data = data.slice(0, 0);
        }
        else {
          toRecv += data.toString('utf8', 0, remaining);
          data = data.slice(remaining);
        }

        if (toRecv.length === dataSize) {
          if (!done) {
            done = true;
            t.ok(toSend === toRecv, 'received should match sent forward');
            t.end();
          }
          if (data.length) {
            sock.write(data);
          }
        }
      });

      logger.info('forwardSend');
      sock.write(toSend);
    }
  }

  function onConnectSuccess(err, connection) {

    var client = null;

    // We're happy here if we make a connection to anyone
    connection = JSON.parse(connection);
    logger.info(connection);

    if (connection.listeningPort) {
      logger.info('Forward connection');
      // We made a forward connection
      client = net.connect(connection.listeningPort, function () {
        shiftData(client, false);
      });
    } else {
      logger.info('Reverse connection');
      // We made a reverse connection
      client = sockets[connection.clientPort];
      shiftData(client, true);
    }
  }

  function onConnectFailure() {
    t.fail('Connect failed!');
    t.end();
  }

  Mobile('peerAvailabilityChanged').registerToNative(function (peers) {
    peers.forEach(function (peer) {
      if (peer.peerAvailable && !connecting) {
        connecting = true;
        var RETRIES = 10;
        connectToPeer(peer, RETRIES, onConnectSuccess, onConnectFailure);
      }
    });
  });

  echoServer.listen(0, function () {

    var applicationPort = echoServer.address().port;

    Mobile('startUpdateAdvertisingAndListening').callNative(applicationPort,
    function (err) {
      t.notOk(err, 'Can call startUpdateAdvertisingAndListening without error');
      Mobile('startListeningForAdvertisements').callNative(function (err) {
        t.notOk(err, 'Can call startListeningForAdvertisements without error');
      });
    });
  });
});

function killSkeleton(t, createServerWriteSuccessHandler,
                      getMessageAndThenHandler,
                      connectToListeningPortCloseHandler) {
  var testMessage = new Buffer('I am a test message!');
  var closeMessage = new Buffer('I am closing down now!');

  var pretendLocalMux = net.createServer(function (socket) {
    getMessageAndThen(t, socket, testMessage, function () {
      socket.write(closeMessage, function () {
        createServerWriteSuccessHandler(socket);
      });
    });
  });

  pretendLocalMux.on('error', function (err) {
    logger.debug('got error on pretendLocalMux ' + err);
  });

  pretendLocalMux = makeIntoCloseAllServer(pretendLocalMux);
  serverToBeClosed = pretendLocalMux;

  function onConnectSuccess(err, connection) {
    connection = JSON.parse(connection);
    var gotCloseMessage = false;
    if (connection.listeningPort === 0) {
      // This is a reverse connection, we aren't testing that
      return t.end();
    }

    logger.info('connection ' + JSON.stringify(connection));

    var connectToListeningPort = net.connect(connection.listeningPort,
      function () {
        logger.info('connection to listening port is made');
        connectToListeningPort.write(testMessage);
      });

    getMessageAndThen(t, connectToListeningPort, closeMessage, function () {
      gotCloseMessage = true;
      getMessageAndThenHandler(connectToListeningPort);
    });

    connectToListeningPort.on('error', function (err) {
      t.ok(err, 'We got an error, it can happen ' + err);
    });

    connectToListeningPort.on('close', function () {
      t.ok(gotCloseMessage, 'We got the close message and we are closed');
      connectToListeningPortCloseHandler(connection, testMessage,
                                          closeMessage);
    });
  }

  function onConnectFailure() {
    t.fail('Connect failed');
    t.end();
  }

  startAndGetConnection(t, pretendLocalMux, onConnectSuccess,
    onConnectFailure);
}

function killRemote(t, end) {
  // pretendLocalMux ---> listeningPort ---> remoteServerNativeListener --->
  //   other side's pretendLocalMux
  // We want to show that killing the connection between listeningPort
  // and remoteServerNativeListener will cause the connection between
  // pretendLocalMux and listeningPort to be terminated.
  killSkeleton(t,
    function (socket) {
      socket[end ? 'end' : 'destroy']();
    },
    function () {},
    function (connection) {
      // Confirm that nobody is listening on the port
      var secondConnectionToListeningPort =
        net.connect(connection.listeningPort, function () {
          t.fail('The port should be closed');
          t.end();
        });
      secondConnectionToListeningPort.on('error', function (err) {
        t.ok(err, 'We got an error which is what we wanted');
        t.end();
      });
    });
}

test('#startUpdateAdvertisingAndListening - ending remote peers connection ' +
  'kills the local connection', function (t) {
    killRemote(t, true);
  });

test('#startUpdateAdvertisingAndListening - destroying remote peers ' +
  'connection kills the local connection', function (t) {
  killRemote(t, false);
});

function killLocal(t, end) {
  // pretendLocalMux ---> listeningPort ---> remoteServerNativeListener --->
  //   other side's pretendLocalMux
  // We want to show that killing the connection between pretendLocalMux
  // and listeningPort will cause the connection between
  // listeningPort and remoteServerNativeListener to be terminated.
  killSkeleton(t,
    function () {},
    function (connectToListeningPort) {
      connectToListeningPort[end ? 'end' : 'destroy']();
    },
    function (connection, testMessage, closeMessage) {
      // Confirm that nobody is listening on the port
      var secondConnectionToListeningPort =
        net.connect(connection.listeningPort, function () {
          // In this test there is a race condition where it's possible for us
          // to connect before the listener host doesn't know it should be
          // dead yet. If that happens then we shouldn't be able to send
          // any data.
          secondConnectionToListeningPort.write(testMessage);
          getMessageAndThen(t, secondConnectionToListeningPort, closeMessage,
            function () {
              t.fail('We should never have gotten the second message');
              t.end();
            });
        });
      secondConnectionToListeningPort.on('error', function (err) {
        t.ok(err, 'We got an error which is what we wanted');
      });
      secondConnectionToListeningPort.on('close', function () {
        t.end();
      });
    });
}

test('#startUpdateAdvertisingAndListening - destroying the local connection ' +
  'kills the connection to the remote peer', function (t) {
  killLocal(t, false);
});

test('#startUpdateAdvertisingAndListening - ending the local connection ' +
  'kills the connection to the remote peer', function (t) {
  killLocal(t, true);
});

function findSmallestParticipant(participants) {
  var smallest = null;
  participants.forEach(function (participant) {
    smallest = !smallest ? participant.uuid :
      participant.uuid < smallest ? participant.uuid :
        smallest;
  });
  return smallest;
}

test('We do not emit peerAvailabilityChanged events until one of the start ' +
  'methods is called', function (t) {
  // the node with the smallest UUID will be the one who waits 2 seconds
  // before listening for advertisements and making sure it gets some.
  // Everyone else will just start advertising immediately and end the
  // test (waiting for the smallest peer ID to end when it sees the
  // announcements and thus close)
  var smallest = findSmallestParticipant(t.participants);

  if (tape.uuid !== smallest) {
    Mobile('startListeningForAdvertisements').callNative(function (err) {
      t.notOk(err, 'We should start listening fine');
      Mobile('startUpdateAdvertisingAndListening').callNative(4242,
        function (err) {
          t.notOk(err, 'We should start updating fine');
          t.end();
        });
    });
    return;
  }

  var readyToReceiveEvents = false;
  var gotFirstChanged = false;
  Mobile('peerAvailabilityChanged').registerToNative(function () {
    if (!readyToReceiveEvents) {
      t.fail('We got an availability event too soon');
    } else {
      if (!gotFirstChanged) {
        gotFirstChanged = true;
        // Stop listening, give some time for any in queue ads to drain and
        // then check we aren't getting any further ads
        Mobile('stopAdvertisingAndListening').callNative(function (err) {
          t.notOk(err, 'stop ads worked');
          Mobile('stopListeningForAdvertisements').callNative(function (err) {
            t.notOk(err, 'test stop worked');
            setTimeout(function () {
              readyToReceiveEvents = false;
              setTimeout(function () {
                t.end();
              }, 2000);
            }, 1000);
          });
        });
      }
    }
  });

  setTimeout(function () {
    readyToReceiveEvents = true;
    // Only calling start update for iOS
    Mobile('startUpdateAdvertisingAndListening').callNative(4242,
      function (err) {
        t.notOk(err, 'Ready to advertise');
        Mobile('startListeningForAdvertisements').callNative(function (err) {
          t.notOk(err, 'Ready to listen');
        });
      });
  }, 2000);
});

function QuitSignal() {
  this.raised = false;
  this.timeOuts = [];
  this.cancelCalls = [];
}

QuitSignal.prototype.addCancelCall = function (cancelCall) {
  assert(!this.raised, 'No calling addCancelCall after signal is raised');
  this.cancelCalls.push(cancelCall);
};

QuitSignal.prototype.addTimeout = function (timeOut, successCb) {
  assert(!this.raised, 'No calling addTimeout after signal is raised');
  this.timeOuts.push({ timeOut: timeOut, successCb: successCb});
};

QuitSignal.prototype.removeTimeout = function (timeOut) {
  assert(!this.raised, 'No calling removeTimeout after signal is raised');
  var keys = Object.keys(this.timeOuts);
  for (var i = 0; i < keys.length; ++i) {
    if (this.timeOuts[keys[i]] === timeOut) {
      delete this.timeOuts[keys[i]];
    }
  }
};

QuitSignal.prototype.raiseSignal = function () {
  if (this.raised) {
    return;
  }
  this.raised = true;
  this.timeOuts.forEach(function (timeOutStruct) {
    clearTimeout(timeOutStruct.timeOut);
    timeOutStruct.successCb(null, null);
  });
  this.cancelCalls.forEach(function (cancelCall) {
    cancelCall();
  });
};

function parseMessage(dataBuffer) {
  return {
    uuid: dataBuffer.slice(0, tape.uuid.length).toString(),
    code: dataBuffer.slice(tape.uuid.length, tape.uuid.length + 1).toString(),
    bulkData: dataBuffer.slice(tape.uuid.length + 1)
  };
}

var bulkMessage = new Buffer(100000);
bulkMessage.fill(1);

function messageLength() {
  return tape.uuid.length + 1 + bulkMessage.length;
}

/**
 *
 * @readonly
 * @enum {string}
 */
var protocolResult = {
  /** The sender is not in the same generation as the receiver */
  WRONG_GEN: '0',
  /** The sender is not in the participants list for the receiver */
  WRONG_TEST: '1',
  /** Everything matched */
  SUCCESS: '2',
  /** We got an old advertisement for ourselves! */
  WRONG_ME: '3',
  /** A peer on our list gave us bad syntax, no hope of test passing */
  WRONG_SYNTAX: '4'
};

function createMessage(code) {
  var message =
    Buffer.concat([new Buffer(tape.uuid), new Buffer(code), bulkMessage]);
  assert(message.length === messageLength(), 'Right size message');
  return message;
}

/**
 *
 * @param {Object} t
 * @param {string} uuid
 */
function peerInTestList(t, uuid) {
  for (var i = 0; i < t.participants.length; ++i) {
    if (t.participants[i].uuid === uuid) {
      return true;
    }
  }
  return false;
}

/**
 * @readonly
 * @type {{FATAL: string, NON_FATAL: string, OK: string}}
 */
var validateResponse = {
  FATAL: 'fatal',
  NON_FATAL: 'non-fatal',
  OK: 'ok'
};

function validateServerResponse(t, serverResponse) {
  if (!peerInTestList(t, serverResponse.uuid)) {
    logger.debug('Unrecognized peer at client');
    return validateResponse.NON_FATAL;
  }

  if (Buffer.compare(bulkMessage, serverResponse.bulkData) !== 0) {
    logger.debug('Bulk message is wrong');
    return validateResponse.FATAL;
  }

  switch (serverResponse.code) {
    case protocolResult.WRONG_ME:
    case protocolResult.WRONG_GEN: {
      logger.debug('Survivable response error ' + serverResponse.code);
      return validateResponse.NON_FATAL;
    }
    case protocolResult.WRONG_TEST: // Server is on our list but we aren't on
                                    // its
    case protocolResult.WRONG_SYNTAX: {
      logger.debug('Unsurvivable response error ' + serverResponse.code);
      return validateResponse.FATAL;
    }
    case protocolResult.SUCCESS: {
      return validateResponse.OK;
    }
    default: {
      logger.debug('Got unrecognized result code ' + serverResponse.code);
      return validateResponse.FATAL;
    }
  }
}

function clientSuccessConnect(t, roundNumber, connection, peersWeSucceededWith)
{
  return new Promise(function (resolve, reject) {
    connection = JSON.parse(connection);
    var error = null;

    if (connection.listeningPort === 0) {
      // We couldn't connect but that could be a transient error
      // or this could be iOS in which case we have a problem
      error = new Error('ListeningPort is 0');
      error.fatal = false;
      return reject(error);
    }

    var clientMessage = createMessage(roundNumber.toString());

    connectToListenerSendMessageGetResponseLength(t,
        connection.listeningPort, clientMessage, messageLength(), 10000)
        .then(function (dataBuffer) {
          var connection = dataBuffer.connection;
          var parsedMessage = parseMessage(dataBuffer);
          switch (validateServerResponse(t, parsedMessage)) {
            case validateResponse.NON_FATAL: {
              connection.destroy();
              error = new Error('Got non-fatal error, see logs');
              error.fatal = false;
              return reject(error);
            }
            case validateResponse.OK: {
              peersWeSucceededWith.push(parsedMessage.uuid);
              resolve();
              logger.debug('Response validated, calling connection.end');
              connection.end();
              break;
            }
            default: { // Includes validateResponse.FATAL
              connection.destroy();
              error = new Error('Got fatal error, see logs');
              error.fatal = true;
              return reject(error);
            }
          }
        })
        .catch(function (err) {
          logger.debug('connectToListenerSendMessageGetResponseLength is ' +
            'returning error due to - ' + err + ' in round ' + roundNumber);
          err.connection.destroy();
          err.fatal = false;
          reject(err);
        });
  });
}

function clientRound(t, roundNumber, boundListener, quitSignal) {
  var peersWeAreOrHaveResolved = {};
  var peersWeSucceededWith = [];
  return new Promise(function (resolve, reject) {
    boundListener.listener = function (peers) {
      if (peersWeSucceededWith.length === t.participants.length - 1) {
        return;
      }

      var peerPromises = [];
      peers.forEach(function (peer) {
        if (peersWeAreOrHaveResolved[peer.peerIdentifier]) {
          return;
        }

        if (!peer.peerAvailable) {
          // In theory a peer could become unavailable and then with the same
          // peerID available again so we have to be willing to accept future
          // connections from this peer.
          return;
        }

        peersWeAreOrHaveResolved[peer.peerIdentifier] = true;

        var RETRIES = 10;
        peerPromises.push(connectToPeerPromise(peer, RETRIES, quitSignal)
          .catch(function (err) {
            err.fatal = false;
            return Promise.reject(err);
          })
          .then(function (connection) {
            if (quitSignal.raised) {
              return;
            }
            return clientSuccessConnect(t, roundNumber, connection,
              peersWeSucceededWith);
          })
          .catch(function (err) {
            if (err.fatal) {
              return Promise.reject(err);
            }
            logger.debug('Got recoverable client error ' + err);
            // Failure could be transient so we have to keep trying
            delete peersWeAreOrHaveResolved[peer.peerIdentifier];
            return Promise.resolve();
          }));
      });
      Promise.all(peerPromises)
        .then(function () {
          if (peersWeSucceededWith.length === t.participants.length - 1) {
            quitSignal.raiseSignal();
            resolve();
          }
        })
        .catch(function (err) {
          quitSignal.raiseSignal();
          reject(err);
        });
    };
  });
}

function validateRequest(t, roundNumber, parsedMessage) {
  if (!peerInTestList(t, parsedMessage.uuid)) {
    logger.debug('Unrecognized peer at server');
    return protocolResult.WRONG_TEST;
  }

  if (Buffer.compare(parsedMessage.bulkData, bulkMessage) !== 0) {
    return protocolResult.WRONG_SYNTAX;
  }

  if (parsedMessage.uuid === tape.uuid) {
    return protocolResult.WRONG_ME;
  }

  if (parsedMessage.code !== roundNumber.toString()) {
    return protocolResult.WRONG_GEN;
  }

  return protocolResult.SUCCESS;
}

function serverRound(t, roundNumber, pretendLocalMux, quitSignal) {
  var validPeersForThisRound = [];
  return new Promise(function (resolve, reject) {
    quitSignal.addCancelCall(function () {
      reject();
    });
    var connectionListener = function (socket) {
      connectionDiesClean(t, socket);
      getMessageByLength(socket, messageLength())
        .then(function (dataBuffer) {
          var parsedMessage = parseMessage(dataBuffer);
          var validationResult =
            validateRequest(t, roundNumber, parsedMessage);
          socket.write(createMessage(validationResult), function () {
            logger.debug('serverRound: Message written, closing socket (calling socket.end)');
            socket.end();
          });
          switch (validationResult) {
            case protocolResult.WRONG_SYNTAX: // Usually connection died
            case protocolResult.WRONG_TEST:
            case protocolResult.WRONG_ME:
            case protocolResult.WRONG_GEN: {
              return;
            }
            case protocolResult.SUCCESS: {
              socket.on('end', function () {
                validPeersForThisRound.push(parsedMessage.uuid);
                if (validPeersForThisRound.length === t.participants.length - 1)
                {
                  resolve();
                }
              });
              return;
            }
            default: {
              return reject(new Error('validationResult code ' +
                validationResult));
            }
          }
        })
        .catch(function (err) {
          logger.debug('Got a non-fatal error in server ' + err);
        });
    };
    if (roundNumber === 0) { // 0 round calls start update from startAndListen
      pretendLocalMux.on('connection', connectionListener);
    } else {
      Mobile('startUpdateAdvertisingAndListening').callNative(
        pretendLocalMux.address().port,
        function (err) {
          t.notOk(err, 'Round ' + roundNumber + ' ready');
          if (err) {
            reject(err);
          }
          pretendLocalMux.removeAllListeners('connection');
          pretendLocalMux.on('connection', connectionListener);
        });
    }
  });
}

function setUpPretendLocalMux() {
  var pretendLocalMux = net.createServer();
  pretendLocalMux.on('error', function (err) {
    logger.debug('got error on pretendLocalMux ' + err);
  });

  pretendLocalMux = makeIntoCloseAllServer(pretendLocalMux);
  serverToBeClosed = pretendLocalMux;

  return pretendLocalMux;
}

test('Test updating advertising and parallel data transfer', function (t) {
  var pretendLocalMux = setUpPretendLocalMux();
  var clientQuitSignal = new QuitSignal();
  var serverQuitSignal = new QuitSignal();

  /*
   * Lets us change our listeners for incoming peer events between rounds.
   * This is just to avoid having to set up another emitter
   */
  var boundListener = {
    listener: null
  };

  var timeoutId = setTimeout(function () {
    clientQuitSignal.raiseSignal();
    serverQuitSignal.raiseSignal();
    t.fail('Test timed out');
    t.end();
  }, 60 * 1000);

  Promise.all([clientRound(t, 0, boundListener, clientQuitSignal),
               serverRound(t, 0, pretendLocalMux, serverQuitSignal)])
    .then(function () {
      logger.debug('We made it through round one');
      clientQuitSignal = new QuitSignal();
      serverQuitSignal = new QuitSignal();
      return Promise.all([clientRound(t, 1, boundListener, clientQuitSignal),
                          serverRound(t, 1, pretendLocalMux,
                                      serverQuitSignal)]);
    })
    .catch(function (err) {
      t.fail('Got error ' + err);
    })
    .then(function () {
      clearTimeout(timeoutId);
      t.end();
    });

  startAndListen(t, pretendLocalMux, function (peers) {
    boundListener.listener(peers);
  });
});
