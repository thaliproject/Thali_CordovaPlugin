'use strict';

var tape = require('../lib/thaliTape');
var LocalSeqManager = require('thali/NextGeneration/replication/localSeqManager');
var net = require('net');
var thaliMobile = require('thali/NextGeneration/thaliMobile');
var crypto = require('crypto');
var thaliConfig = require('thali/NextGeneration/thaliConfig');
var Promise = require('lie');
var testUtils = require('../lib/testUtils');
var makeIntoCloseAllServer = require('thali/NextGeneration/makeIntoCloseAllServer');
var https = require('https');
var thaliNotificationBeacons = require('thali/NextGeneration/notification/thaliNotificationBeacons');
var httpTester = require('../lib/httpTester');
var express = require('express');

var devicePublicPrivateKey = crypto.createECDH(thaliConfig.BEACON_CURVE);
var devicePublicKey = devicePublicPrivateKey.generateKeys();
var testCloseAllServer = null;
var localSeqManager = null;
var pskId = 'yo ho ho';
var pskKey = new Buffer('Nothing going on here');


var test = tape({
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    if (localSeqManager) {
      localSeqManager.stop();
      localSeqManager = null;
    }
    (testCloseAllServer ? testCloseAllServer.closeAllPromise() :
                         Promise.resolve())
      .catch(function (err) {
        t.fail('Got error in teardown ' + JSON.stringify(err));
      })
      .then(function () {
        testCloseAllServer = null;
        t.end();
      });
  }
});

function runBadImmediateSeqUpdateTest(t, serverPort, validateErrFunc) {
  var pouchDB = testUtils.createPskPouchDBRemote(serverPort, 'foo', pskId,
                                                  pskKey);
  localSeqManager = new LocalSeqManager(100, pouchDB, devicePublicKey);
  localSeqManager._doImmediateSeqUpdate(23)
    .then(function () {
      t.fail('Somehow got a success');
    })
    .catch(validateErrFunc)
    .then(function () {
      t.end();
    });
}

test('#_doImmediateSeqUpdate - server is not there', function (t) {
  testCloseAllServer = makeIntoCloseAllServer(net.createServer(), true);

  testCloseAllServer.listen(0, function () {
    var serverPort = testCloseAllServer.address().port;
    // This provides a non zero probability that serverPort is available
    testCloseAllServer.closeAllPromise()
      .then(function () {
        runBadImmediateSeqUpdateTest(t, serverPort, function (err) {
          t.equal(err.message, 'connect ECONNREFUSED', 'Got right error');
        });
      })
      .catch(function (err) {
        t.fail('Got error on close all - ' + JSON.stringify(err));
      });
  });
});

test('#_doImmediateSeqUpdate - server accepts & closes connection',
  function (t) {
    testCloseAllServer = makeIntoCloseAllServer(
      net.createServer(function (socket) {
        socket.end();
      }), true);

    testCloseAllServer.listen(0, function () {
      var serverPort = testCloseAllServer.address().port;
      runBadImmediateSeqUpdateTest(t, serverPort, function (err) {
        t.equal(err.message, 'socket hang up', 'Got socket hang up');
      });
    });
  });

test('#_doImmediateSeqUpdate - server always returns 500', function (t) {
  var options = {
    ciphers : thaliConfig.SUPPORTED_PSK_CIPHERS,
    pskCallback : function (id) {
      return id === pskId ? pskKey : null;
    },
    key: thaliConfig.BOGUS_KEY_PEM,
    cert: thaliConfig.BOGUS_CERT_PEM
  };
  testCloseAllServer = makeIntoCloseAllServer(
    https.createServer(options, function (req, res) {
      res.writeHead(500, 'Nobody home');
      res.end();
    }));

  testCloseAllServer.listen(0, function () {
    var serverPort = testCloseAllServer.address().port;
    runBadImmediateSeqUpdateTest(t, serverPort, function (err) {
      t.equal(err.status, 500, 'Got 500 as expected');
    });
  });
});

function validateRev(t, rev, lastSyncedSequenceNumber, randomDBName, serverPort)
{
  return httpTester.validateSeqNumber(t, randomDBName, serverPort,
    lastSyncedSequenceNumber, pskId, pskKey, devicePublicKey)
    .then(function (pouchResponse) {
      t.equal(pouchResponse._rev, rev, 'revs are equal');
    });
}

