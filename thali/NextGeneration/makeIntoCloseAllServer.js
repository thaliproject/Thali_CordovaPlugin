'use strict';

var assert = require('assert');
var Promise = require('lie');

/** @module makeIntoCloseAllServer */

/**
 * @public
 * @callback thunk
 */

/**
 * Takes any of the NET server object types (such as HTTP, HTTPS and NET itself
 * which we use for TCP) and calls their createServer method with the submitted
 * options and connectionListener. It's job is to add a closeAll method that
 * if called will destroy any outstanding connections to the server as well
 * as close the server itself.
 *
 * @public
 * @param {net.Server} server
 * @param {boolean} [eatNotRunning] Will consume a not running error when
 * calling one of our close methods rather than throwing it.
 * @returns {net.Server}
 */
function makeIntoCloseAllServer(server, eatNotRunning) {
  var connections = [];

  server.on('connection', function (socket) {
    // Add to the list of connections.
    connections.push(socket);
    // Remove from list of connections in case
    // socket is closed.
    socket.on('close', function () {
      var index = -1;
      for (var i = 0; i < connections.length; i++) {
        if (connections[i] === socket) {
          index = i;
          break;
        }
      }
      if (index === -1) {
        assert('socket not found from the list of connections');
      }
      connections = connections.splice(index, 1);
    });
  });

  /**
   * Closes the server and then closes all incoming connections to the server.
   *
   * @param {thunk} [callback]
   */
  server.closeAll = function (callback) {
    var forceCallback = false;
    // By closing the server first we prevent any new incoming connections
    // to the server.
    // Also note that the callback won't be called until all the connections
    // are destroyed because the destroy calls are synchronous.
    try {
      server.close(callback);
    } catch(err){
      if (!eatNotRunning || !(err instanceof Error) ||
        (err && err.message !== 'Not running')) {
        throw err;
      }
      forceCallback = true;
    }

    connections.forEach(function (connection) {
      connection.destroy();
    });

    if (forceCallback && callback) {
      callback();
    }
  };

  /**
   * Same as closeAll but returns a promise.
   *
   * @returns {Promise<?Error>}
   */
  server.closeAllPromise = function () {
    var self = this;
    return new Promise(function (resolve, reject) {
      self.closeAll(function (err) {
        if (err) {
          return reject(err);
        }
        resolve();
      });
    });
  };

  return server;
}

module.exports = makeIntoCloseAllServer;
