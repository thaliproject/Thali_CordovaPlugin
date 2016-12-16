'use strict';

var assert = require('assert');
var format = require('util').format;
var extend = require('js-extend').extend;

function throttle(fn, options) {
  var minDelay = options.minDelay;
  var maxDelay = options.maxDelay;
  assert(minDelay <= maxDelay, format(
    'minDelay(%d) can\'t be greater than maxDelay(%d)', minDelay, maxDelay
  ));

  var args, context;
  var timeout = null;
  var lastCalledAt = null;

  function invoke() {
    timeout = null;
    lastCalledAt = null;
    fn.apply(context, args);

    if (!timeout) {
      context = args = null;
    }
  }

  function throttled () {
    args = arguments;
    context = this; // eslint-disable-line consistent-this

    var now = Date.now();

    if (lastCalledAt === null) {
      lastCalledAt = now;
    }

    if (!timeout) {
      console.log('first call fn %s with args: %j', fn.name, args);
      timeout = setTimeout(invoke, minDelay);
    } else {
      console.log('throttled fn %s with args: %j', fn.name, args);
      var elapsed = now - lastCalledAt;
      var remaining = Math.min(minDelay, maxDelay - elapsed);
      clearTimeout(timeout);
      timeout = setTimeout(invoke, remaining);
    }
  }

  throttled.clearTimeout = function () {
    if (timeout) {
      clearTimeout(timeout);
      lastCalledAt = args = context = null;
    }
  };

  return throttled;
}

function cachePeer (cache, peerIdentifier, nativeGeneration, handler) {
  var oldCachedPeer = cache[peerIdentifier];
  var newCachedPeer = {
    nativeGeneration: nativeGeneration,
    fakeGeneration: oldCachedPeer ? oldCachedPeer.fakeGeneration : 0,
    handler: handler,
  };
  cache[peerIdentifier] = newCachedPeer;
  return newCachedPeer;
}

function uncachePeer (cache, peerIdentifier) {
  var cachedPeer = cache[peerIdentifier];
  if (cachedPeer) {
    cachedPeer.handler.clearTimeout();
  }
  delete cache[peerIdentifier];
}

function clearCache (cache) {
  Object.keys(cache).forEach(function (peerIdentifier) {
    var cachedPeer = cache[peerIdentifier];
    cachedPeer.handler.clearTimeout();
    delete cache[peerIdentifier];
  });
}

function fixPeerGeneration (cache, nativePeer) {
  var cachedPeer = cache[nativePeer.peerIdentifier];
  var fixedPeer = extend({}, nativePeer);
  if (cachedPeer) {
    fixedPeer.generation = cachedPeer.fakeGeneration;
  }
  return fixedPeer;
}

function fixPeerHandler(cache, nonTCPPeerHandler) {
  return function (nativePeer) {
    var cachedPeer = cache[nativePeer.peerIdentifier];
    cachedPeer.fakeGeneration++;
    cachePeer(cachedPeer);
    nonTCPPeerHandler(fixPeerGeneration(cache, nativePeer));
  };
}

function zombieFilter (nonTCPPeerHandler, config) {
  var cache = {};
  var throttleOptions = {
    minDelay: config.zombieThreshold,
    maxDelay: config.maxDelay,
  };
  var fixedHandler = fixPeerHandler(cache, nonTCPPeerHandler);

  function filteredNonTCPPeerHandler (nativePeer) {
    var peerIdentifier = nativePeer.peerIdentifier;
    var peerAvailable = nativePeer.peerAvailable;
    var cachedPeer = cache[peerIdentifier];

    // just pass through recreated events
    if (nativePeer.recreated) {
      // We don't need to update cache.
      nonTCPPeerHandler(nativePeer);
      return;
    }

    if (!peerAvailable) {
      uncachePeer(cache, peerIdentifier);
      nonTCPPeerHandler(nativePeer);
      return;
    }

    var handler = cachedPeer ?
      cachedPeer.handler :
      throttle(fixedHandler, throttleOptions);

    // update cached peer with new generation and possibly new handler
    cachePeer(cache, peerIdentifier, nativePeer.generation, handler);

    handler(nativePeer);
  };

  filteredNonTCPPeerHandler.clearCache = clearCache.bind(null, cache);

  return filteredNonTCPPeerHandler;
}

zombieFilter._throttle = throttle;
zombieFilter._cachePeer = cachePeer;
zombieFilter._uncachePeer = uncachePeer;
zombieFilter._clearCache = clearCache;
zombieFilter._fixPeerGeneration = fixPeerGeneration;
zombieFilter._fixPeerHandler = fixPeerHandler;

module.exports = zombieFilter;
