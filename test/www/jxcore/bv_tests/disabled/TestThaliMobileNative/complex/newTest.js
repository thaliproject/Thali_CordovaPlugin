'use strict';

var tape = require('../../../../lib/thaliTape');
if (!tape.coordinated) {
  return;
}

var Promise = require('lie');
var net = require('net');

var makeIntoCloseAllServer = require('thali/NextGeneration/makeIntoCloseAllServer');
var logger = require('thali/thaliLogger')('testThaliMobileNativeComplex');

var testUtils = require('../../../../lib/testUtils');

var QuitSignal  = require('../QuitSignal');
var ServerRound = require('../ServerRound');
var ClientRound = require('../ClientRound');


var serverToBeClosed;
var test = tape({
  setup: function (t) {
    serverToBeClosed = undefined;
    t.end();
  },
  teardown: function (t) {
    var promise;
    if (serverToBeClosed) {
      promise = new Promise(function (resolve) {
        serverToBeClosed.closeAll(function () {
          Mobile('stopListeningForAdvertisements').callNative(function (err) {
            t.notOk(
              err,
              'Should be able to call stopListeningForAdvertisements in teardown'
            );
            Mobile('stopAdvertisingAndListening').callNative(function (err) {
              t.notOk(
                err,
                'Should be able to call stopAdvertisingAndListening in teardown'
              );
              resolve();
            });
          });
        });
      });
    } else {
      promise = Promise.resolve();
    }
    promise
    .catch(function (error) {
      // Ignoring any error
      logger.error('teardown error %s', error);
    })
    .then(function () {
      t.end();
    });
  }
});

var TEST_TIMEOUT = 1 * 60 * 1000;

test('Simple test #0 (updating advertising and parallel data transfer)', function (t) {
  var quitSignal = new QuitSignal();

  testUtils.testTimeout(t, TEST_TIMEOUT, function () {
    quitSignal.raise();
  });

  var server = net.createServer();
  server.on('error', function (err) {
    logger.debug('got error while creating server %s', err);
  });
  server = makeIntoCloseAllServer(server);

  // 'teardown' will call close method of 'serverToBeClosed'
  // and all connections will be properly closed.
  serverToBeClosed = server;

  var serverRound = new ServerRound(t, 0, server, quitSignal);
  var clientRound = new ClientRound(t, 0, quitSignal);

  serverRound.start()
  .then(function () {
    return Promise.all([
      serverRound.waitUntilStopped(),
      clientRound.waitUntilStopped()
    ]);
  })
  .then(function () {
    // Just to be sure that no one can create new requests.
    quitSignal.raise();
  })
  .catch(function (error) {
    t.fail('Got error: ' + error);
  })
  .then(function () {
    t.pass('We made it through round one in simple test');
    t.end();
  });
});
