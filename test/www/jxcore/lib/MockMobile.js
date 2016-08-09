'use strict';
var next = {};
var registered = {};

var mocks = {
  // Default handlers for mocks.
  // If there's an entry in next[key], call that instead
  startListeningForAdvertisements : function (cb) {
    cb(null);
  },
  startUpdateAdvertisingAndListening : function (port, cb) {
    cb(null);
  }
};

/* jshint -W079 */
var Mobile = function (key) {
  /* jshint +W079 */
  return {
    // Call a native function
    callNative: function () {
      // If there's a handler specified then call that
      if (key in next) {
        var fn = next[key].shift();
        if (next[key].length === 0) {
          delete next[key];
        }
        fn.apply(this, arguments);
        return;
      }

      // .. else call the default
      if (key in mocks) {
        mocks[key].apply(this, arguments);
      }
      else {
        throw new Error('Mock does not implement: ' + key);
      }
    },

    // Queue up handlers for native calls
    nextNative: function (fn) {
      if (key in next) {
        next[key].push(fn);
      }
      else {
        next[key] = [fn];
      }
    },

    // Register a function
    registerToNative: function (callback) {
      registered[key] = callback;
    },

    // Call a registered function
    callRegistered: function () {
      // Call a registered function
      if (key in registered) {
        registered[key].apply(this, arguments);
      }
      else {
        throw new Error('Function not registered: ', key);
      }
    }
  };
};

Mobile.createListenerOrIncomingConnection =
  function (listeningPort, clientPort, serverPort) {
    return JSON.stringify({
      listeningPort: listeningPort,
      clientPort: clientPort,
      serverPort: serverPort
    });
  };

module.exports = Mobile;
