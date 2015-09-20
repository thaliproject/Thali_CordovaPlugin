'use strict';

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
    wrongPeer: "wrongPeer"
};