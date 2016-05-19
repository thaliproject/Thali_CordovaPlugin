'use strict';

var tape = require('../lib/thaliTape');
var LocalSeqManager = require('thali/NextGeneration/replication/localSeqManager');
var net = require('net');
var thaliMobile = require('thali/NextGeneration/thaliMobile');
var PouchDB = require('pouchdb');
var ThaliReplicationManager = require('thali/NextGeneration/thaliReplicationManager');
var expressPouchdb = require('express-pouchdb');
var crypto = require('crypto');
var thaliConfig = require('thali/NextGeneration/thaliConfig');
var ThaliPeerPoolDefault = require('thali/NextGeneration/thaliPeerPool/thaliPeerPoolDefault');
var ForeverAgent = require('forever-agent');
var ThaliNotificationClient = require('thali/NextGeneration/notification/thaliNotificationClient');
var Promise = require('lie');
var logger = require('thali/thalilogger')('testLocalSeqManager');
var testUtils = require('../lib/testUtils');
var makeIntoCloseAllServer = require('thali/NextGeneration/makeIntoCloseAllServer');
var https = require('https');
var randomString = require('randomstring');
var urlsafeBase64 = require('urlsafe-base64');
var thaliNotificationBeacons = require('thali/NextGeneration/notification/thaliNotificationBeacons');
var httpTester = require('../lib/httpTester');

var express = require('express');

var thaliReplicationManager = null;
var devicePublicPrivateKey = crypto.createECDH(thaliConfig.BEACON_CURVE);
var devicePublicKey = devicePublicPrivateKey.generateKeys();
var TestPouchDB = testUtils.getLevelDownPouchDb();
var testCloseAllServer = null;
var localSeqManager = null;
var pskId = 'yo ho ho';
var pskKey = new Buffer('Nothing going on here');


