'use strict';

var format = require('util').format;

var platform = require('thali/NextGeneration/utils/platform');
var logger = require('../lib/testLogger')('thaliMobileNativeTestUtils');
var randomString = require('randomstring');
var Promise = require('lie');
var makeIntoCloseAllServer =
  require('thali/NextGeneration/makeIntoCloseAllServer');
var Promise = require('bluebird');
var net = require('net');
var inherits = require('util').inherits;
var EventEmitter = require('events').EventEmitter;
var testUtils = require('../lib/testUtils.js');

var ThaliMobileNativeWrapper =
  require('thali/NextGeneration/thaliMobileNativeWrapper.js');

/**
 * @readonly
 * @type {{NOT_CONNECTED: string, CONNECTING: string, CONNECTED: string}}
 */
var connectStatus = {
  NOT_CONNECTED : 'notConnected',
  CONNECTING : 'connecting',
  CONNECTED : 'connected'
};

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

module.exports.startAndListen = startAndListen;

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

module.exports.getMessageByLength = getMessageByLength;


var RETRY_COUNT   = 10;
var RETRY_TIMEOUT = 3000;

function connectToPeer(peer, quitSignal) {
  var connectMethod;
  if (platform.isAndroid) {
    connectMethod = androidConnectToPeer;
  } else if (platform.isIOS) {
    connectMethod = iOSConnectToPeer;
  } else {
    return Promise.reject(new Error('unknown platform'));
  }

  return new Promise(function (resolve, reject) {
    var retryIndex = 0;

    function retry () {
      if (quitSignal && quitSignal.raised) {
        // 'connection' will be null.
        return resolve(null);
      }

      // It will return 'connection'.
      connectMethod(peer, quitSignal)
        .then(resolve)
        .catch(function (error) {
          if (error.isFatal) {
            logger.error('Fatal connect error: \'%s\'', error.message);
            return reject(error);
          }
          logger.warn('Connect error: \'%s\'', error.message);

          if (retryIndex >= RETRY_COUNT) {
            error = 'Too many connect retries';
            logger.error(error);
            return reject(new Error(error));
          }

          retryIndex ++;
          logger.info('New connect retry, number: \'%d\'', retryIndex);
          setTimeout(retry, RETRY_TIMEOUT);
        });
    }
    retry();
  });
}
module.exports.connectToPeer = connectToPeer;

function androidConnectToPeer(peer, quitSignal) {
  return new Promise(function (resolve, reject) {
    Mobile('connect')
      .callNative(peer.peerIdentifier, function (error, connection) {
        if (quitSignal && quitSignal.raised) {
          return resolve(null);
        }

        if (error) {
          error = new Error(error);
          if (error.message === 'Already connect(ing/ed)') {
            error.isFatal = true;
          }
          return reject(error);
        }

        if (!connection) {
          return reject(new Error('connect returned no connection'));
        }
        connection = JSON.parse(connection);
        resolve(connection);
      });
  });
}

function createMultiConnectEmitter() {
  var emitter = new EventEmitter();
  ThaliMobileNativeWrapper.emitter.on('_multiConnectResolved',
    function (syncValue, error, listeningPort) {
      emitter.emit('multiConnectResolved', syncValue, error, listeningPort);
    }
  );
  ThaliMobileNativeWrapper.emitter.on('_multiConnectConnectionFailure',
    function (peerIdentifier, error) {
      emitter.emit('multiConnectConnectionFailure', peerIdentifier, error);
    }
  );
  return emitter;
}

var multiConnectEmitter = createMultiConnectEmitter();
module.exports.multiConnectEmitter = multiConnectEmitter;

