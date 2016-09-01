'use strict';

var crypto = require('crypto');
var ThaliReplicationManager = require('../thalireplicationmanager');
var Promise = require('../thaliPromise');
var urlSafeBase64 = require('urlsafe-base64');

// Exports for Identity Exchange
var rnBufferLength = module.exports.rnBufferLength = 16;
// We only use the first 16 bytes of the 32 byte hash for space reasons
var pkBufferLength = module.exports.pkBufferLength = 16;
var cbBufferLength = module.exports.cbBufferLength = 32;

var validateAndGetBase64Object = module.exports.validateAndGetBase64Object =
  function(base64Value, expectedRawLength) {

  if (!base64Value || typeof base64Value !== 'string') {
    return null;
  }

  var valueBuffer = urlSafeBase64.decode(base64Value);

  return valueBuffer.length !== expectedRawLength ? null : valueBuffer;
};

module.exports.validateRnAndGetBase64Object = function(base64Value) {
  return validateAndGetBase64Object(base64Value, rnBufferLength);
};

module.exports.validatePkAndGetBase64Object = function(base64Value) {
  return validateAndGetBase64Object(base64Value, pkBufferLength);
};

module.exports.validateCbAndGetBase64Object = function(base64Value) {
  return validateAndGetBase64Object(base64Value, cbBufferLength);
};

exports.fourHundredErrorCodes = {
  notDoingIdentityExchange: 'notDoingIdentityExchange',
  malformed: 'malformed',
  wrongPeer: 'wrongPeer',
  skippedAhead: 'skippedAhead'
};

module.exports.cbPath = '/identity/cb';
module.exports.rnMinePath = '/identity/rnmine';

function generateHashBuffer(arrayOfBuffers, key) {
  var buffer = Buffer.concat(arrayOfBuffers);
  var hash = crypto.createHmac('sha256', key);
  hash.write(buffer);
  hash.end();

  return hash.read();
}

module.exports.generateCb = function(rnForHash, firstPkBuffer, secondPkBuffer) {
  return generateHashBuffer([firstPkBuffer, secondPkBuffer], rnForHash);
};

module.exports.generateValidationCode = function(
  rnForHash,
  firstPkBuffer,
  secondPkBuffer,
  rnBufferToHash) {

  var hashBuffer = generateHashBuffer(
    [ firstPkBuffer, secondPkBuffer, rnBufferToHash],
    rnForHash
  );

  return parseInt(hashBuffer.toString('hex'), 16) % Math.pow(10, 6);
};

Promise.prototype.thenIfNotInExit = function(self, userFun) {
  return this.then(function(data) {
    if (self.smallHashStateMachine.current !== 'Exit') {
      userFun.call(this, data);
    }
  });
};

Promise.prototype.catchIfNotInExit = function(self, userFun) {
  return this.catch(function(err) {
    if (self.smallHashStateMachine.current !== 'Exit') {
      userFun.call(this, err);
    }
  });
};

/**
 * This function is intended primarily for teardown where we want to stop the
 * Thali Replication Manager and if we never started it, that's o.k. we just
 * want a NOP. That is normally a great way to hide programming errors.
 * @param thaliReplicationManager
 * @returns {Promise|exports|module.exports}
 */
module.exports.stopThaliReplicationManager = function(thaliReplicationManager) {
  return new Promise(function(resolve, reject) {
    var stoppedHandler = function() {
      thaliReplicationManager.removeListener(
        ThaliReplicationManager.events.STOP_ERROR,
        stoppedErrorHandler
      );

      resolve();
    };

    var stoppedErrorHandler = function(err) {
      thaliReplicationManager.removeListener(
        ThaliReplicationManager.events.STOPPED,
        stoppedHandler
      );

      reject(err || new Error('Unknown Thali replication manager stop error'));
    };

    thaliReplicationManager.once(
      ThaliReplicationManager.events.STOPPED,
      stoppedHandler
    );

    thaliReplicationManager.once(
      ThaliReplicationManager.events.STOP_ERROR,
      stoppedErrorHandler
    );

    thaliReplicationManager.stop();
  });
};

module.exports.startThaliReplicationManager =
  function(thaliReplicationManager, port, dbName, deviceName) {

  return new Promise(function(resolve, reject) {
    var startHandler = function() {
      thaliReplicationManager.removeListener(
        ThaliReplicationManager.events.START_ERROR,
        startHandlerError
      );

      resolve();
    };

    var startHandlerError = function(err) {
      thaliReplicationManager.removeListener(
        ThaliReplicationManager.events.STARTED,
        startHandler
      );

      reject(err || new Error('Unknown Thali replication manager start error'));
    };

    thaliReplicationManager.once(
      ThaliReplicationManager.events.STARTED,
      startHandler
    );

    thaliReplicationManager.once(
      ThaliReplicationManager.events.START_ERROR,
      startHandlerError
    );

    thaliReplicationManager.start(port, dbName, deviceName);
  });
};

module.exports.getDeviceIdentityFromThaliReplicationManager =
  function(thaliReplicationManager) {

  return new Promise(function(resolve, reject) {
    thaliReplicationManager.getDeviceIdentity(function(err, deviceName) {
      if (err) {
        return reject(err);
      }
      return resolve(deviceName);
    });
  });
};

exports.compareEqualSizeBuffers = function(buffer1, buffer2) {
  if (!Buffer.isBuffer(buffer1) || !Buffer.isBuffer(buffer2)) {
    throw new Error('buffer1 and buffer2 have to actually be buffers');
  }

  if (buffer1.length !== buffer2.length) {
    throw new Error('Buffers must be of the same size.');
  }

  for(var i = 0; i < buffer1.length; ++i) {
    if (buffer1[i] > buffer2[i]) {
      return 1;
    }

    if (buffer1[i] < buffer2[i]) {
      return -1;
    }
  }

  return 0;
};
