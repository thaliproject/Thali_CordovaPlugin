'use strict';

var crypto = require('crypto');
var Promise = require('lie');
var ThaliReplicationManager = require('../thalireplicationmanager');

exports.rnBufferLength = 16;
exports.pkBufferLength = 32;
exports.cbBufferLength = 32;

exports.validateRnAndGetBase64Object = function(base64Value) {
    return exports.validateAndGetBase64Object(base64Value, exports.rnBufferLength);
};

exports.validatePkAndGetBase64Object = function(base64Value) {
    return exports.validateAndGetBase64Object(base64Value, exports.pkBufferLength);
};

exports.validateCbAndGetBase64Object = function(base64Value) {
    return exports.validateAndGetBase64Object(base64Value, exports.cbBufferLength);
};

exports.validateAndGetBase64Object = function(base64Value, expectedRawLength) {
    if (!base64Value || typeof base64Value !== "string") {
        return null;
    }

    var valueBuffer = new Buffer(base64Value, 'base64');

    return valueBuffer.length != expectedRawLength  ? null : valueBuffer;
};

exports.fourHundredErrorCodes = {
    notDoingIdentityExchange: "notDoingIdentityExchange",
    malformed: "malformed",
    wrongPeer: "wrongPeer",
    skippedAhead: "skippedAhead"
};

exports.cbPath = "/identity/cb";
exports.rnMinePath = "/identity/rnmine";

exports.generateCb = function(rnForHash, firstPkBuffer, secondPkBuffer) {
    return generateHashBuffer([firstPkBuffer, secondPkBuffer], rnForHash);
};

function generateHashBuffer(arrayOfBuffers, key) {
    var buffer = Buffer.concat(arrayOfBuffers);
    var hash = crypto.createHmac('sha256', key);
    hash.write(buffer);
    hash.end();
    return hash.read();
}

exports.generateValidationCode = function(rnForHash, firstPkBuffer, secondPkBuffer, rnBufferToHash) {
    var hashBuffer = generateHashBuffer([ firstPkBuffer, secondPkBuffer, rnBufferToHash], rnForHash);
    return parseInt(hashBuffer.toString('hex'), 16) % Math.pow(10, 6);
};

Promise.prototype.thenIfNotInExit = function(self, userFun) {
    return this.then(function() {
        if (self.smallHashStateMachine.current != "Exit") {
            userFun.apply(this, arguments);
        }
    });
};

Promise.prototype.catchIfNotInExit = function(self, userFun) {
    return this.catch(function() {
        if (self.smallHashStateMachine.current != "Exit") {
            userFun.apply(this, arguments);
        }
    })
};

exports.stopThaliReplicationManager = function(thaliReplicationManager) {
    return new Promise(function(resolve, reject) {
        var stoppedHandler = function() {
            thaliReplicationManager.removeListener(ThaliReplicationManager.events.STOP_ERROR, stoppedErrorHandler);
            resolve();
        };
        var stoppedErrorHandler = function(err) {
            thaliReplicationManager.removeListener(ThaliReplicationManager.events.STOPPED, stoppedHandler);
            reject(!err ? new Error("Unknown Thali replication manager stop error") : err);
        };
        thaliReplicationManager.once(ThaliReplicationManager.events.STOPPED, stoppedHandler);
        thaliReplicationManager.once(ThaliReplicationManager.events.STOP_ERROR, stoppedErrorHandler);
        thaliReplicationManager.stop();
    });
};

exports.startThaliReplicationManager = function(thaliReplicationManager, port, dbName, deviceName) {
    return new Promise(function(resolve, reject) {
        var startHandler = function() {
            thaliReplicationManager.removeListener(ThaliReplicationManager.events.START_ERROR, startHandlerError);
            resolve();
        };
        var startHandlerError = function() {
            thaliReplicationManager.removeListener(ThaliReplicationManager.events.STARTED, startHandler);
            reject(!err ? new Error("Unknown Thali replication manager start error") : err);
        };
        thaliReplicationManager.once(ThaliReplicationManager.events.STARTED, startHandler);
        thaliReplicationManager.once(ThaliReplicationManager.events.START_ERROR, startHandlerError);
        thaliReplicationManager.start(port, dbName, deviceName);
    });
};

exports.getDeviceIdentityFromThaliReplicationManager = function(thaliReplicationManager) {
    return new Promise(function(resolve, reject) {
        thaliReplicationManager.getDeviceIdentity(function(err, deviceName) {
           if (err) {
               return reject(err);
           }
            return resolve(deviceName);
        });
    })
}