test('#_doImmediateSeqUpdate - create new seq doc', function (t) {
  testCloseAllServer = testUtils.setUpServer(
    function (serverPort, randomDBName, remotePouchDB) {
      localSeqManager =
        new LocalSeqManager(100, remotePouchDB, devicePublicKey);
      var lastSyncedSequenceNumber = 23;

      localSeqManager._doImmediateSeqUpdate(lastSyncedSequenceNumber)
      .then(function (rev) {
        return validateRev(t, rev, lastSyncedSequenceNumber, randomDBName,
                            serverPort);
      })
      .catch(function (err) {
        t.fail('Got an error - ' + JSON.stringify(err));
      })
      .then(function () {
        t.end();
      });
    }
  );
});

test('#_doImmediateSeqUpdate - doc exists, need to get rev and update',
  function (t) {
    testCloseAllServer = testUtils.setUpServer(function (serverPort,
                                                         randomDBName,
                                                         remotePouchDB) {
      var lastSyncedSequenceNumber = 23;
      localSeqManager =
        new LocalSeqManager(100, remotePouchDB, devicePublicKey);
      localSeqManager._doImmediateSeqUpdate(lastSyncedSequenceNumber)
        .then(function () {
          localSeqManager.stop();
          localSeqManager =
            new LocalSeqManager(100, remotePouchDB, devicePublicKey);
          lastSyncedSequenceNumber = 101;
          return localSeqManager
            ._doImmediateSeqUpdate(lastSyncedSequenceNumber);
        })
        .then(function (rev) {
          return validateRev(t, rev, lastSyncedSequenceNumber, randomDBName,
                              serverPort);
        })
        .catch(function (err) {
          t.fail('Got an error - ' + JSON.stringify(err));
        })
        .then(function () {
          t.end();
        });
    });
  });

test('#_doImmediateSeqUpdate - update seq three times', function (t) {
  testCloseAllServer = testUtils.setUpServer(function (serverPort, randomDBName,
                                             remotePouchDB) {
    var lastSyncedSequenceNumber = 102;
    localSeqManager =
      new LocalSeqManager(100, remotePouchDB, devicePublicKey);
    function curryValidateRev(rev) {
      return validateRev(t, rev, lastSyncedSequenceNumber, randomDBName,
                          serverPort);
    }
    localSeqManager._doImmediateSeqUpdate(lastSyncedSequenceNumber)
      .then(function (rev) {
        return curryValidateRev(rev);
      })
      .then(function () {
        lastSyncedSequenceNumber = 103;
        return localSeqManager._doImmediateSeqUpdate(lastSyncedSequenceNumber);
      })
      .then(function (rev) {
        return curryValidateRev(rev);
      })
      .then(function () {
        lastSyncedSequenceNumber = 232342234234;
        return localSeqManager._doImmediateSeqUpdate(lastSyncedSequenceNumber);
      })
      .then(function (rev) {
        return curryValidateRev(rev);
      })
      .catch(function (err) {
        t.fail('Got error - ' + JSON.stringify(err));
      })
      .then(function () {
        t.end();
      });
  });
});

test('#_doImmediateSeqUpdate - rev got changed under us', function (t) {
  testCloseAllServer = testUtils.setUpServer(function (serverPort, randomDBName,
                                             remotePouchDB) {
    var lastSyncedSequenceNumber = 1000000;
    localSeqManager =
      new LocalSeqManager(100, remotePouchDB, devicePublicKey);
    var sneakyLocalSeqManager =
      new LocalSeqManager(100, remotePouchDB, devicePublicKey);

    localSeqManager._doImmediateSeqUpdate(lastSyncedSequenceNumber)
      .then(function () {
        lastSyncedSequenceNumber += 100;
        return sneakyLocalSeqManager.
                _doImmediateSeqUpdate(lastSyncedSequenceNumber);
      })
      .catch(function (err) {
        t.fail('Got an error - ' + JSON.stringify(err));
      })
      .then(function () {
        lastSyncedSequenceNumber += 200;
        return localSeqManager._doImmediateSeqUpdate(lastSyncedSequenceNumber);
      })
      .then(function () {
        t.fail('This should have failed because only one instance of ' +
          'the replication for a particular public key should be active ' +
          'at one time.');
      })
      .catch(function (err) {
        t.equal(err.status, 409, 'Our rev is old so we should fail');
      })
      .then(function () {
        sneakyLocalSeqManager.stop();
        t.end();
      });
  });
});

