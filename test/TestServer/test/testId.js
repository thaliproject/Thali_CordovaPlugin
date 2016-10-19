'use strict';

var test    = require('tape-catch');
var sinon   = require('sinon');
var Promise = require('bluebird');

require('../utils/process');
var Server = require('../server/Server');
var Client = require('../client/Client');


var CHECK_TIMEOUT = 200;

function shutdown(t, client, server) {
  Promise.all([
    new Promise(function (resolve) {
      client.disconnect();
      resolve();
    }),
    server.shutdown()
  ])
  .then(function () {
    t.pass('finished');
  })
  .catch(function (error) {
    t.fail('got error', error.toString());
  })
  .finally(function () {
    t.end();
  });
}

test('client should send to server it\'s id', function (t) {
  var spyServerConnect = sinon.spy(Server.prototype, '_connect');
  var spyClientConnect = sinon.spy(Client.prototype, '_connect');
  var server = new Server();
  var client = new Client();

  setTimeout(function () {
    t.ok(spyServerConnect.calledOnce, 'server \'_connect\' should be called once');
    Server.prototype._connect.restore();
    t.ok(spyClientConnect.calledOnce, 'client \'_connect\' should be called once');
    Client.prototype._connect.restore();

    t.equals(server._sockets.length, 1, 'we should have 1 server socket for client');
    t.equals(server._sockets[0].id, client.id, 'we should have the same id for server socket and client');

    shutdown(t, client, server);
  }, CHECK_TIMEOUT);
});

test('client should reconnect to server and resend it\'s id', function (t) {
  var spyServerConnect = sinon.spy(Server.prototype, '_connect');
  var spyClientConnect = sinon.spy(Client.prototype, '_connect');
  var server = new Server();
  var client = new Client({
    reconnectionDelay: CHECK_TIMEOUT
  });
  client.once('open', function () {
    client._socket.send = function (event, data) {
      // We are blocking this send attempt.
      t.equals(event, 'id', 'we tried to send client id');
      t.equals(data, client.id, 'we tried to send a valid client id');
      delete client._socket.send;

      t.equals(server._sockets.length, 1, 'we should have 1 server socket for client');
      t.notOk(server._sockets[0].id, 'we shouldn\'t have an id on the server');
      server._sockets[0].end();
    }
  });

  setTimeout(function () {
    t.ok(spyServerConnect.calledTwice, 'server \'_connect\' should be called twice');
    Server.prototype._connect.restore();
    t.ok(spyClientConnect.calledTwice, 'client \'_connect\' should be called twice');
    Client.prototype._connect.restore();

    t.equals(server._sockets.length, 1, 'we should have 1 server socket for client');
    t.equals(server._sockets[0].id, client.id, 'we should have the same id for server socket and client');

    shutdown(t, client, server);
  }, CHECK_TIMEOUT * 2);
});
