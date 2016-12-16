'use strict';

var assert = require('assert');
var format = require('util').format;
var extend = require('js-extend').extend;

/**
 * @module zombieFilter
 */

/**
 * Throttled function.
 * @typedef {function} ThrottledFunction
 * @property {function} clearTimeout - clears all timeouts of the throttled
 * function and cancels scheduled execution
 */

/**
 * Returns throttled version of passed `fn`. Throttled function execution is
 * delayed for a time between `minDelay` and `maxDelay` and it is executed
 * only once after this delay with a last call arguments no matter how many
 * times it was called before execution.
 *
 * For example `fn` is a throttled version of `normalFn`, `minDelay` is
 * 100ms and `maxDelay` is 200ms. And imagine there is such a thing as `wait`
 * function that synchronously stops execution for a give amount of time. Then
 * the following snippets are equivalent:
 *
 * ```
 * console.log('start');
 * fn(1); fn(2); fn(3);
 * wait(100);
 * fn(4); fn(5); fn(6);
 * wait(100);
 *
 * fn('a'); wait(50);
 * fn('b'); wait(50);
 * fn('c'); wait(50);
 * fn('d'); wait(50);
 * fn('e'); wait(50);
 *
 * wait(100);
 * console.log('end');
 * ```
 *
 * ```
 * console.log('start');
 * wait(100);
 * notmalFn(3);
 * wait(100);
 * normalFn(6);
 *
 * wait(200);
 * normalFn('d');
 * wait(100);
 * normalFn('e');
 * console.log('end');
 * ```
 *
 * @private
 * @param {function} fn
 * @param {Object} options
 * @param {number} options.minDelay min execution delay in milliseconds
 * @param {number} options.maxDelay max execution delay in milliseconds
 * @returns {ThrottledFunction} throttled version of `fn`
 */
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

/**
 * @typedef {Object} CachedPeer
 * @property {number} nativeGeneration real generation of the peer (from native
 * layer)
 * @property {number} fakeGeneration custom generation (created by zombieFilter)
 * @property {ThrottledFunction} handler
 */

/**
 * Adds new peer entry into cache or updates existing one
 *
 * @private
 * @param {Object} cache cache to update
 * @param {string} peerIdentifier
 * @param {number} nativeGeneration real peer generation (it is actually not
 * used)
 * @param {ThrottledFunction} handler
 * @returns {CachedPeer} cached peer
 */
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

/**
 * Removes cached peer from cache and clears throttled handler
 *
 * @private
 * @param {Object} cache
 * @param {string} peerIdentifier
 */
function uncachePeer (cache, peerIdentifier) {
  var cachedPeer = cache[peerIdentifier];
  if (cachedPeer) {
    cachedPeer.handler.clearTimeout();
  }
  delete cache[peerIdentifier];
}

/**
 * "Uncache" every peer in cache
 *
 * @private
 * @param {Object} cache
 */
function clearCache (cache) {
  var uncache = uncachePeer.bind(null, cache);
  Object.keys(cache).forEach(uncache);
}

/**
 * Change peer's real generation to the fake one from cache.
 *
 * @private
 * @param {Object} cache
 * @param {Object} nativePeer peer whose generation should be fixed
 * @returns {Object} copy of the `nativePeer` with fake generation
 */
function fixPeerGeneration (cache, nativePeer) {
  var cachedPeer = cache[nativePeer.peerIdentifier];
  var fixedPeer = extend({}, nativePeer);
  if (cachedPeer) {
    fixedPeer.generation = cachedPeer.fakeGeneration;
  }
  return fixedPeer;
}

/**
 * Returns fixed version of 'peerAvailabilityChanged' event callback. Fixed
 * callback replaces native peer with a fixed by {@link fixPeerGeneration}
 *
 * @private
 * @param {Object} cache
 * @param {function} nonTCPPeerHandler event callback to be fixed
 * @returns {function}
 */
function fixPeerHandler(cache, nonTCPPeerHandler) {
  return function (nativePeer) {
    var cachedPeer = cache[nativePeer.peerIdentifier];
    nonTCPPeerHandler(fixPeerGeneration(cache, nativePeer));
    cachedPeer.fakeGeneration++;
    cachePeer(cachedPeer);
  };
}

/**
 * Enhances passed function with anti-zombie power.
 * See #1629 for details.
 *
 * @param {function} nonTCPPeerHandler original peerAvailabilityChanged event
 * handler
 * @param {Object} options
 * @param {number} options.zombieThreshold
 * @param {number} options.maxDelay
 * @returns {function} new peerAvailabilityChanged event handler that filters
 * zombies
 */
function zombieFilter (nonTCPPeerHandler, options) {
  var cache = {};
  var throttleOptions = {
    minDelay: options.zombieThreshold,
    maxDelay: options.maxDelay,
  };
  var fixedHandler = fixPeerHandler(cache, nonTCPPeerHandler);

  function filteredNonTCPPeerHandler (nativePeer) {
    var peerIdentifier = nativePeer.peerIdentifier;
    var peerAvailable = nativePeer.peerAvailable;
    var cachedPeer = cache[peerIdentifier];

    if (nativePeer.recreated) {
      // Just pass through recreated event. We don't need to update cache. This
      // event is artificial.
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

    cachePeer(cache, peerIdentifier, nativePeer.generation, handler);

    handler(nativePeer);
  };

  filteredNonTCPPeerHandler.clearCache = clearCache.bind(null, cache);

  return filteredNonTCPPeerHandler;
}

// export just for testing
zombieFilter._throttle = throttle;
zombieFilter._cachePeer = cachePeer;
zombieFilter._uncachePeer = uncachePeer;
zombieFilter._clearCache = clearCache;
zombieFilter._fixPeerGeneration = fixPeerGeneration;
zombieFilter._fixPeerHandler = fixPeerHandler;

module.exports = zombieFilter;
