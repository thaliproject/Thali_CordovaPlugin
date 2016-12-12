'use strict';

var extend = require('js-extend');


var cache = null;

// max possible age of the zombie (in ms);
var zombieTime = null;

// how much time it takes for native layer to update generation (in ms)
var generationUpdateWindow = null;

// how much time it takes to make complete cycle over 256 available generations
// (generation is 8-bit integer on Android)
var wrapAroundTime = null;

function cachePeer (peerIdentifier, realGeneration, fakeGeneration) {
  var cachedPeer = {
    realGeneration: realGeneration,
    fakeGeneration: fakeGeneration,
    time: Date.now(),
  };
  cache[peerIdentifier] = cachedPeer;
  return cachedPeer;
}

function shouldIgnoreAnnouncement (nativePeer) {
  var peerIdentifier = nativePeer.peerIdentifier;
  var cachedPeer = cache[peerIdentifier];

  if (!cachedPeer || !nativePeer.peerAvailable) {
    return false;
  }

  var lastGeneration = cachedPeer.realGeneration;
  var newGeneration = nativePeer.generation;
  var elapsedTime = Date.now() - cachedPeer.time;

  // So much time has passed that any generation is possibly real
  if (elapsedTime + zombieTime >= wrapAroundTime) {
    return false;
  }

  var maxGenerations = (elapsedTime + zombieTime) / generationUpdateWindow;
  var leftBorder = (lastGeneration + 1) % 256;
  var rightBorder = (lastGeneration + maxGenerations) % 256;

  var isValidGeneration = leftBorder < rightBorder ?
    newGeneration >= leftBorder && newGeneration <= rightBorder :
    newGeneration <= rightBorder || newGeneration >= leftBorder;

  return !isValidGeneration;
}

function fixPeerGeneration (nativePeer) {
  var cachedPeer = cache[nativePeer.peerGeneration];
  var fixedPeer = extend({}, nativePeer);
  if (cachedPeer) {
    fixedPeer.generation = cachedPeer.fakeGeneration;
  }
  return fixedPeer;
}

function zombieFilter (handleNonTCPPeer, config) {
  cache = {};
  zombieTime = config.zombieTime;
  generationUpdateWindow = config.generationUpdateWindow;
  wrapAroundTime = generationUpdateWindow * 255;

  return function (nativePeer) {
    var peerIdentifier = nativePeer.peerIdentifier;
    var peerAvailable = nativePeer.peerAvailable;
    var generation = nativePeer.generation;

    // just pass through recreated events
    if (nativePeer.recreated) {
      handleNonTCPPeer(nativePeer);
      return;
    }

    if (!peerAvailable) {
      delete cache[peerIdentifier];
      handleNonTCPPeer(nativePeer);
      return;
    }

    var cachedPeer = cache[peerIdentifier];

    if (!cachedPeer) {
      cachePeer(peerIdentifier, nativePeer.generation, 0);
      handleNonTCPPeer(nativePeer);
      return;
    }

    if (shouldIgnoreAnnouncement(nativePeer)) {
      return;
    }

    cachedPeer = cachePeer(peerIdentifier, generation, cachedPeer.fakeGeneration + 1);

    var fixedPeer = fixPeerGeneration(nativePeer);
    handleNonTCPPeer(fixedPeer);
  };
}

zombieFilter.clearCache = function () {
  cache = {};
};

module.exports = zombieFilter;
