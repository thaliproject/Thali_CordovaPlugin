'use strict';

var tape = require('../lib/thaliTape');
if (!tape.coordinated) {
  return;
}

var util   = require('util');
var format = util.format;

var net          = require('net');
var Promise      = require('bluebird');
var EventEmitter = require('events').EventEmitter;

var makeIntoCloseAllServer = require('thali/NextGeneration/makeIntoCloseAllServer');

var logger = require('../lib/testLogger')('testPeerAvailabilityOverhead');


var test = tape({
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    t.end();
  }
});

function getOverhead(timeout) {
  return new Promise(function (resolve) {
    var immediate;
    var count = 0;
    var overhead = [0, 0];
    var start;

    function handler() {
      count ++;
      var diff = process.hrtime(start);
      overhead[0] += diff[0];
      overhead[1] += diff[1];
      immediate = setImmediate(handler);
      start = process.hrtime();
    }
    start = process.hrtime();
    handler();

    setTimeout(function () {
      clearImmediate(immediate);
      resolve(overhead[0] + overhead[1] / 1e9);
    }, timeout);
  });
}

function start () {
  return new Promise(function (resolve, reject) {
    var server = makeIntoCloseAllServer(net.createServer());
    server.listen(0, function () {
      var port = server.address().port;

      var index = 0;
      Mobile('peerAvailabilityChanged').registerToNative(function () {
        logger.debug('we\'ve received peerAvailabilityChanged event');
        index ++;
      });

      Mobile('startUpdateAdvertisingAndListening').callNative(port, function (error) {
        if (error) {
          reject(error);
          return;
        }

        Mobile('startListeningForAdvertisements').callNative(function (error) {
          if (error) {
            reject(error);
          } else {
            resolve(server);
          }
        });
      });
    });
  });
}

function stop(server) {
  return new Promise(function (resolve, reject) {
    // This is the way to unbind 'peerAvailabilityChanged'.
    Mobile('peerAvailabilityChanged').registerToNative(function () {});

    server.closeAll(function () {
      Mobile('stopListeningForAdvertisements').callNative(function (error) {
        if (error) {
          reject(error);
          return;
        }

        Mobile('stopAdvertisingAndListening').callNative(function (error) {
          if (error) {
            reject(error);
          } else {
            resolve();
          }
        });
      });
    });
  });
}

test('get peerAvailabilityChanged overhead', function (t) {
  var TIMEOUT = 10 * 1000;

  getOverhead(TIMEOUT)
  .then(function (startOverhead) {
    logger.info('start overhead', startOverhead);

    return start()
    .then(function (server) {
      return t.sync()

      .then(function () {
        return getOverhead(TIMEOUT);
      })
      .then(function (overhead) {
        logger.info('result overhead', overhead);
        logger.info('diff', overhead - startOverhead);
      })

      .then(t.sync)
      .then(function () {
        return stop(server);
      });
    });
  })
  .then(function () {
    t.end();
  });
});
