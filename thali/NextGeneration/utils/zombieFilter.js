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
 * normalFn(3);
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

  var args, context;
  var timeout = null;
  var lastCalledAt = null;

  function invoke () {
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
      // JXcore passes setTimeout as an argument to the module wrapper and it
      // cannot be overwritten by sinon's fake timers for testing.
      // See https://github.com/thaliproject/jxcore/issues/86
      timeout = global.setTimeout(invoke, minDelay);
    } else {
      var elapsed = now - lastCalledAt;
      var remaining = Math.min(minDelay, maxDelay - elapsed);
      global.clearTimeout(timeout);
      timeout = global.setTimeout(invoke, remaining);
    }
  }

  throttled.clearTimeout = function () {
    if (timeout) {
      global.clearTimeout(timeout);
      lastCalledAt = args = context = null;
    }
  };

  return throttled;
}

/**
 * @typedef {Object} CachedPeer
 * @property {number} generation
 * @property {ThrottledFunction} handler
 */

/**
 * Cache that stores info about available peers (fixed generation and throttled
 * handlers)
 * @private
 * @class
 */
function Cache() {
  this._cache = {};
}

/**
 * Get cached peer by its id
 *
 * @param {string} peerIdentifier
 * @returns {?CachedPeer}
 */
Cache.prototype.get = function (peerIdentifier) {
  return this._cache[peerIdentifier] || null;
};

/**
 * Adds new peer entry into cache or updates existing one
 *
 * @param {string} peerIdentifier
 * @param {number} generation
 * @param {ThrottledFunction} handler
 * @returns {CachedPeer} cached peer
 */
Cache.prototype.addOrUpdate = function (peerIdentifier, generation, handler) {
  var oldCachedPeer = this._cache[peerIdentifier];
  var newCachedPeer = {
    generation: generation,
    handler: handler,
  };
  if (oldCachedPeer && oldCachedPeer.handler !== handler) {
    oldCachedPeer.handler.clearTimeout();
  }
  this._cache[peerIdentifier] = newCachedPeer;
  return newCachedPeer;
};

/**
 * Increment generation of the peer in cache if such a peer exists
 * @param {string} peerIdentifier
 */
Cache.prototype.incrementGeneration = function (peerIdentifier) {
  var peer = this.get(peerIdentifier);
  if (peer) {
    this.addOrUpdate(peerIdentifier, peer.generation + 1, peer.handler);
  }
};

/**
 * Removes cached peer from cache and clears throttled handler
 *
 * @param {string} peerIdentifier
 */
Cache.prototype.remove = function (peerIdentifier) {
  var cachedPeer = this._cache[peerIdentifier];
  if (cachedPeer) {
    cachedPeer.handler.clearTimeout();
  }
  delete this._cache[peerIdentifier];
};

/**
 * Remove all peers from cache
 */
Cache.prototype.clear = function () {
  Object.keys(this._cache).forEach(function (peerId) {
    this.remove(peerId);
  }, this);
};


/**
 * Replaces peer's real generation with the generation from the cache.
 *
 * @private
 * @param {Object} cache
 * @param {Object} nativePeer peer whose generation should be fixed
 * @returns {Object} copy of the `nativePeer` with fake generation
 */
function fixPeerGeneration (cache, nativePeer) {
  var cachedPeer = cache.get(nativePeer.peerIdentifier);
  if (!cachedPeer) {
    return nativePeer;
  }
  var fixedPeer = extend({}, nativePeer);
  fixedPeer.generation = cachedPeer.generation;
  return fixedPeer;
}

/**
 * Returns fixed version of 'peerAvailabilityChanged' event callback. Fixed
 * callback replaces native peer with a fixed by {@link fixPeerGeneration}
 *
 * @private
 * @param {Object} cache
 * @param {function} originalHandler event callback to be fixed
 * @returns {function}
 */
function fixPeerHandler(cache, originalHandler) {
  return function (nativePeer) {
    var fixedPeer = fixPeerGeneration(cache, nativePeer);
    originalHandler(fixedPeer);
    cache.incrementGeneration(nativePeer.peerIdentifier);
  };
}

/**
 * Enhances passed function with anti-zombie power.
 *
 * See https://github.com/thaliproject/Thali_CordovaPlugin/issues/1629 for
 * details.
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
  assert(options, 'options are required');
  assert.equal(typeof options.zombieThreshold, 'number',
    'zombieThreshold is a number');
  assert.equal(typeof options.maxDelay, 'number', 'maxDelay is a number');
  assert(
    options.zombieThreshold <= options.maxDelay,
    format(
      'zombieThreshold(%d) can\'t be greater than maxDelay(%d)',
      options.zombieThreshold,
      options.maxDelay
    )
  );

  var cache = new Cache();
  var throttleOptions = {
    minDelay: options.zombieThreshold,
    maxDelay: options.maxDelay,
  };

  var fixedHandler = fixPeerHandler(cache, nonTCPPeerHandler);

  function filteredNonTCPPeerHandler (nativePeer) {
    var peerIdentifier = nativePeer.peerIdentifier;
    var peerAvailable = nativePeer.peerAvailable;
    var cachedPeer = cache.get(peerIdentifier);

    if (nativePeer.recreated) {
      // Just pass through recreated event. We don't need to update cache. This
      // event is artificial.
      nonTCPPeerHandler(nativePeer);
      return;
    }

    if (!peerAvailable) {
      cache.remove(peerIdentifier);
      nonTCPPeerHandler(nativePeer);
      return;
    }

    if (!cachedPeer) {
      cachedPeer = cache.addOrUpdate(
        peerIdentifier, 0, throttle(fixedHandler, throttleOptions)
      );
    }

    var throttledAndFixedHandler = cachedPeer.handler;
    throttledAndFixedHandler(nativePeer);
  };

  filteredNonTCPPeerHandler.clearCache = cache.clear.bind(cache);

  return filteredNonTCPPeerHandler;
}

// export just for testing
zombieFilter._throttle = throttle;
zombieFilter._Cache = Cache;
zombieFilter._fixPeerGeneration = fixPeerGeneration;
zombieFilter._fixPeerHandler = fixPeerHandler;

module.exports = zombieFilter;
