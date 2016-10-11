'use strict';

var test    = require('tape-catch');
var sinon   = require('sinon');
var Promise = require('bluebird');

require('../utils/process');
var Server = require('../Server');
var Client = require('../Client');


var CHECK_TIMEOUT = 500;

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

test('client and server connectable', function (t) {
  var spyServerConnect = sinon.spy(Server.prototype, '_connect');
  var spyClientConnect = sinon.spy(Client.prototype, '_connect');
  var server = new Server();
  var client = new Client();

  setTimeout(function () {
    t.ok(spyServerConnect.calledOnce, 'server \'_connect\' should be called once');
    Server.prototype._connect.restore();
    t.ok(spyClientConnect.calledOnce, 'client \'_connect\' should be called once');
    Client.prototype._connect.restore();

    shutdown(t, client, server);
  }, CHECK_TIMEOUT);
});

test('client should be able to connect to server if it was created after server', function (t) {
  var spyServerConnect = sinon.spy(Server.prototype, '_connect');
  var spyClientConnect = sinon.spy(Client.prototype, '_connect');
  var client;
  var server = new Server();
  setTimeout(function () {
    client = new Client();
  }, CHECK_TIMEOUT);

  setTimeout(function () {
    t.ok(spyServerConnect.calledOnce, 'server \'_connect\' should be called once');
    Server.prototype._connect.restore();
    t.ok(spyClientConnect.calledOnce, 'client \'_connect\' should be called once');
    Client.prototype._connect.restore();

    shutdown(t, client, server);
  }, CHECK_TIMEOUT * 2);
});

test('client should be able to reconnect to server if it was created before server', function (t) {
  var spyServerConnect = sinon.spy(Server.prototype, '_connect');
  var spyClientConnect = sinon.spy(Client.prototype, '_connect');
  var server;
  var client = new Client({
    reconnectionDelay: CHECK_TIMEOUT
  });
  setTimeout(function () {
    server = new Server();
  }, CHECK_TIMEOUT);

  setTimeout(function () {
    t.ok(spyServerConnect.calledOnce, 'server \'_connect\' should be called once');
    Server.prototype._connect.restore();
    t.ok(spyClientConnect.calledOnce, 'client \'_connect\' should be called once');
    Client.prototype._connect.restore();

    shutdown(t, client, server);
  }, CHECK_TIMEOUT * 2);
});

/*
test('client should be able to reconnect to server if network failed silently (by using keep alive)', function (t) {
  var spyServerConnect = sinon.spy(Server.prototype, '_connect');
  var spyClientConnect = sinon.spy(Client.prototype, '_connect');
  var server = new Server();
  var client = new Client({
    reconnectionDelay: CHECK_TIMEOUT,
    keepAliveTimeout:  CHECK_TIMEOUT
  });
  // var socket = client._socket.socket;
  // console.log(socket._handle.__proto__);
  setTimeout(function () {
  }, CHECK_TIMEOUT);
});
*/