test('#_doImmediateSeqUpdate - fail if stop is called', function (t) {
  testCloseAllServer = testUtils.setUpServer(function (serverPort, randomDBName,
                                             remotePouchDB) {
    localSeqManager =
      new LocalSeqManager(100, remotePouchDB, devicePublicKey);
    localSeqManager.stop();
    localSeqManager._doImmediateSeqUpdate(23)
      .then(function () {
        t.fail('We should have gotten an error because we are stopped.');
      })
      .catch(function (err) {
        t.equal(err.message, 'Stop Called', 'confirm stop caused failure');
      })
      .then(function () {
        t.end();
      });
  });
});

test('#_doImmediateSeqUpdate - stop after get but before put fails right',
  function (t) {
    testCloseAllServer = testUtils.setUpServer(function (serverPort,
                                                         randomDBName,
                                                         remotePouchDB) {
      localSeqManager =
        new LocalSeqManager(100, remotePouchDB, devicePublicKey);
      localSeqManager._doImmediateSeqUpdate(234234234)
        .then(function () {
          t.fail('We should have failed on the put');
        })
        .catch(function (err) {
          t.equal(err.message, 'Stop Called', 'stop caused us to fail');
          t.ok(err.onPut, 'We specifically failed on a stop before put');
        })
        .then(function () {
          t.end();
        });
    }, function (app) {
      app.use(function (req, res, next) {
        localSeqManager.stop();
        next();
      });
    });
  });

test('#update - fail if stop is called', function (t) {
  testCloseAllServer = testUtils.setUpServer(function (serverPort, randomDBName,
                                             remotePouchDB) {
    localSeqManager =
      new LocalSeqManager(100, remotePouchDB, devicePublicKey);
    localSeqManager.stop();
    localSeqManager.update(100, true)
      .then(function () {
        t.fail('We should have failed due to stop');
      })
      .catch(function (err) {
        t.equal(err.message, 'Stop Called', 'failed due to stop');
        return localSeqManager.update(200, false);
      })
      .then(function () {
        t.fail('We should have failed due to stop');
      })
      .catch(function (err) {
        t.equal(err.message, 'Stop Called', 'failed due to stop');
      })
      .then(function () {
        t.end();
      });
  });
});

test('#update - set seq for first time', function (t) {
  testCloseAllServer = testUtils.setUpServer(function (serverPort, randomDBName,
                                             remotePouchDB) {
    localSeqManager =
      new LocalSeqManager(100, remotePouchDB, devicePublicKey);
    var lastSyncedSequenceNumber = 2000;
    localSeqManager.update(lastSyncedSequenceNumber)
      .then(function () {
        return httpTester.validateSeqNumber(t, randomDBName, serverPort,
                                  lastSyncedSequenceNumber, pskId, pskKey,
                                  devicePublicKey);
      })
      .catch(function (err) {
        t.fail('Got an error - ' + JSON.stringify(err));
      })
      .then(function () {
        t.end();
      });
  });
});

test('#update - Fail on bad seq value', function (t) {
  testCloseAllServer = testUtils.setUpServer(function (serverPort, randomDBName,
                                             remotePouchDB) {
    localSeqManager =
      new LocalSeqManager(1000, remotePouchDB, devicePublicKey);
    localSeqManager.update(10)
      .catch(function (err) {
        t.fail('Got unexpected error - ' + JSON.serialize(err));
      })
      .then(function () {
        return localSeqManager.update(9);
      })
      .then(function () {
        t.fail('Should have gotten an error');
      })
      .catch(function (err) {
        t.equal(err.message, 'Bad Seq', 'Expected bad seq error');
      })
      .then(function () {
        t.end();
      });
  });
});

