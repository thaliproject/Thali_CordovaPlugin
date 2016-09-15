'use strict';

var assert = require('assert');
var Promise = require('lie');

var objectKeysEquals = require('thali/validations').objectKeysEquals;

var logger = require('../../../lib/testLogger')('Message');


function Message (uuid, code, bulkData) {
  assert(!isNaN(code), 'code should be a number');

  this.uuid = uuid;
  this.code = code;
  this.bulkData = bulkData || Message.bulkData;
}

var bulkData = new Buffer(100000);
bulkData.fill(1);
Message.bulkData = bulkData;

Message.codes = {
  // The sender is not in the same generation as the receiver
  WRONG_GEN: 0,
  // The sender is not in the participants list for the receiver
  WRONG_TEST: 1,
  // Everything matched
  SUCCESS: 2,
  // We got an old advertisement for ourselves!
  WRONG_ME: 3,
  // A peer on our list gave us bad syntax, no hope of test passing
  WRONG_SYNTAX: 4
};

Message.prototype.toString = function () {
  return JSON.stringify({
    uuid: this.uuid,
    code: this.code,
    bulkData: this.bulkData.toString()
  });
}

Message.prototype.writeTo = function (socket) {
  var self = this;

  return new Promise(function (resolve, reject) {
    var str = self.toString();

    // We will send message's length in first 4 bytes.
    var length = str.length;
    var data = new Buffer(4);
    data.writeUInt32BE(length, 0);
    socket.write(data);

    // Than we will send the message itself.
    socket.write(str, resolve);
  })
}

Message.fromString = function (str) {
  var data = JSON.parse(str);
  assert(
    objectKeysEquals(data, ['uuid', 'code', 'bulkData']),
    'message should include uuid, code and bulkData and nothing else'
  );
  assert(!isNaN(data.code), 'code should be a number');
  data.code = parseInt(data.code, 10);
  return new Message(data.uuid, data.code, data.bulkData);
}

Message.read = function (socket) {
  return new Promise(function (resolve, reject) {
    var targetLength = null;
    var currentData = new Buffer(0);

    function handler (data) {
      currentData = Buffer.concat([currentData, data]);

      // We will read message length from the first 4 bytes.
      if (!targetLength) {
        if (currentData.length < 4) {
          // We need more data.
          socket.once('data', handler);
          return;
        } else {
          targetLength = currentData.readUInt32BE(0);
          assert(!isNaN(targetLength), 'target length should exist');
          targetLength += 4;
        }
      }
      if (currentData.length === targetLength) {
        resolve(
          Message.fromString(
            currentData.toString('utf8', 4)
          )
        );
      } else if (currentData.length < targetLength) {
        // We need more data.
        socket.once('data', handler);
      } else {
        reject(new Error(
          'data is too long, length is: ' + currentData.length +
          ', expected length: ' + targetLength
        ));
      }
    }
    socket.once('data', handler);
  });
}

module.exports = Message;
