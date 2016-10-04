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


var test = tape({
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    t.end();
  }
});

var TEST_TIMEOUT          = 1 * 60 * 1000;
var CONNECT_TIMEOUT       = 3 * 1000;
var CONNECT_RETRY_TIMEOUT = 3.5 * 1000;
var CONNECT_RETRIES       = 10;

test('Simple test with single round', function (t) {
  var serverQuitSignal = new QuitSignal();
  var clientQuitSignal = new QuitSignal();

  testUtils.testTimeout(t, TEST_TIMEOUT, function () {
    // serverQuitSignal.raise();
    clientQuitSignal.raise();
  });

  var serverRound = new ServerRound(t, 0, serverQuitSignal, {
    connectTimeout: CONNECT_TIMEOUT
  });
  var clientRound = new ClientRound(t, 0, clientQuitSignal, {
    connectRetries: CONNECT_RETRIES,
    connectRetryTimeout: CONNECT_RETRY_TIMEOUT,
    connectTimeout: CONNECT_TIMEOUT
  });

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
    return t.sync();
  })
  .then(function () {
    serverQuitSignal.raise();
    clientQuitSignal.raise();
    return serverRound.stop();
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

  testUtils.testTimeout(t, TEST_TIMEOUT, function () {
    // serverQuitSignal.raise();
    clientQuitSignal.raise();
  });

  var serverRound = new ServerRound(t, 0, serverQuitSignal, {
    connectTimeout: CONNECT_TIMEOUT
  });
  var clientRound = new ClientRound(t, 0, clientQuitSignal, {
    connectRetries: CONNECT_RETRIES,
    connectRetryTimeout: CONNECT_RETRY_TIMEOUT,
    connectTimeout: CONNECT_TIMEOUT
  });

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
    return t.sync();
  })
  .then(function () {
    serverQuitSignal.raise();
    clientQuitSignal.raise();
    return serverRound.stop();
  })
  .catch(function (error) {
    t.fail('Got error: ' + error);
  })
  .then(function () {
    t.end();
  });
});
