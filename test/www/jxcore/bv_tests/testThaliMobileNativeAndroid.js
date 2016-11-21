'use strict';

// Issue #419
var ThaliMobile = require('thali/NextGeneration/thaliMobile');
var platform = require('thali/NextGeneration/utils/platform');
if (global.NETWORK_TYPE === ThaliMobile.networkTypes.WIFI ||
    !platform.isAndroid) {
  return;
}

var net = require('net');
var tape = require('../lib/thaliTape');
var makeIntoCloseAllServer = require('thali/NextGeneration/makeIntoCloseAllServer');
var Promise = require('lie');
var thaliMobileNativeTestUtils = require('../lib/thaliMobileNativeTestUtils');

var logger = require('../lib/testLogger')('testThaliMobileNativeAndroid');

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


test('cannot call connect when start listening for advertisements is not ' +
  'active',
  function (t) {
    Mobile('connect').callNative('foo', function (err) {
      t.equal(err, 'startListeningForAdvertisements is not active',
        'got right error');
      t.end();
    });
  });

if (!tape.coordinated) {
  return;
}

test('Get error when trying to double connect to a peer on Android',
  function (t) {
    /*
     We call connect twice in a row synchronously and one should connect and
     the other should get an error
     */
    var completedBadConnectCalls = 0;
    serverToBeClosed = thaliMobileNativeTestUtils.
      getConnectionToOnePeerAndTest(t,
        function (listeningPort, currentTestPeer) {
          function cleanUpFn() {
            ++completedBadConnectCalls;
            if (completedBadConnectCalls === 2) {
              t.end();
            }
          }
          function badConnect() {
            Mobile('connect').callNative(currentTestPeer.peerIdentifier,
              function (err, connection) {
                t.equal(err, 'Already connect(ing/ed)', 'Expected error');
                t.notOk(connection, 'Null connection as expected');
                cleanUpFn();
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

function getMessageAndThen(t, socket, messageToReceive, cb) {
  return thaliMobileNativeTestUtils.
            getMessageByLength(socket, messageToReceive.length)
    .then(function (data) {
      t.ok(Buffer.compare(messageToReceive, data) === 0, 'Data matches');
      return cb();
    })
    .catch(function (err) {
      t.fail(err);
      t.end();
    });
}

function startAndGetConnection(t, server, onConnectSuccess, onConnectFailure) {
  var connecting = false;
  thaliMobileNativeTestUtils.startAndListen(t, server, function (peers) {
    logger.info('Received peerAvailabilityChanged with peers: ' +
      JSON.stringify(peers)
    );
    peers.forEach(function (peer) {
      if (peer.peerAvailable && !connecting) {
        connecting = true;
        var RETRIES = 10;
        thaliMobileNativeTestUtils
          .connectToPeer(peer, RETRIES, onConnectSuccess, onConnectFailure);
      }
    });
  });
}

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

  function onConnectSuccess(err, connection, peer) {
    var gotCloseMessage = false;

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
        closeMessage, peer);
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
    function (connection, testMessage, closeMessage, peer) {
      // Confirm that nobody is listening on the port
      var secondConnectionToListeningPort =
        net.connect(connection.listeningPort, function () {
          t.fail('The port should be closed');
          t.end();
        });
      secondConnectionToListeningPort.on('error', function (err) {
        t.ok(err, 'We got an error which is what we wanted');
        thaliMobileNativeTestUtils.connectToPeer(
          peer, 1,
          function (err) {
            t.notOk(err, 'We should be able to reconnect');
            t.end();
          },
          function (err) {
            t.fail('We should be able to reconnect ' + err);
          }
        );
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
    function (connection, testMessage, closeMessage, peer) {
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

      new Promise(function (resolve, reject) {
        secondConnectionToListeningPort.on('error', function (err) {
          t.ok(err, 'We got an error which is what we wanted');
          thaliMobileNativeTestUtils.connectToPeer(
            peer, 1,
            function (err) {
              resolve(err);
            },
            function (err) {
              reject(err);
            }
          );
        });
        secondConnectionToListeningPort.on('close', function () {
          resolve();
        });
      })
        .then(function (err) {
          t.notOk(err, 'We should be able to reconnect');
          t.end();
        })
        .catch(function (err) {
          t.fail("We should be able to reconnect" + err);
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
