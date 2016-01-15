'use strict';

var util = require('util');
var net = require('net');
var http = require('http');

/** @module makeIntoCloseAllServer */

/**
 * Takes any of the NET server object types (such as HTTP, HTTPS and NET itself
 * which we use for TCP) and calls their createServer method with the submitted
 * options and connectionListener. It's job is to add a closeAll method that
 * if called will destroy any outstanding connections to the server as well
 * as close the server itself.
 *
 * @public
 * @param server
 * @returns {Object}
 */
function makeIntoCloseAllServer(server) {
  var connections = [];

  server.on('connection', function (socket) {
    socket.on('close', function() {
      var index = connections.findIndex(connection);
      if (index === -1) {
        // Log this, it shouldn't have happened.
      }
      connections = connections.splice(index, 1);
    });
  });

  // We don't override close because we don't want to change its semantics.
  server.closeAll = function () {
    connections.forEach(function (connection) {
      connection.destroy();
    });
    connections = null;
    this.close();
  };

  return server;
}

module.exports = makeIntoCloseAllServer;