function iOSConnectToPeer(peer, quitSignal) {
  var originalSyncValue = randomString.generate();
  var multiConnectHandler;

  return new Promise(function (resolve, reject) {
    multiConnectHandler = function (syncValue, error, listeningPort) {
      logger.debug(
        'Got multiConnectResolved -' +
        'syncValue: \'%s\', error: \'%s\', listeningPort: \'%s\'',
        syncValue, error, listeningPort
      );

      if (quitSignal && quitSignal.raised) {
        return resolve(null);
      }

      if (error) {
        // Connection to a peer failed.
        // Return a fatal error to avoid retrying connecting to a peer that is not available anymore
        error = new Error(error);
        error.isFatal = true;
        return reject(error);
      }
      if (syncValue !== originalSyncValue) {
        logger.warn(
          'multiConnectResolved received invalid ' +
          'syncValue: \'%s\', originalSyncValue: \'%s\'',
          syncValue, originalSyncValue
        );
        return;
      }

      var port = parseInt(listeningPort, 10);
      if (isNaN(port) || port != listeningPort) {
        return reject(new Error(format(
          'listeningPort is not a valid number: \'%s\'', listeningPort
        )));
      }
      resolve({
        listeningPort: port
      });
    };

    multiConnectEmitter.on('multiConnectResolved', multiConnectHandler);
    logger.debug(format(
      'Issuing multiConnect for %s (syncValue: %s)',
      peer.peerIdentifier, originalSyncValue
    ));
    Mobile('multiConnect')
      .callNative(peer.peerIdentifier, originalSyncValue, function (error) {
        logger.debug('Got \'multiConnect\' callback');

        if (error) {
          error = new Error(format(
            'We got an error synchronously from multiConnect, ' +
            'that really shouldn\'t happen: \'%s\'', error
          ));
          error.isFatal = true;
          return reject(error);
        }
      });
  })
    .finally(function () {
      multiConnectEmitter.removeListener('multiConnectResolved', multiConnectHandler);
    });
}

/**
 * This function will grab the first peer it can via nonTCPAvailableHandler and
 * will try to issue the GET request. If it fails then it will continue to
 * listen to nonTCPAvailableHandler until it sees a port for the same PeerID
 * and will try the GET again. It will repeat this process if there are
 * failures until the timer runs out.
 *
 * @param {string} path
 * @param {string} pskIdentity
 * @param {Buffer} pskKey
 * @param {?string} [selectedPeerId] This is only used for a single test that
 * needs to reconnect to a known peer, otherwise it is null.
 * @returns {Promise<Error | peerAndBody>}
 */
function getSamePeerWithRetry(path, pskIdentity, pskKey,
                                                selectedPeerId) {
  // We don't load thaliMobileNativeWrapper until after the tests have started
  // running so we pick up the right version of mobile
  var thaliMobileNativeWrapper =
    require('thali/NextGeneration/thaliMobileNativeWrapper');
  return new Promise(function (resolve, reject) {
    var retryCount = 0;
    var MAX_TIME_TO_WAIT_IN_MILLISECONDS = 1000 * 60;
    var exitCalled = false;
    var peerID = selectedPeerId;
    var getRequestPromise = null;
    var cancelGetPortTimeout = null;
    var status = connectStatus.NOT_CONNECTED;
    var availablePeers = [];

    var timeoutId = setTimeout(function () {
      exitCall(null, new Error('Timer expired'));
    }, MAX_TIME_TO_WAIT_IN_MILLISECONDS);

    function removeFromAvailablePeers(peer) {
      var i;

      for (i = availablePeers.length - 1; i >= 0; i--) {
        if (availablePeers[i].peerIdentifier === peer.peerIdentifier) {
          availablePeers.splice(i, 1);
        }
      }
    }

    function exitCall(success, failure) {
      if (exitCalled) {
        return;
      }
      exitCalled = true;
      clearTimeout(timeoutId);
      clearTimeout(cancelGetPortTimeout);
      thaliMobileNativeWrapper.emitter
        .removeListener('nonTCPPeerAvailabilityChangedEvent',
          nonTCPAvailableHandler);
      return failure ? reject(failure) : resolve(
        {
          httpResponseBody: success,
          peerId: peerID
        });
    }

    function tryAgain(portNumber) {
      ++retryCount;
      logger.warn('Retry count for getSamePeerWithRetry is ' + retryCount);
      getRequestPromise = testUtils.get('127.0.0.1',
        portNumber, path, pskIdentity, pskKey);
      getRequestPromise
        .then(function (result) {
          exitCall(result);
        })
        .catch(function (err) {
          logger.debug('getSamePeerWithRetry got an error it will retry - ' +
            err);
        });
    }

    function callTryAgain(portNumber) {
      // We have a predefined peerID
      if (!getRequestPromise) {
        return tryAgain(portNumber);
      }

      getRequestPromise
        .then(function () {
          // In theory this could maybe happen if a connection somehow got
          // cut before we were notified of a successful result thus causing
          // the system to automatically issue a new port, but that is
          // unlikely
        })
        .catch(function (err) {
          return tryAgain(portNumber, err);
        });
    }

    // In this case this method is only used when we run on iOS.
    function tryToConnect() {
      availablePeers.forEach(function (peer) {
        if (peer.peerAvailable && status === connectStatus.NOT_CONNECTED) {
          status = connectStatus.CONNECTING;

          connectToPeer(peer)
            .then(function (connection) {
              // When we establish multi connect connections, run test.
              status = connectStatus.CONNECTED;
              callTryAgain(connection.listeningPort);
            })
            .catch(function (error) {
              status = connectStatus.NOT_CONNECTED;

              removeFromAvailablePeers(peer);
              tryToConnect();
            });
        }
      });
    }

    function nonTCPAvailableHandler(peer) {
      if (!peer.peerAvailable) {
        removeFromAvailablePeers(peer);
        return;
      }

      availablePeers.push(peer);

      logger.debug('We got a peer ' + JSON.stringify(peer));

      if (!peerID) {
        peerID = peer.peerIdentifier;
      }

      if (status === connectStatus.NOT_CONNECTED && availablePeers.length > 0) {
        if (!platform.isAndroid) {
          tryToConnect();
        } else {
          callTryAgain(peer.portNumber);
        }
      }
    }

    thaliMobileNativeWrapper.emitter.on('nonTCPPeerAvailabilityChangedEvent', nonTCPAvailableHandler);
  });
}

