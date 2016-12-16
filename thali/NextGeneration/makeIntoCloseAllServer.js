'use strict';

var assert = require('assert');
var Promise = require('lie');
var logger = require('../ThaliLogger')('makeIntoCloseAllServer');

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
 * @param {net.Server} server Server object
 * @param {boolean} [eatNotRunning] Will consume a not running error when
 * calling one of our close methods rather than throwing it.
 * @returns {net.Server} Wrapper making the server support close all
 */
function makeIntoCloseAllServer(server, eatNotRunning) {
  var connections = [];

  var _connectionHandler = function (socket) {
    // Add to the list of connections.
    connections.push(socket);
    // Remove from list of connections in case
    // socket is closed.
    socket.once('close', function () {
      var index = connections.indexOf(socket);
      if (index === -1) {
        assert('socket not found from the list of connections');
      }
      connections.splice(index, 1);
    });
  }
  .bind(this);
  server.on('connection', _connectionHandler);

  /**
   * Closes the server and then closes all incoming connections to the server.
   *
   * @param {thunk} [callback] Callback
   */
  server.closeAll = function (callback) {
    logger.debug('closeAll called on server');
    var forceCallback = false;
    // By closing the server first we prevent any new incoming connections
    // to the server.
    // Also note that the callback won't be called until all the connections
    // are destroyed because the destroy calls are synchronous.
    try {
      server.close(callback);
    } catch (err){
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

  var _removeAllListeners = server.removeAllListeners;
  server.removeAllListeners = function (eventName) {
    var result = _removeAllListeners.apply(this, arguments);
    if (eventName === 'connection') {
      // We can protect out connection handler
      server.on('connection', _connectionHandler);
    }
    return result;
  }

  return server;
}

module.exports = makeIntoCloseAllServer;
