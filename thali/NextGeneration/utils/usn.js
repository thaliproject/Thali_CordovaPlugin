'use strict';

var format = require('util').format;

// TODO: documentation
var USN = {
  _prefix: 'data:',

  parse: function (usn) {
    if (usn.indexOf(USN._prefix) !== 0) {
      throw new Error(
        format('Invalid USN (expected "%s" prefix): %s', USN._prefix, usn)
      );
    }
    var unprefixed = usn.substring(USN._prefix.length);
    var segments = unprefixed.split(':');
    var peerIdentifier = segments[0];
    var generation = Number(segments[1]);

    if (segments.length !== 2) {
      throw new Error('Invalid USN (expected 2 segments): ' + usn);
    }
    if (isNaN(generation)) {
      throw new Error('Invalid USN (generation is not a number): ' + usn);
    }
    return {
      peerIdentifier: peerIdentifier,
      generation: generation,
    };
  },

  stringify: function (peer) {
    return USN._prefix + peer.peerIdentifier + ':' + peer.generation;
  },
};

module.exports = USN;

