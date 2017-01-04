'use strict';

var util   = require('util');
var format = util.format;

var platform = require('thali/NextGeneration/utils/platform');
var logger = require('../lib/testLogger')('thaliMobileNativeTestUtils');
var randomString = require('randomstring');
var Promise = require('bluebird');
var makeIntoCloseAllServer = require('thali/NextGeneration/makeIntoCloseAllServer');
var net = require('net');
var inherits = require('util').inherits;
var EventEmitter = require('events').EventEmitter;


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
            var error = 'Too many connect retries';
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

  Mobile('multiConnectResolved')
    .registerToNative(function (syncValue, error, listeningPort) {
      emitter.emit('multiConnectResolved', syncValue, error, listeningPort);
    });
  Mobile('multiConnectConnectionFailure')
    .registerToNative(function (peerIdentifier, error) {
      emitter.emit('multiConnectConnectionFailure', peerIdentifier, error);
    });

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
        return reject(new Error(error));
      }
      if (syncValue !== originalSyncValue) {
        logger.warn(
          'multiConnectResolved received invalid ' +
          'syncValue: \'%s\', originalSyncValue: \'%s\'',
          syncValue, originalSyncValue
        );
        return;
      }

      var port = new Number(listeningPort);
      if (isNaN(port)) {
        return reject(new Error(format(
          'listeningPort is not a valid number: \'%s\'', listeningPort
        )));
      }
      resolve({
        listeningPort: port
      });
    }

    multiConnectEmitter.on('multiConnectResolved', multiConnectHandler);
    Mobile('multiConnect')
      .callNative(peer.peerIdentifier, originalSyncValue, function (error) {
        logger.debug('Got \'multiConnect\' callback');

        if (error) {
          var error = new Error(format(
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
