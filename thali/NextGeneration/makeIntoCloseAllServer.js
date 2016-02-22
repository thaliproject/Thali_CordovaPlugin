'use strict';

var assert = require('assert');

/** @module makeIntoCloseAllServer */

/**
 * Takes any of the NET server object types (such as HTTP, HTTPS and NET itself
 * which we use for TCP) and calls their createServer method with the submitted
 * options and connectionListener. It's job is to add a closeAll method that
 * if called will destroy any outstanding connections to the server as well
 * as close the server itself.
 *
 * @public
 * @param {net.Server} server
 * @returns {Object}
 */
function makeIntoCloseAllServer(server) {
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
   * @param {callback} [callback]
   */
  server.closeAll = function (callback) {
    // By closing the server first we prevent any new incoming connections
    // to the server.
    // Also note that the callback won't be called until all the connections
    // are destroyed because the destroy calls are synchronous.
    this.close(callback);
    connections.forEach(function (connection) {
      connection.destroy();
    });
  };

  return server;
}

module.exports = makeIntoCloseAllServer;
