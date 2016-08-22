'use strict';

var tape = require('../../../../lib/thaliTape');
if (!tape.coordinated) {
  return;
}

var net = require('net');
var assert = require('assert');
var Promise = require('lie');

var makeIntoCloseAllServer = require('thali/NextGeneration/makeIntoCloseAllServer');
var logger = require('thali/thaliLogger')('testThaliMobileNative');

// jshint -W064

// A variable that can be used to store a server
// that will get closed in teardown.
var serverToBeClosed = null;

var TEST_TIMEOUT = 60 * 1000;

var test = tape({
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    if (serverToBeClosed) {
      serverToBeClosed.closeAll(
        function () {
          Mobile('stopListeningForAdvertisements')
          .callNative(function (err) {
            t.notOk(
              err,
              'Should be able to call stopListeningForAdvertisements in teardown'
            );
            Mobile('stopAdvertisingAndListening')
            .callNative(function (err) {
              t.notOk(
                err,
                'Should be able to call stopAdvertisingAndListening in teardown'
              );
              t.end();
            });
          });
        }
      );
    } else {
      t.end();
    }
  }
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
          reject(new Error(
            'data is too long - ' + readData.length + ', ' +
            'expected - ' + lengthOfMessage
          ));
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
  Mobile('connect')
  .callNative(peer.peerIdentifier, function (err, connection) {
    if (quitSignal && quitSignal.raised) {
      successCb(null, null, peer);
    }
    if (err == null) {
      // Connected successfully.
      successCb(err, connection, peer);
    } else {
      logger.info('Connect returned an error: ' + err);

      // Retry a failed connection.
      if (retries > 0) {
        logger.info('Scheduling a connect retry - retries left: ' + retries);
        var timeoutCancel = setTimeout(function () {
          if (quitSignal) {
            quitSignal.removeTimeout(timeoutCancel);
          }
          connectToPeer(peer, retries, successCb, failureCb);
        }, TIME_BETWEEN_RETRIES);
        if (quitSignal) {
          quitSignal.addTimeout(timeoutCancel, successCb);
        }
      } else {
        if (failureCb) {
          logger.warn('Too many connect retries!');
          // Exceeded retries.
          failureCb(err, connection, peer);
        }
      }
    }
  });
}

function connectToPeerPromise(peer, retries, quitSignal) {
  return new Promise(function (resolve, reject) {
    connectToPeer(
      peer, retries,
      function (err, connection) {
        resolve(connection);
      },
      function (err) {
        reject(err);
      },
      quitSignal
    );
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
  })
  .on('end', function () {
    assert(!endFired, 'One end handle to a socket');
    assert(!errorFired, 'Should not get an end after error');
    endFired = true;
  })
  .on('close', function () {
    assert(!closedFired, 'One close to a customer');
    // if (!errorFired && !endFired) {
    //   logger.debug('Got to close without error or end!');
    // }
    // t.ok(errorFired || endFired,
    //   'At least one should fire before we hit close');
    closedFired = true;
  });
}

function connectToListenerSendMessageGetResponseLength(
  t, port, request, responseLength, timeout
) {
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
    })
    .on('error', function (err) {
      rejectWithError(
        'Got error in ' +
        'connectToListenerSendMessageGetResponseAndThen - ' + err
      );
    });
  });
}

function startAndListen(t, server) {
  server.listen(0, function () {
    var applicationPort = server.address().port;

    Mobile('startUpdateAdvertisingAndListening')
    .callNative(applicationPort, function (err) {
      t.notOk(
        err,
        'Can call startUpdateAdvertisingAndListening without error'
      );
      Mobile('startListeningForAdvertisements')
      .callNative(function (err) {
        t.notOk(
          err,
          'Can call startListeningForAdvertisements without error'
        );
      });
    });
  });
}

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
  var message = Buffer.concat([
    new Buffer(tape.uuid), new Buffer(code), bulkMessage
  ]);
  assert(message.length === messageLength(), 'Right size message');
  return message;
}

