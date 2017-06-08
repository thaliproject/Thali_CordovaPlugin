'use strict';

// Issue #419
var ThaliMobile = require('thali/NextGeneration/thaliMobile');

if (global.NETWORK_TYPE === ThaliMobile.networkTypes.WIFI) {
  return;
}

var net = require('net');
var tls = require('tls');
var randomString = require('randomstring');
var thaliConfig = require('thali/NextGeneration/thaliConfig');
var tape = require('../lib/thaliTape');
var makeIntoCloseAllServer = require('thali/NextGeneration/makeIntoCloseAllServer');
var Promise = require('lie');
var assert = require('assert');
var thaliMobileNativeTestUtils = require('../lib/thaliMobileNativeTestUtils');
var thaliMobileNativeWrapper =
  require('thali/NextGeneration/thaliMobileNativeWrapper');
var uuid = require('node-uuid');

var logger = require('../lib/testLogger')('testThaliMobileNative');
var platform = require('thali/NextGeneration/utils/platform');

// jshint -W064

// A variable that can be used to store a server
// that will get closed in teardown.
var serverToBeClosed = null;
var peerIdsToBeClosed = [];

/**
 * @readonly
 * @type {{NOT_CONNECTED: string, CONNECTING: string, CONNECTED: string}}
 */
var connectStatus = {
  NOT_CONNECTED : 'notConnected',
  CONNECTING : 'connecting',
  CONNECTED : 'connected'
};

