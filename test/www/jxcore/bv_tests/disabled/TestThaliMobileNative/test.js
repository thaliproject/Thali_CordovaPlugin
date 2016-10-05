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

function roundTest(t, roundNumbersCount, isSimple) {
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

  var promise = serverRound.start()
  .then(function () {
    return clientRound.waitUntilStopped();
  });

  for (var roundNumber = 1; roundNumber <= roundNumbersCount; roundNumber ++) {
    (function (roundNumber) {
      promise = promise
      .then(function () {
        if (isSimple) {
          return t.sync();
        }
      })
      .then(function () {
        serverRound.setRoundNumber(roundNumber);
        clientRound.setRoundNumber(roundNumber);
        clientRound.bind();
        return serverRound.start();
      })
      .then(function () {
        return clientRound.waitUntilStopped();
      });
    }) (roundNumber);
  }

  promise
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
}

test('Simple test with single round', function (t) {
  roundTest(t, 0, true);
});
test('Simple test with two rounds', function (t) {
  roundTest(t, 1, true);
});
test('Simple test with 10 rounds', function (t) {
  roundTest(t, 10, true);
});

test('Complex test with two rounds', function (t) {
  roundTest(t, 1, false);
});
test('Complex test with 10 rounds', function (t) {
  roundTest(t, 10, false);
});
