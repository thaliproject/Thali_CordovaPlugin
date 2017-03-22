'use strict';

module.exports = {
  decode: Decode,
  encode: Encode,
  encodeSemibyte: encodeSemibyte,
  decodeSemibyte: decodeSemibyte,
};


var Transform = require('stream').Transform;
var inherits = require('util').inherits;
inherits(Encode, Transform);
inherits(Decode, Transform);

function Encode() {
  if ( !(this instanceof Encode) ) {
    return new Encode();
  }
  Transform.call(this);
}

Encode.prototype._transform = function (chunk, encoding, cb) {
  var cl = chunk.length;
  var buf = new Buffer(cl + cl);
  var b, b1, b2;
  for (var i = 0; i < cl; i++) {
    b = chunk[i];
    b1 = (b & 0xF0) >> 4;
    b2 = (b & 0x0F);
    buf[i + i] = encodeSemibyte(b1);
    buf[i + i + 1] = encodeSemibyte(b2);
  }
  this.push(buf);
  cb();
};


function Decode() {
  if ( !(this instanceof Decode) ) {
    return new Decode();
  }
  Transform.call(this);
  this.extra = null;
}

function decodeSemibyte(b) {
  // var s = String.fromCharCode(b);
  // return parseInt(s, 32);
  return b - (b < 58 ? 48 : 87);
}

function encodeSemibyte(b) {
  // return b.toString(32).charCodeAt(0);
  return b + (b < 10 ? 48 : 87);
}

function join(b1, b2) {
  return (decodeSemibyte(b1) << 4) | decodeSemibyte(b2);
}

Decode.prototype._transform = function (chunk, encoding, cb) {
  var firstByte;
  var fbb = new Buffer(2);
  if (this.extra) {
    fbb[0] = this.extra;
    fbb[1] = chunk[0];
    firstByte = join(this.extra, chunk[0]);
    this.extra = null;
    chunk = chunk.slice(1);
  } else {
    fbb[0] = chunk[0];
    fbb[1] = chunk[1];
    firstByte = join(chunk[0], chunk[1]);
    chunk = chunk.slice(2);
  }

  var chunkLength = chunk.length;
  if (chunkLength % 2) {
    this.extra = chunk[chunkLength - 1];
    chunkLength -= 1;
    chunk = chunk.slice(0, chunkLength);
  }

  var buf = new Buffer(chunkLength / 2 + 1);
  buf[0] = firstByte;
  for (var i = 0; i < chunkLength; i += 2) {
    var ii = i / 2 + 1;
    var b = join(chunk[i], chunk[i + 1]);
    buf[ii] = b;
  }
  this.push(buf);
  cb();
};
