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

    setTimeout(function () {
      t.ok(spyServerConnect.calledOnce, 'server \'_connect\' should be called once');
      Server.prototype._connect.restore();
      t.ok(spyClientConnect.calledOnce, 'client \'_connect\' should be called once');
      Client.prototype._connect.restore();

      shutdown(t, client, server);
    }, CHECK_TIMEOUT);
  }, CHECK_TIMEOUT);
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

    setTimeout(function () {
      t.ok(spyServerConnect.calledOnce, 'server \'_connect\' should be called once');
      Server.prototype._connect.restore();
      t.ok(spyClientConnect.calledOnce, 'client \'_connect\' should be called once');
      Client.prototype._connect.restore();

      shutdown(t, client, server);
    }, CHECK_TIMEOUT * 2);
  }, CHECK_TIMEOUT);
});

test('client should be able to reconnect to server if it restarted', function (t) {
  var spyServerConnect = sinon.spy(Server.prototype, '_connect');
  var spyClientConnect = sinon.spy(Client.prototype, '_connect');
  var server = new Server();
  var client = new Client({
    reconnectionDelay: CHECK_TIMEOUT
  });

  setTimeout(function () {
    t.ok(spyServerConnect.calledOnce, 'server \'_connect\' should be called once');
    t.ok(spyClientConnect.calledOnce, 'client \'_connect\' should be called once');

    server.shutdown()
    .then(function () {
      server.start();

      setTimeout(function () {
        t.ok(spyServerConnect.calledTwice, 'server \'_connect\' should be called twice');
        Server.prototype._connect.restore();
        t.ok(spyClientConnect.calledTwice, 'client \'_connect\' should be called twice');
        Client.prototype._connect.restore();

        shutdown(t, client, server);
      }, CHECK_TIMEOUT * 2);
    });
  }, CHECK_TIMEOUT);
});

/*
test.only('client should be able to reconnect to server if network failed silently (by using keep alive)', function (t) {
  var spyServerConnect = sinon.spy(Server.prototype, '_connect');
  var spyClientConnect = sinon.spy(Client.prototype, '_connect');
  var server = new Server();
  var client = new Client({
    reconnectionDelay: CHECK_TIMEOUT,
    keepAliveTimeout:  CHECK_TIMEOUT
  });

  setTimeout(function () {
  }, CHECK_TIMEOUT);
});
*/
