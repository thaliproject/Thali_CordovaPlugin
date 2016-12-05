'use strict';

var platform = require('thali/NextGeneration/utils/platform');
var logger = require('../lib/testLogger')('thaliMobileNativeTestUtils');
var randomString = require('randomstring');
var Promise = require('lie');
var makeIntoCloseAllServer =
  require('thali/NextGeneration/makeIntoCloseAllServer');
var net = require('net');
var inherits = require('util').inherits;
var EventEmitter = require('events').EventEmitter;

var ThaliMobileNativeWrapper =
  require('thali/NextGeneration/thaliMobileNativeWrapper.js');

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

function connectRetry(peer, retries, successCb, failureCb, quitSignal,
                      failureFn) {
  var TIME_BETWEEN_RETRIES = 3000;
  // Retry a failed connection...
  if (retries > 0) {
    logger.info('Scheduling a connect retry - retries left: ' + retries);
    var timeoutCancel = setTimeout(function () {
      quitSignal && quitSignal.removeTimeout(timeoutCancel);
      connectToPeer(peer, retries, successCb, failureCb, quitSignal);
    }, TIME_BETWEEN_RETRIES);
    quitSignal && quitSignal.addTimeout(timeoutCancel, successCb);
  } else {
    if (failureCb) {
      logger.warn('Too many connect retries!');
      failureFn();
    }
  }
}

module.exports.connectRetry = connectRetry;

function androidConnectToPeer(peer, retries, successCb, failureCb, quitSignal) {
  retries--;
  Mobile('connect').callNative(peer.peerIdentifier, function (err, connection) {
    if (quitSignal && quitSignal.raised) {
      successCb(null, null, peer);
    }

    if (connection) {
      connection = JSON.parse(connection);
    }

    if (err == null) {
      // Connected successfully..
      successCb(err, connection, peer);
    } else {
      logger.info('Connect returned an error: ' + err);

      if (err === 'Already connect(ing/ed)') {
        failureCb(err, null, peer);
        return;
      }

      connectRetry(peer, retries, successCb,
        failureCb, quitSignal, function () {
          failureCb(err, null, peer);
        });
    }
  });
}

function MultiConnectEmitter () {
  EventEmitter.call(module.exports.multiConnectEmitter);
  ThaliMobileNativeWrapper.emitter.on('_multiConnectResolved',
    function (syncValue, error, listeningPort) {
      module.exports.multiConnectEmitter
        .emit('multiConnectResolved', syncValue, error, listeningPort);
    });
  ThaliMobileNativeWrapper.emitter.on('_multiConnectConnectionFailure',
    function (peerIdentifier, error) {
      module.exports.multiConnectEmitter
        .emit('multiConnectConnectionFailure', peerIdentifier, error);
    });
}

inherits(MultiConnectEmitter, EventEmitter);

module.exports.multiConnectEmitter = new MultiConnectEmitter();

function iOSConnectToPeer(peer, retries, successCb, failureCb, quitSignal) {
  var originalSyncValue = randomString.generate();

  retries--;

  module.exports.multiConnectEmitter.on('multiConnectResolved',
    function(syncValue, error, listeningPort) {
      logger.debug('Got multiConnectResolved - syncValue: ' + syncValue +
        ' error: ' + error + ' listeningPort: ' + listeningPort);
      if (quitSignal && quitSignal.raised) {
        successCb(null, null, peer);
      }

      if (syncValue !== originalSyncValue) {
        return;
      }

      if (error == null) {
        // Connected successfully..
        successCb(null, { listeningPort: parseInt(listeningPort, 10) }, peer);
      } else {
        connectRetry(peer, retries, successCb, failureCb, quitSignal,
          function () {
            failureCb(error, syncValue, peer);
          });
      }
    });

  Mobile('multiConnect').callNative(peer.peerIdentifier, originalSyncValue,
    function (err) {
      logger.debug('Got multiConnect callback');
      if (err) {
        logger.info('We got an error synchronously from multiConnect, that ' +
          'really shouldn\'t happen! - ' + err);
        if (failureCb) {
          failureCb(err, peer);
        }
      }
    });
}

function connectToPeer(peer, retries, successCb, failureCb, quitSignal) {
  if (platform.isAndroid) {
    return androidConnectToPeer(peer, retries, successCb, failureCb,
      quitSignal);
  }

  if (platform.isIOS) {
    return iOSConnectToPeer(peer, retries, successCb, failureCb, quitSignal);
  }

  if (failureCb) {
    failureCb('What the heck platform are we on?!??!');
  }
}

module.exports.connectToPeer = connectToPeer;

function connectToPeerPromise(peer, retries, quitSignal) {
  return new Promise(function (resolve, reject) {
    connectToPeer(peer, retries, function (err, connection) {
      resolve(connection);
    }, function (err) {
      reject(err);
    }, quitSignal);
  });
}

module.exports.connectToPeerPromise = connectToPeerPromise;

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
    var RETRIES = 10;
    connectToPeerPromise(currentTestPeer, RETRIES)
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