var test = tape({
  setup: function (t) {
    thaliMobileNativeWrapper._registerToNative();
    serverToBeClosed = {
      closeAll: function (callback) {
        callback();
      }
    };
    t.end();
  },
  teardown: function (t) {
    thaliMobileNativeTestUtils.multiConnectEmitter.removeAllListeners();
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
          if (!platform.isAndroid) {
            peerIdsToBeClosed.forEach(function (peerIdToBeClosed) {
              Mobile('disconnect').callNative(peerIdToBeClosed, function (err) {
                t.notOk(
                  err,
                  'Should be able to call disconnect in teardown'
                );
              });
            });
          }
          peerIdsToBeClosed = [];
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

     var peer = peers[0];
     var keys = Object.keys(peer);
     var expectedKeys = ['peerIdentifier', 'peerAvailable', 'generation'];

     keys.sort();
     expectedKeys.sort();

     t.deepEqual(keys, expectedKeys,
       'peer must have only peerIdentifier, peerAvailable and generation ' +
       'properties');
     t.ok(typeof peer.peerIdentifier === 'string',
       'peerIdentifier must be a string');
     t.ok(typeof peer.generation === 'number',
       'generation must be a number');

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
      thaliMobileNativeTestUtils.getMessageByLength(connection, responseLength)
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

test('Can connect to a remote peer', function (t) {
  var server = net.createServer(function (socket) {
    socket.pipe(socket);
  });
  server = makeIntoCloseAllServer(server);
  serverToBeClosed = server;

  thaliMobileNativeTestUtils.executeZombieProofTest(t, server,
    function (err, connection, peer) {
      // Called if we successfully connect to to a peer
      logger.info(connection);
      peerIdsToBeClosed.push(peer.peerIdentifier);

      t.ok(connection.hasOwnProperty('listeningPort'),
        'Must have listeningPort');
      t.ok(typeof connection.listeningPort === 'number',
        'listeningPort must be a number');

      // A check if any of our old reverse connection or please connect code
      // is still hiding around.
      t.ok(connection.listeningPort !== 0, 'listening port should not be 0');

      t.end();
    });
});

function connect(module, options) {
  return new Promise(function (resolve, reject) {
    var connectErrorHandler = function (error) {
      console.log('Connection to the %d port on localhost failed: %s',
        options.port, error.stack);
      reject(error);
    };
    console.log('Connecting to the localhost:%d', options.port);
    var client = module.connect(options, function () {
      client.removeListener('error', connectErrorHandler);
      console.log('Connected to the localhost:%d', options.port);
      resolve(client);
    });
    client.once('error', connectErrorHandler);
  });
}

function waitForEvent(emitter, event) {
  return new Promise(function (resolve) {
    emitter.once(event, resolve);
  });
}

function shiftData(t, sock, exchangeData) {
  return new Promise(function (resolve, reject) {
    sock.on('error', function (error) {
      console.log('Client socket error:', error.message, error.stack);
      reject(error);
    });

    var receivedData = '';
    sock.on('data', function (chunk) {
      receivedData += chunk.toString();
      if (receivedData === exchangeData) {
        sock.destroy();
      }
    });

    sock.on('close', function () {
      t.equal(receivedData, exchangeData, 'got the same data back');
      resolve();
    });

    var rawData = new Buffer(exchangeData);
    logger.debug('Client sends data (%d bytes):',
      rawData.length);
    sock.write(rawData, function () {
      logger.debug('Client data flushed');
    });
  });
}

function createServer(t, dataLength) {
  return net.createServer(function (socket) {
    var buffer = '';
    socket.on('data', function (chunk) {
      buffer += chunk.toString();
      logger.debug('Server received (%d bytes):', chunk.length);

      // when received all data, send it back
      if (buffer.length === dataLength) {
        logger.debug('Server received all data: %s', buffer);

        var rawData = new Buffer(buffer);
        logger.debug('Server sends data back to client (%d bytes):',
          rawData.length);
        socket.write(rawData, function () {
          logger.debug('Server data flushed');
        });
      }
    });
    socket.on('error', function (error) {
      t.fail(error.message);
    });
  });
}

test('Can shift data', function (t) {
  var exchangeData = 'small amount of data';

  var server = createServer(t, exchangeData.length);
  server = makeIntoCloseAllServer(server);
  serverToBeClosed = server;

  thaliMobileNativeTestUtils.executeZombieProofTest(t, server,
    function (err, connection, peer) {
      peerIdsToBeClosed.push(peer.peerIdentifier);
      var nativePort = connection.listeningPort;

      connect(net, {port: nativePort})
        .then(function (socket) {
          return shiftData(t, socket, exchangeData);
        })
        .catch(t.fail)
        .then(function () {
          t.end();
        });
  });
});

test('Can shift data via parallel connections',
  function () {
    return platform.isAndroid;
  },
  function (t) {
    var dataLength = 16 * 1024;

    var server = createServer(t, dataLength);
    server = makeIntoCloseAllServer(server);
    serverToBeClosed = server;

    thaliMobileNativeTestUtils.executeZombieProofTest(t, server,
      function (err, connection, peer) {
        peerIdsToBeClosed.push(peer.peerIdentifier);
        var nativePort = connection.listeningPort;
        Promise.all([
          connect(net, {port: nativePort}),
          connect(net, {port: nativePort}),
          connect(net, {port: nativePort})
        ]).then(function (sockets) {
          return Promise.all(sockets.map(function (socket) {
            var string = randomString.generate(dataLength);
            t.equal(string.length, dataLength, 'correct string length');
            return shiftData(t, socket, string);
          }));
        })
          .catch(t.fail)
          .then(function () {
            t.end();
          });
      });
  });

test('Can shift data securely', function (t) {
 var exchangeData = 'small amount of data';

 var pskKey = new Buffer('psk-key');
 var pskId = 'psk-id';

 var options = {
   ciphers: thaliConfig.SUPPORTED_PSK_CIPHERS,
   pskCallback: function (id) {
     console.log('Server received psk id: %s', pskId);
     return id === pskId ? pskKey : null;
   }
 };

 var server = tls.createServer(options, function (socket) {
   var ended = false;
   var buffer = '';
   socket.on('data', function (chunk) {
     buffer += chunk.toString();
     logger.debug('Server received (%d bytes):',
       chunk.length);

     // when received all data, send it back
     if (buffer.length === exchangeData.length) {
       logger.debug('Server received all data: %s', buffer);
       var rawData = new Buffer(buffer);
       logger.debug('Server sends data back to client (%d bytes): ',
         rawData.length);
       socket.write(rawData, function () {
         logger.debug('Server data flushed');
       });
       ended = true;
       socket.end(function () {
         logger.debug('Server\'s socket stream finished');
       });
     }
   });
   socket.on('end', function () {
     // server ends connection, not client
     if (!ended) {
       t.fail(new Error('Unexpected end event'));
       return;
     }
     server.emit('CLIENT_DONE');
   });
   socket.on('error', function (error) {
     t.fail(error.message);
   });
 });
 server = makeIntoCloseAllServer(server);
 serverToBeClosed = server;

 function shiftData(sock) {
   sock.on('error', function (error) {
     console.log('Client socket error:', error.message, error.stack);
     t.fail(error.message);
   });

   var receivedData = '';
   sock.on('data', function (chunk) {
     receivedData += chunk.toString();
     if (receivedData === exchangeData) {
       sock.destroy();
     }
   });
   sock.on('close', function () {
     t.equal(receivedData, exchangeData, 'got the same data back');
   });

   var rawData = new Buffer(exchangeData);
   logger.debug('Client sends data (%d bytes):',
     rawData.length);
   sock.write(rawData, function () {
     logger.debug('Client data flushed');
   });
   return waitForEvent(sock, 'close');
 }

  thaliMobileNativeTestUtils.executeZombieProofTest(t, server,
    function (err, connection, peer) {
      peerIdsToBeClosed.push(peer.peerIdentifier);

      return connect(tls, {
        port: connection.listeningPort,
        ciphers: thaliConfig.SUPPORTED_PSK_CIPHERS,
        pskIdentity: pskId,
        pskKey: pskKey
      })
        .then(function (socket) {
          return shiftData(socket);
        })
        .catch(t.fail)
        .then(function () {
          t.end();
        });
 });
});

test('Can shift large amounts of data', function (t) {
 var sockets = {};
 var server = net.createServer(function (socket) {
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
 server = makeIntoCloseAllServer(server);
 serverToBeClosed = server;

 var dataSize = 64 * 1024;
 var toSend = randomString.generate(dataSize);

 function shiftData(sock) {

   sock.on('error', function (error) {
     logger.warn('Error on client socket: ' + error);
     t.fail();
   });

   var toRecv = '';

   var done = false;
   sock.on('data', function (data) {
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

   sock.write(toSend);
 }

  thaliMobileNativeTestUtils.executeZombieProofTest(t, server,
    function (err, connection, peer) {
      var client = null;
      peerIdsToBeClosed.push(peer.peerIdentifier);

      // We're happy here if we make a connection to anyone
      logger.info('Connection info: ' + JSON.stringify(connection));
      client = net.connect(connection.listeningPort, function () {
        logger.info('Connected to the ' + connection.listeningPort);
        shiftData(client);
      });
 });
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
 * @param {Object} t
 * @param {string} uuid
 * @return {boolean}
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
    var error = null;

    t.ok(connection.listeningPort !== 0, 'Just testing if old code managed' +
    ' to hide out');

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
            // 'parsedMessage.uuid' may be already in 'peersWeSucceededWith'.
            // We are just ignoring this case.
            peersWeSucceededWith[parsedMessage.uuid] = true;
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

// We want to know whether all remote participants are sitting in `hashTable`.
function verifyPeers(t, hashTable) {
  var notFoundParticipants = t.participants.filter(function (participant) {
    return !hashTable[participant.uuid];
  });
  // Current local participant should be ignored.
  return (
  notFoundParticipants.length === 1 &&
  notFoundParticipants[0].uuid === tape.uuid
  );
}

function clientRound(t, roundNumber, boundListener, quitSignal) {
  var peersWeAreOrHaveResolved = {};
  var peersWeSucceededWith = {};
  return new Promise(function (resolve, reject) {
    boundListener.listener = function (peers) {
      if (verifyPeers(t, peersWeSucceededWith)) {
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

        peerPromises.push(
          thaliMobileNativeTestUtils.connectToPeer(peer, quitSignal)
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
            })
        );
      });
      Promise.all(peerPromises)
        .then(function () {
          if (verifyPeers(t, peersWeSucceededWith)) {
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
      thaliMobileNativeTestUtils.getMessageByLength(socket, messageLength())
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

test('Test updating advertising and parallel data transfer',
  function () {
    // #984
    // FIXME: fails on 3 devices
    return true;
  },
  function (t) {
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

    Promise.all([
      clientRound(t, 0, boundListener, clientQuitSignal),
      serverRound(t, 0, pretendLocalMux, serverQuitSignal)
    ])
      .then(function () {
        logger.debug('We made it through round one');
        clientQuitSignal = new QuitSignal();
        serverQuitSignal = new QuitSignal();
        return Promise.all([
          clientRound(t, 1, boundListener, clientQuitSignal),
          serverRound(t, 1, pretendLocalMux, serverQuitSignal)
        ]);
      })
      .catch(function (err) {
        t.fail('Got error ' + err);
      })
      .then(function () {
        clearTimeout(timeoutId);
        t.end();
      });

    thaliMobileNativeTestUtils.startAndListen(t, pretendLocalMux,
      function (peers) {
        boundListener.listener(peers);
      }
    );
  });

test('discoveryAdvertisingStateUpdateNonTCP is called', function (t) {
 var callCount = 0;
 Mobile('discoveryAdvertisingStateUpdateNonTCP').registerToNative(
   function (state) {
     callCount++;
     switch (callCount) {
       case 1:
         t.equal(state.discoveryActive, true,
           'discoveryActive should be false');
         t.equal(state.advertisingActive, false,
           'advertisingActive should be true');
         Mobile('startUpdateAdvertisingAndListening').callNative(4242, function (err) {
           t.notOk(err, 'Can call startUpdateAdvertisingAndListening without error');
         });
         break;
       case 2:
         t.equal(state.discoveryActive, true,
           'discoveryActive should be false');
         t.equal(state.advertisingActive, true,
           'advertisingActive should be true');
         Mobile('stopListeningForAdvertisements').callNative(function (err) {
           t.notOk(err, 'Can call stopListeningForAdvertisements without error');
         });
         break;
       case 3:
         t.equal(state.discoveryActive, false,
           'discoveryActive should be false');
         t.equal(state.advertisingActive, true,
           'advertisingActive should be true');
         Mobile('stopAdvertisingAndListening').callNative(function (err) {
           t.notOk(err, 'Can call stopAdvertisingAndListening without error');
         });
         break;
       case 4:
         t.equal(state.discoveryActive, false,
           'discoveryActive should be false');
         t.equal(state.advertisingActive, false,
           'advertisingActive should be true');
         t.end();
         break;
       default:
         break;
     }
   });

 Mobile('startListeningForAdvertisements').callNative(function (err) {
   t.notOk(err, 'Can call startListeningForAdvertisements without error');
 });
});