module.exports.getSamePeerWithRetry = getSamePeerWithRetry;

/**
 * This function is responsible for execution of test function requiring connection to the other peer.
 * It assures that the connection is not established with the zombie advertiser. In case of the connection error
 * it checks if there are other peers available beside the one already tried.
 * @param {object} t test object.
 * @param {net.Server} server Server object
 * @param {function} testFunction
 */
function executeZombieProofTest (t, server, testFunction) {
  var status = connectStatus.NOT_CONNECTED;
  var availablePeers = [];

  function removeFromAvailablePeers(peer) {
    var i;

    for (i = availablePeers.length - 1; i >= 0; i--) {
      if (availablePeers[i].peerIdentifier === peer.peerIdentifier) {
        availablePeers.splice(i, 1);
      }
    }
  }

  function tryToConnect() {
    availablePeers.forEach(function (peer) {
      if (peer.peerAvailable && status === connectStatus.NOT_CONNECTED) {
        status = connectStatus.CONNECTING;

        connectToPeer(peer)
          .then(function (connection) {
            status = connectStatus.CONNECTED;
            testFunction(null, connection, peer);
          })
          .catch(function (error) {
            status = connectStatus.NOT_CONNECTED;
            // Remove the peer from the availablePeers list in case it is still there
            removeFromAvailablePeers(peer);
            tryToConnect();
          });
      }
    });
  }

  // The peer we got here is in fact an one element array, so we
  // have to treat it like array.
  function peerAvailabilityChangedHandler(peerAsArray) {
    var peer = peerAsArray[0];

    if (!peer.peerAvailable) {
      removeFromAvailablePeers(peer);
      return;
    }

    availablePeers.push(peer);

    logger.debug('We got a peer ' + JSON.stringify(peer));

    if (status === connectStatus.NOT_CONNECTED && availablePeers.length > 0) {
      tryToConnect();
    }
  }

  startAndListen(t, server, peerAvailabilityChangedHandler);
}

module.exports.executeZombieProofTest = executeZombieProofTest;

function getConnectionToOnePeerAndTest(t, connectTest) {
  var echoServer = net.createServer(function (socket) {
    socket.pipe(socket);
  });
  echoServer = makeIntoCloseAllServer(echoServer);
  var runningTest = false;
  var currentTestPeer = null;
  var failedPeers = 0;
  var maxFailedPeers = 5;


  function tryToConnect() {
    runningTest = true;
    connectToPeer(currentTestPeer)
      .then(function (connectionCallback) {
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

  return echoServer;
}

module.exports.getConnectionToOnePeerAndTest = getConnectionToOnePeerAndTest;
