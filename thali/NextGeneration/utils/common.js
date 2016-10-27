'use strict';

module.exports.serializePouchError = function (err) {
  if (err) {
    return (err.status || '') + ' ' + (err.message || '');
  } else {
    return '';
  }
};


module.exports.bufferToAscii = function(buffer) {
  // We expect a buffer with mixed binary and ASCII/UTF-8 content. We will
  // output anything that looks like ASCII as a character and return the
  // rest as numbers
  // var outputArray = [];
  // var sampleSize = 1000;
  // var length = buffer.length > sampleSize ? sampleSize : buffer.length;
  // for(var i = 0; i < length; ++i) {
  //   var octet = buffer[i];
  //   outputArray.push(octet >= 32 && octet <= 126 ? String.fromCharCode(octet) :
  //     '-' + octet + '-');
  // }
  return 'foo';
};
