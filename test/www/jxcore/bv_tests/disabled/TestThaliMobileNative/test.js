'use strict';

var tape = require('../../../lib/thaliTape');
if (!tape.coordinated) {
  return;
}

var assert = require('assert');
var Promise = require('lie');

var testUtils = require('../../../lib/testUtils');
var logger    = require('../../../lib/testLogger')('testThaliMobileNativeComplex');

var QuitSignal  = require('./QuitSignal');
var ServerRound = require('./ServerRound');
var ClientRound = require('./ClientRound');


var autostop = {};
var test = tape({
  setup: function (t) {
    autostop = {
      serverQuitSignal: null,
      serverRound: null
    };
    t.end();
  },
  teardown: function (t) {
    if (autostop.serverRound) {
      assert(
        autostop.serverQuitSignal,
        '\'autostop.serverQuitSignal\' should exist'
      );
      autostop.serverQuitSignal.raise();
      autostop.serverRound.stop()
      .catch(function (error) {
        // Ignoring any error
        logger.error('teardown error %s', error);
      })
      .then(function () {
        t.end();
      });
    } else {
      t.end();
    }
  }
});

var CONNECT_TIMEOUT = 3 * 1000;
var CONNECT_RETRY_TIMEOUT = 3.5 * 1000;
var CONNECT_RETRIES = 10;

test('Simple test with single round', function (t) {
  var serverQuitSignal = new QuitSignal();
  var clientQuitSignal = new QuitSignal();

  var serverRound = new ServerRound(t, 0, serverQuitSignal, {
    connectTimeout: CONNECT_TIMEOUT
  });
  var clientRound = new ClientRound(t, 0, clientQuitSignal, {
    connectRetries: CONNECT_RETRIES,
    connectRetryTimeout: CONNECT_RETRY_TIMEOUT,
    connectTimeout: CONNECT_TIMEOUT
  });

  autostop.serverQuitSignal = serverQuitSignal;
  autostop.serverRound = serverRound;

  serverRound.once('finished', function () {
    // We should have server up and running.
    // serverRound.stop();
  });
  clientRound.once('finished', function () {
    clientRound.stop();
  });

  serverRound.start()
  .then(function () {
    return Promise.all([
      // serverRound.waitUntilStopped(),
      clientRound.waitUntilStopped()
    ]);
  })
  .catch(function (error) {
    t.fail('Got error: ' + error);
  })
  .then(function () {
    t.end();
  });
});

test('Complex test with two rounds', function (t) {
  var serverQuitSignal = new QuitSignal();
  var clientQuitSignal = new QuitSignal();

  var serverRound = new ServerRound(t, 0, serverQuitSignal, {
    connectTimeout: CONNECT_TIMEOUT
  });
  var clientRound = new ClientRound(t, 0, clientQuitSignal, {
    connectRetries: CONNECT_RETRIES,
    connectRetryTimeout: CONNECT_RETRY_TIMEOUT,
    connectTimeout: CONNECT_TIMEOUT
  });

  autostop.serverQuitSignal = serverQuitSignal;
  autostop.serverRound = serverRound;

  serverRound.on('finished', function () {
    // We should have server up and running.
    // serverRound.stop();
  });
  clientRound.on('finished', function () {
    clientRound.stop();
  });

  serverRound.start()
  .then(function () {
    return Promise.all([
      // serverRound.waitUntilStopped(),
      clientRound.waitUntilStopped()
    ]);
  })
  .then(function () {
    serverRound.setRoundNumber(1);
    clientRound.setRoundNumber(1);
    clientRound.bind();
    return serverRound.start();
  })
  .then(function () {
    return Promise.all([
      // serverRound.waitUntilStopped(),
      clientRound.waitUntilStopped()
    ]);
  })
  .catch(function (error) {
    t.fail('Got error: ' + error);
  })
  .then(function () {
    t.end();
  });
});