var test = tape({
  setup: function (t) {
    t.data = devicePublicKey.toJSON();
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


/*
  These are all run against local servers:

  update
    Set seq even if wait isn't over if immediate is set
    Set seq via timer then update before timer is run and make sure we set last seq
    Fail if we give a smaller seq number than last time

  Run with coordinator:
    For each peer set the initial seq doc and then update it twice.
 */

function createPskPouchDBRemote(serverPort, dbName) {
  return new TestPouchDB('https://127.0.0.1:' + serverPort + '/db/' + dbName,
    {
      ajax: {
        agentOptions: {
          rejectUnauthorized: false,
          pskIdentity: pskId,
          pskKey: pskKey,
          ciphers: thaliConfig.SUPPORTED_PSK_CIPHERS
        }
      }
    });
}

function runBadImmediateSeqUpdateTest(t, serverPort, validateErrFunc) {
  var pouchDB = createPskPouchDBRemote(serverPort, 'foo');
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
  var self = this;
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
    var self = this;
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
    }
  };
  testCloseAllServer = makeIntoCloseAllServer(
    https.createServer(options, function(req, res) {
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

function setUpServer(testBody, appConfig) {
  var app = express();
  appConfig && appConfig(app);
  app.use('/db', expressPouchdb(TestPouchDB, {mode: 'minimumForPouchDB'}));
  testCloseAllServer = makeIntoCloseAllServer(https.createServer(
    {
      ciphers: thaliConfig.SUPPORTED_PSK_CIPHERS,
      pskCallback : function (id) {
        return id === pskId ? pskKey : null;
      }
    }, app));
  testCloseAllServer.listen(0, function () {
    var serverPort = testCloseAllServer.address().port;
    var randomDBName = randomString.generate(30);
    var remotePouchDB = createPskPouchDBRemote(serverPort, randomDBName);
    testBody(serverPort, randomDBName, remotePouchDB);
  });
}

function getSeqDoc(randomDBName, serverPort) {
  var path = '/db/' + randomDBName + '/_local/thali_' +
    urlsafeBase64
      .encode(thaliNotificationBeacons
        .createPublicKeyHash(devicePublicKey));
  return httpTester.pskGet(serverPort, path, pskId, pskKey)
    .then(function (responseBody) {
      return JSON.parse(responseBody);
    });
}

function validateSeqNumber(t, randomDBName, serverPort, seq) {
  return getSeqDoc(randomDBName, serverPort)
    .then(function (pouchResponse) {
      t.equal(pouchResponse.lastSyncedSequenceNumber, seq);
      return pouchResponse;
    });
}

function validateRev(t, rev, lastSyncedSequenceNumber, randomDBName, serverPort)
{
  return validateSeqNumber(t, randomDBName, serverPort,
    lastSyncedSequenceNumber)
    .then(function (pouchResponse) {
      t.equal(pouchResponse._rev, rev, 'revs are equal');
    });
}

test('#_doImmediateSeqUpdate - create new seq doc', function (t) {
  setUpServer(function (serverPort, randomDBName, remotePouchDB) {
    localSeqManager = new LocalSeqManager(100, remotePouchDB, devicePublicKey);
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
  });
});

test('#_doImmediateSeqUpdate - doc exists, need to get rev and update',
  function(t) {
    setUpServer(function (serverPort, randomDBName, remotePouchDB) {
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
  setUpServer(function (serverPort, randomDBName, remotePouchDB) {
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
  setUpServer(function (serverPort, randomDBName, remotePouchDB) {
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
  setUpServer(function (serverPort, randomDBName, remotePouchDB) {
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
    setUpServer(function (serverPort, randomDBName, remotePouchDB) {
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
  setUpServer(function (serverPort, randomDBName, remotePouchDB) {
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
  setUpServer(function (serverPort, randomDBName, remotePouchDB) {
    localSeqManager =
      new LocalSeqManager(100, remotePouchDB, devicePublicKey);
    var lastSyncedSequenceNumber = 2000;
    localSeqManager.update(lastSyncedSequenceNumber)
      .then(function () {
        return validateSeqNumber(t, randomDBName, serverPort,
                                  lastSyncedSequenceNumber);
      })
      .catch(function (err) {
        t.fail('Got an error - ' + JSON.stringify(err));
      })
      .then(function () {
        t.end();
      });
  });
});

function testTimer(t, updateFn) {
  setUpServer(function (serverPort, randomDBName, remotePouchDB) {
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
        t.ok(Date.now() - startTimeForSecondUpdate >=
          1000 - (startTimeForSecondUpdate - firstUpdateTime),
          'We waited long enough');
        return validateSeqNumber(t, randomDBName, serverPort,
          lastSyncedSequenceNumber);
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
      localSeqManager.update(lastSyncedSequenceNumber);
      lastSyncedSequenceNumber += 12;
      localSeqManager.update(lastSyncedSequenceNumber);
      lastSyncedSequenceNumber += 23;
      return localSeqManager.update(lastSyncedSequenceNumber)
        .then(function () {
          return lastSyncedSequenceNumber;
        });
    });
  });

//test('delme', function (t) {
//
//
//
//  var ConfigedPouchDbFactory = testUtils.getLevelDownPouchDb();
//
//  var testPouch = new ConfigedPouchDbFactory('icky');
//
//  testPouch.get('_local/foo')
//    .then(function (response) {
//      console.log('response - ' + response);
//    }).catch(function (err) {
//      console.log('err - ' + err);
//    });
//
//  console.log(testUtils.tmpDirectory());
//
//  var app = express();
//  app.use('/db', expressPouchdb(ConfigedPouchDbFactory));
//  app.listen(2020);
//});
//
//
//if (!tape.coordinated) {
//  return;
//}
//
///*
//We get all the participants and we wait for a notification from each one and
//once we get the notification then we run the test
// */
//
//var MAX_FAILURE = 10;
//
//function runTestOnAllParticipants(t, testToRun) {
//  return new Promise(function (resolve, reject) {
//    var completed = false;
//    var thaliNotificationClient =
//      thaliReplicationManager.
//        _thaliPullReplicationFromNotification.
//        _thaliNotificationClient;
//
//    /*
//    Each participant is recorded via their public key
//    If the value is -1 then they are done
//    If the value is 0 then no test has completed
//    If the value is greater than 0 then that is how many failures there have
//    been.
//     */
//    var participantCount = {};
//
//    t.participants.forEach(function (participant) {
//      var publicKey = new Buffer(JSON.parse(participant.data));
//      participantCount[publicKey] = 0;
//    });
//
//    function success(publicKey) {
//      return function () {
//        if (completed) {
//          return;
//        }
//
//        participantCount[publicKey] = -1;
//
//        var allSuccess = true;
//        var participantKeys =
//          Object.getOwnPropertyNames(participantCount);
//        for(var i = 0; i < participantKeys.length; ++i) {
//          if (participantCount[participantKeys[i]] === -1) {
//            allSuccess = false;
//            return;
//          }
//        }
//        if (allSuccess) {
//          completed = true;
//          resolve();
//        }
//      };
//    }
//
//    function fail(publicKey) {
//      return function(err) {
//        logger.debug('Got an err - ' + JSON.stringify(err));
//        if (completed || participantCount[publicKey] === -1) {
//          return;
//        }
//        ++participantCount[publicKey];
//        if (participantCount[publicKey] >= MAX_FAILURE) {
//          completed = true;
//          reject(err);
//        }
//      };
//    }
//
//    thaliNotificationClient.on(
//      ThaliNotificationClient.Events.PeerAdvertisesDataForUs,
//      function (notificationForUs) {
//        testToRun(notificationForUs, success, fail(notificationForUs.keyId));
//      });
//  });
//
//
//
//}
//
//test('Simple doc request', function (t) {
//  /*
//  We start the replication manager with our own public key
//  Then we try to connect to it
//   */
//  var testPromise = runTestOnAllParticipants(t, function (notificationForUs) {
//    var actionAgent = new ForeverAgent.SSL({
//      keepAlive: true,
//      keepAliveMsecs: thaliConfig.TCP_TIMEOUT_WIFI/2,
//      maxSockets: Infinity,
//      maxFreeSockets: 256,
//      ciphers: thaliConfig.SUPPORTED_PSK_CIPHERS,
//      pskIdentity: notificationForUs.pskIdentifyField,
//      pskKey: notificationForUs.psk
//    });
//
//    var localSeqManager = new LocalSeqManager(100000,
//      notificationForUs.hostAddress,
//      notificationForUs.portNumber,
//      'test',
//      devicePublicKey,
//      actionAgent);
//
//    localSeqManager._getRemoteLastSeqDoc()
//      .then(function () {
//        t.ok(localSeqManager._seqDocRev, 'seqDocRev should be set');
//      })
//      .catch(function (err) {
//        t.fail(err);
//      });
//  });
//
//  var publicKeys = [];
//  t.participants.forEach(function (participant) {
//    publicKeys.push(new Buffer(JSON.parse(participant.data)));
//  });
//
//  thaliReplicationManager.start(publicKeys)
//    .then(function () {
//      return testPromise;
//    })
//    .catch(function (err) {
//      t.fail('Got err ' + JSON.stringify(err));
//    })
//    .then(function () {
//      t.end();
//    });
//});

// test('Request to a server that is not there', function (t) {
//   var blockPortServer = net.createServer(0, function () {
//     var serverPort = blockPortServer.address().port;
//     var blockingConnection = net.createConnection(serverPort, function () {
//       blockPortServer.close();
//       // Now we are blocking the port the server was listening on because we
//       // still have a connection open but not new requests will be honored.
//     });
//
//   })
//   var localSeqManager = new LocalSeqManager(10000, '127.0.0.1', )
// });