/**
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
    case protocolResult.WRONG_TEST: // Server is on our list but we aren't on its
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

function clientSuccessConnect(t, roundNumber, connection, peersWeSucceededWith) {
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

    connectToListenerSendMessageGetResponseLength(
        t,
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
            default: {
              // Includes validateResponse.FATAL
              connection.destroy();
              error = new Error('Got fatal error, see logs');
              error.fatal = true;
              return reject(error);
            }
          }
        })
        .catch(function (err) {
          logger.debug(
            'connectToListenerSendMessageGetResponseLength is ' +
            'returning error due to - ' + err + ' in round ' + roundNumber
          );
          err.connection.destroy();
          err.fatal = false;
          reject(err);
        });
  });
}

// We want to know whether all remote participants are sitting in `hashTable`.
function verifyPeers(t, hashTable) {
  var notFoundParticipants = t.participants.filter(
    function (participant) {
      return !hashTable[participant.uuid];
    }
  );
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
            return clientSuccessConnect(
              t, roundNumber, connection, peersWeSucceededWith
            );
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
      getMessageByLength(socket, messageLength())
        .then(function (dataBuffer) {
          var parsedMessage = parseMessage(dataBuffer);
          var validationResult = validateRequest(
            t, roundNumber, parsedMessage
          );
          socket.write(createMessage(validationResult), function () {
            logger.debug(
              'serverRound: Message written, closing socket (calling socket.end)'
            );
            socket.end();
          });
          switch (validationResult) {
            case protocolResult.WRONG_SYNTAX: // Usually connection died.
            case protocolResult.WRONG_TEST:
            case protocolResult.WRONG_ME:
            case protocolResult.WRONG_GEN: {
              return;
            }
            case protocolResult.SUCCESS: {
              socket.on('end', function () {
                validPeersForThisRound.push(parsedMessage.uuid);
                if (validPeersForThisRound.length === t.participants.length - 1) {
                  resolve();
                }
              });
              return;
            }
            default: {
              return reject(
                new Error('validationResult code ' + validationResult)
              );
            }
          }
        })
        .catch(function (err) {
          logger.debug('Got a non-fatal error in server ' + err);
        });
    };
    if (roundNumber === 0) {
      // 0 round calls start update from startAndListen.
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
        }
      );
    }
  });
}

(function () {
  var server = net.createServer();
  server.on('error', function (err) {
    logger.debug('got error on server ' + err);
  });
  server = makeIntoCloseAllServer(server);

  // Lets us change our listeners for incoming peer events between rounds.
  // This is just to avoid having to set up another emitter.
  var boundListener = {
    listener: null
  };

  Mobile('peerAvailabilityChanged')
  .registerToNative(function (peers) {
    boundListener.listener(peers);
  });

  test('Test updating advertising and parallel data transfer 1', function (t) {
    serverToBeClosed = undefined;

    var clientQuitSignal = new QuitSignal();
    var serverQuitSignal = new QuitSignal();

    var timeoutId = setTimeout(function () {
      clientQuitSignal.raiseSignal();
      serverQuitSignal.raiseSignal();
      t.fail('Test timed out');
      t.end();
    }, TEST_TIMEOUT);

    Promise.all([
      clientRound(t, 0, boundListener, clientQuitSignal),
      serverRound(t, 0, server, serverQuitSignal)
    ])
    .catch(function (err) {
      t.fail('Got error ' + err);
    })
    .then(function () {
      logger.debug('We made it through round one');
      clearTimeout(timeoutId);
      t.end();
    });

    startAndListen(t, server);
  });

  test('Test updating advertising and parallel data transfer 2', function (t) {
    serverToBeClosed = server;

    var clientQuitSignal = new QuitSignal();
    var serverQuitSignal = new QuitSignal();

    var timeoutId = setTimeout(function () {
      clientQuitSignal.raiseSignal();
      serverQuitSignal.raiseSignal();
      t.fail('Test timed out');
      t.end();
    }, TEST_TIMEOUT);

    Promise.all([
      clientRound(t, 1, boundListener, clientQuitSignal),
      serverRound(t, 1, server, serverQuitSignal)
    ])
    .catch(function (err) {
      t.fail('Got error ' + err);
    })
    .then(function () {
      logger.debug('We made it through round two');
      clearTimeout(timeoutId);
      t.end();
    });
  });
}) ();
