'use strict';

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
    socket.on('close', function () {
      var index = connections.findIndex(function (socket) {
        return socket === socket;
      });
      if (index === -1) {
        // Log this, it shouldn't have happened.
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
    connections = null;
  };

  return server;
}

module.exports = makeIntoCloseAllServer;
