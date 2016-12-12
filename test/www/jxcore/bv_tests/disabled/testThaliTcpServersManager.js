'use strict';

var originalMobile = typeof Mobile === 'undefined' ? undefined : Mobile;
var mockMobile = require('../lib/MockMobile');
var net = require('net');
var multiplex = require('multiplex');
var tape = require('../lib/thaliTape');
var ThaliTCPServersManager = require('thali/NextGeneration/mux/thaliTcpServersManager');
var makeIntoCloseAllServer = require('thali/NextGeneration/makeIntoCloseAllServer');
var Promise = require('lie');
var proxyquire = require('proxyquire');

var applicationPort = 4242;
var serversManager = null;

var test = tape({
  setup: function (t) {
    global.Mobile = mockMobile;
    serversManager = new ThaliTCPServersManager(applicationPort);
    t.end();
  },
  teardown: function (t) {
    (serversManager ? serversManager.stop() : Promise.resolve())
      .catch(function (err) {
        t.fail('serversManager had stop error ' + err);
      })
      .then(function () {
        global.Mobile = originalMobile;
        t.end();
      });
  }
});

test('can create servers manager', function (t) {
  t.ok(serversManager != null, 'serversManager must not be null');
  t.ok(typeof serversManager === 'object', 'serversManager must be an object');
  serversManager = null; // So we don't call stop when we had not called start
  t.end();
});

test('calling stop without start causes error', function (t) {
  serversManager.stop()
    .then(function () {
      t.fail('we should have gotten an error saying to call start');
      t.end();
    }).catch(function (err) {
      t.equal(err.message, 'Call Start!', 'We need to call start first');
      serversManager = null; // Stop teardown from calling stop
      t.end();
    });
});

test('can start/stop servers manager', function (t) {
  serversManager.start()
  .then(function (localPort) {
    t.ok(localPort > 0 && localPort <= 65535, 'port must be in range');
  })
  .then(function () {
    t.end();
  })
  .catch(function (err) {
    t.fail('server should not get error - ' + err);
    t.end();
  });
});

test('starting twice resolves with listening port', function (t) {
  var localPort = null;
  serversManager.start()
  .then(function (localLocalPort) {
    localPort = localLocalPort;
    return serversManager.start();
  }).then(function (port) {
    t.equal(localPort, port, 'second start should return same port');
    t.end();
  }).catch(function (err) {
    t.fail('server should not get error - ' + err);
    t.end();
  });
});

test('terminateIncomingConnection will terminate a connection', function (t) {
  var disconnectReceived = false;
  var terminateResolved = false;
  var clientClosed = false;

  /*
  Setup a serversManager and connect to it from a client. Then catch the
  event and call terminate and make sure the client sees its connection
  terminate.
   */
  var applicationServer = null;

  var wasShutDown = false;
  function shutDown(err) {
    if (wasShutDown) {
      return;
    }

    wasShutDown = true;

    if (err) {
      t.fail(err);
    }

    return applicationServer.closeAllPromise()
      .catch(function (err) {
        t.fail('application server close failed with ' + err);
      })
      .then(function () {
        t.end();
      });
  }

  function trySuccess() {
    if (disconnectReceived && terminateResolved && clientClosed) {
      shutDown();
    }
  }

  applicationServer = makeIntoCloseAllServer(net.createServer())
    .listen(0, function () {
      serversManager = new ThaliTCPServersManager(this.address().port);
      applicationServer.removeListener('error', shutDown);
      serversManager.start()
      .then(function (localPort) {
        var client = net.createConnection(localPort, function () {
          client.removeListener('error', shutDown);
          client.on('close', function () {
            clientClosed = true;
            trySuccess();
          });
        });
        client.once('error', shutDown);
      });

      applicationServer.once('error', shutDown);
      serversManager.once(serversManager.INCOMING_CONNECTION_STATE,
        function (incomingConnectionState) {
          t.equal(incomingConnectionState.state,
            serversManager.incomingConnectionState.CONNECTED,
            'we should be connected');
          serversManager.once(serversManager.INCOMING_CONNECTION_STATE,
            function (incomingConnectionState) {
              t.equal(incomingConnectionState.state,
                serversManager.incomingConnectionState.DISCONNECTED,
                'now we are disconnected');
              disconnectReceived = true;
              trySuccess();
            });
          serversManager.terminateIncomingConnection(
            incomingConnectionState.incomingConnectionId)
            .then(function () {
              // Let's make sure it's actually idempotent
              return serversManager.terminateIncomingConnection(
                incomingConnectionState.incomingConnectionId
              );
            })
            .then(function () {
              terminateResolved = true;
              trySuccess();
            })
            .catch(shutDown);
        });
    });
});

test('terminate an Outgoing connection',
  function (t) {
    serversManager = null;
    var closeServerFunction = null;
    var closeServerCalled = false;
    var ProxiedTCPServersManager =
      proxyquire('thali/NextGeneration/mux/thaliTcpServersManager',
        { './createPeerListener': {
          closeServer: function () {
            return closeServerFunction.apply(this, arguments);
          }
        } });

    closeServerFunction = function () {
      t.fail('We should not have been called on this test');
    };

    var proxiedTCPServersManager = new ProxiedTCPServersManager(55);
    return proxiedTCPServersManager.terminateOutgoingConnection('foo', 32)
    .then(function () {
      t.ok(true, 'Passed bogus id');
      proxiedTCPServersManager._peerServers.foo = {
        server: {
          address: function () {
            return {
              port: 900
            };
          }
        }
      };
      closeServerFunction = function () {
        t.fail('Second try - should not have been called.');
      };
      return proxiedTCPServersManager.terminateOutgoingConnection('foo', 901);
    })
    .then(function () {
      t.ok(true, 'Passed good id but bogus port');
      closeServerFunction = function (self, server, error, retry) {
        t.equal(self, proxiedTCPServersManager, 'Passed right context');
        t.equal(server, proxiedTCPServersManager._peerServers.foo.server,
          'Right server');
        t.equal(error, null, 'No error should be set');
        t.equal(retry, false, 'Retry should be false');
        closeServerCalled = true;
      };
      return proxiedTCPServersManager.terminateOutgoingConnection('foo', 900);
    })
    .then(function () {
      t.ok(closeServerCalled, 'We called close server');
    })
    .catch(function (err) {
      t.fail('Got an error, should not be possible. ' + err);
    })
    .then(function () {
      t.end();
    });
  });