test('#update - do we cancel timer properly on an immediate?', function (t) {
  testCloseAllServer = testUtils.setUpServer(function (serverPort, randomDBName,
                                             remotePouchDB) {
    localSeqManager =
      new LocalSeqManager(1000, remotePouchDB, devicePublicKey);
    var timerPromise = null;
    var immediatePromise = null;
    var lastSyncedSequenceNumber = 12;
    localSeqManager.update(11)
      .catch(function (err) {
        t.fail('Should not have gotten ' + JSON.serialize(err));
      })
      .then(function () {
        timerPromise = localSeqManager.update(lastSyncedSequenceNumber);
        ++lastSyncedSequenceNumber;
        immediatePromise = localSeqManager.update(lastSyncedSequenceNumber,
                                                  true);
        t.ok(timerPromise !== immediatePromise, 'Different promises');
        return timerPromise;
      })
      .then(function () {
        t.fail('timerPromise should have failed.');
      })
      .catch(function (err) {
        t.equal(err.message, 'Timer Cancelled', 'Timer was cancelled');
        return immediatePromise;
      })
      .then(function () {
        return httpTester.validateSeqNumber(t, randomDBName, serverPort,
          lastSyncedSequenceNumber, pskId, pskKey, devicePublicKey);
      })
      .catch(function (err) {
        t.fail('Got unexpected err - ' + JSON.serialize(err));
      })
      .then(function () {
        t.end();
      });
  });
});

test('#update - do we wait for blocked update', function (t) {
  testCloseAllServer = testUtils.setUpServer(function (serverPort, randomDBName,
                                             remotePouchDb) {
    localSeqManager =
      new LocalSeqManager(1000, remotePouchDb, devicePublicKey);
    var lastSyncedSequenceNumber = 790798;
    var promises = [];
    promises[0] = localSeqManager.update(lastSyncedSequenceNumber);
    ++lastSyncedSequenceNumber;
    promises[1] = localSeqManager.update(lastSyncedSequenceNumber);
    ++lastSyncedSequenceNumber;
    promises[2] = localSeqManager.update(lastSyncedSequenceNumber, true);
    ++lastSyncedSequenceNumber;
    promises[3] = localSeqManager.update(lastSyncedSequenceNumber, true);
    t.notEqual(promises[0], promises[1], 'One go and one blocked');
    t.equal(promises[1], promises[2], 'All blocked');
    t.equal(promises[2], promises[3], 'Still blocked');
    Promise.all(promises)
      .then(function () {
        return httpTester.validateSeqNumber(t, randomDBName, serverPort,
                                  lastSyncedSequenceNumber, pskId, pskKey,
                                  devicePublicKey);
      })
      .catch(function (err) {
        t.fail('Oops - ' + JSON.serialize(err));
      })
      .then(function () {
        t.end();
      });
  });
});

function testTimer(t, updateFn) {
  testCloseAllServer = testUtils.setUpServer(function (serverPort, randomDBName,
                                             remotePouchDB) {
    localSeqManager =
      new LocalSeqManager(1000, remotePouchDB, devicePublicKey);
    var lastSyncedSequenceNumber = 0;
    var firstUpdateTime = Date.now();
    var startTimeForSecondUpdate = null;
    localSeqManager.update(lastSyncedSequenceNumber)
      .then(function () {
        startTimeForSecondUpdate = Date.now();
        return updateFn(lastSyncedSequenceNumber);
      })
      .then(function (newSeqNumber) {
        lastSyncedSequenceNumber = newSeqNumber;
        var elapsedTime = Date.now() - startTimeForSecondUpdate;
        t.ok(elapsedTime >=
          1000 - (startTimeForSecondUpdate - firstUpdateTime),
          'We waited long enough');
        return httpTester.validateSeqNumber(t, randomDBName, serverPort,
          lastSyncedSequenceNumber, pskId, pskKey, devicePublicKey);
      })
      .catch(function (err) {
        t.fail('Got error - ' + JSON.stringify(err));
      })
      .then(function () {
        t.end();
      });
  });
}

test('#update - test that we wait long enough', function (t) {
  testTimer(t, function (lastSyncedSequenceNumber) {
    lastSyncedSequenceNumber += 11291;
    return localSeqManager.update(lastSyncedSequenceNumber)
      .then(function () {
        return lastSyncedSequenceNumber;
      });
  });
});

test('#update - test that we pick up new sequences while we wait',
  function (t) {
    testTimer(t, function (lastSyncedSequenceNumber) {
      lastSyncedSequenceNumber += 101;
      var promise1 = localSeqManager.update(lastSyncedSequenceNumber);
      lastSyncedSequenceNumber += 12;
      var promise2 = localSeqManager.update(lastSyncedSequenceNumber);
      lastSyncedSequenceNumber += 23;
      t.equal(promise1, promise2, 'Should have gotten same timer promise');
      var promise3 = localSeqManager.update(lastSyncedSequenceNumber);
      t.equal(promise2, promise3, 'Still same timer promise');
      return promise3
        .then(function () {
          return lastSyncedSequenceNumber;
        });
    });
  });
