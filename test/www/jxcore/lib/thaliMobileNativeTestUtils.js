'use strict';

var Platform = require('thali/NextGeneration/utils/platform');
var logger = require('../lib/testLogger')('thaliMobileNativeTestUtils');
var randomstring = require('randomstring');
var Promise = require('lie');

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
    connection = JSON.parse(connection);
    if (err == null) {
      // Connected successfully..
      successCb(err, connection, peer);
    } else {
      logger.info('Connect returned an error: ' + err);

      if (err === 'Already connect(ing/ed)') {
        failureCb(err, connection, peer);
        return;
      }

      connectRetry(peer, retries, successCb,
        failureCb, quitSignal, function () {
          failureCb(err, connection, peer);
        });
    }
  });
}

function iOSConnectToPeer(peer, retries, successCb, failureCb, quitSignal) {
  var syncValue = randomstring.generate();

  retries--;
  Mobile('multiConnectResolved').registerToNative(function (callback) {
    if (quitSignal && quitSignal.raised) {
      successCb(null, null, peer);
    }

    if (callback.syncValue !== syncValue) {
      logger.info('We got back an unexpected syncValue - ' +
        callback.syncValue + ', when we were expecting ' + syncValue);
      if (failureCb) {
        failureCb('Wrong syncValue!', callback, peer);
        return;
      }
    }

    if (callback.error == null) {
      // Connected successfully..
      successCb(null, callback, peer);
    } else {
      connectRetry(peer, retries, successCb, failureCb, quitSignal,
        function () {
          failureCb(callback.error, callback, peer);
        });
    }
  });
  Mobile('multiConnect').callNative(peer.peerIdentifier, syncValue,
    function (err) {
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
  if (Platform.isAndroid) {
    return androidConnectToPeer(peer, retries, successCb, failureCb,
      quitSignal);
  }

  if (Platform.isIOS) {
    return iOSConnectToPeer(peer, retries, successCb, failureCb, quitSignal);
  }

  if (failureCb) {
    failureCb('What the heck platform are we on?!??!');
  }
}

module.exports.connectToPeer = connectToPeer;
