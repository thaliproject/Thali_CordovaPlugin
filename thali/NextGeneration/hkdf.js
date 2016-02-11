'use strict';

/*
Apache 2.0 License

Originally from https://github.com/benadida/node-hkdf
Forked in https://github.com/zaach/node-hkdf

changelog:
12/10/2015 - applied zaach pull request
12/10/2015 - removed callback requirement
12/10/2015 - made instanceof check for easier chaining
*/

//
// a straightforward implementation of HKDF
//
// https://tools.ietf.org/html/rfc5869
//

var crypto = require('crypto');

function zeros(length) {
  var buf = new Buffer(length);

  buf.fill(0);

  return buf.toString();
}

// ikm is initial keying material
function HKDF(hashAlg, salt, ikm) {
  if (!(this instanceof HKDF)) { return new HKDF(hashAlg, salt, ikm); }

  this.hashAlg = hashAlg;

  // create the hash alg to see if it exists and get its length
  var hash = crypto.createHash(this.hashAlg);
  this.hashLength = hash.digest().length;

  this.salt = salt || zeros(this.hashLength);
  this.ikm = ikm;

  // now we compute the PRK
  var hmac = crypto.createHmac(this.hashAlg, this.salt);
  hmac.update(this.ikm);
  this.prk = hmac.digest();
}

HKDF.prototype.derive = function (info, size) {
  var prev = new Buffer(0);

  var buffers = [];
  var numBlocks = Math.ceil(size / this.hashLength);

  info = new Buffer(info);

  for (var i=0; i < numBlocks; i++) {
    var hmac = crypto.createHmac(this.hashAlg, this.prk);
    // XXX is there a more optimal way to build up buffers?
    var input = Buffer.concat([
      prev,
      info,
      new Buffer(String.fromCharCode(i + 1))
    ]);
    hmac.update(input);
    prev = hmac.digest();
    buffers.push(prev);
  }
  return Buffer.concat(buffers, size);
};

module.exports = HKDF;
