'use strict';

var format = require('util').format;

/**
 * @module utils/usn
 *
 * Decode/encode peer information from/into USN strings used by SSDP discovery
 * mechanism
 */

/**
 * @typdef {Object} UsnPeer
 * @property {string} peerIdentifier - UUID part of USN
 * @property {number} generation - generation part of USN
 */

var USN = {
  _prefix: 'data:',
};

/**
 * @param {string} usn
 * @returns {UsnPeer}
 * @throws Will throw when provided usn has an invalid prefix (other than
 * 'data:'), has incorrect number of segments or its generation is not a number.
 */
USN.parse = function (usn) {
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
    generation: generation
  };
};

/**
 * @param {UsnPeer} peer
 * @returns {string}
 */
USN.stringify = function (peer) {
  return USN._prefix + peer.peerIdentifier + ':' + peer.generation;
};

/**
 * @param {string} usn
 * @param {*} errorValue - this value will be returned if usn is invalid
 * @returns {UsnPeer|*}
 */
USN.tryParse = function (usn, errorValue) {
  try {
    return USN.parse(usn);
  } catch (error) {
    return errorValue;
  }
};

module.exports = USN;
