'use strict';

var logCallback;
var os = require('os');
var tmp = require('tmp');
var PouchDB = require('pouchdb-node');
var path = require('path');
var randomString = require('randomstring');
var Promise = require('lie');
var https = require('https');
var logger = require('thali/thaliLogger')('testUtils');
var ForeverAgent = require('forever-agent');
var thaliConfig = require('thali/NextGeneration/thaliConfig');
var expressPouchdb = require('express-pouchdb');
var makeIntoCloseAllServer = require('thali/NextGeneration/makeIntoCloseAllServer');
var notificationBeacons =
  require('thali/NextGeneration/notification/thaliNotificationBeacons');
var express = require('express');
var fs = require('fs-extra-promise');
var extend = require('js-extend').extend;
var inherits = require('inherits');

var pskId = 'yo ho ho';
var pskKey = new Buffer('Nothing going on here');

var doToggle = function (toggleFunction, on) {
  if (typeof Mobile === 'undefined') {
    return Promise.resolve();
  }
  if (jxcore.utils.OSInfo().isIOS) {
    return Promise.resolve();
  }
  return new Promise(function (resolve, reject) {
    Mobile[toggleFunction](on, function (err) {
      if (err) {
        logger.warn('Mobile.%s returned an error: %s', toggleFunction, err);
        return reject(new Error(err));
      }
      return resolve();
    });
  });
};

module.exports.toggleWifi = function (on) {
  return doToggle('toggleWiFi', on);
};

exports.toggleBluetooth = function (on) {
  return doToggle('toggleBluetooth', on);
};

/**
 * Turn Bluetooth and Wifi either on or off.
 * This doesn't have any effect on iOS and on mocked up desktop
 * environment, the network changes will be simulated (i.e., doesn't affect
 * the network status of the host machine).
 * @param {boolean} on Pass true to turn radios on and false to turn them off
 * @returns {Promise<?Error>}
 */
module.exports.toggleRadios = function (on) {
  logger.info('Toggling radios to: %s', on);
  return module.exports.toggleBluetooth(on)
  .then(function () {
    return module.exports.toggleWifi(on);
  });
};

function isFunction(functionToCheck) {
  var getType = {};
  return functionToCheck && getType.toString.call(functionToCheck) ===
    '[object Function]';
}

/**
 * Log a message to the screen - only applies when running on Mobile. It assumes
 * we are using our test framework with our Cordova WebView who is setup to
 * receive logging messages and display them.
 * @param {string} message
 */
module.exports.logMessageToScreen = function (message) {
  if (isFunction(logCallback)) {
    logCallback(message);
  } else {
    logger.warn('logCallback not set!');
  }
};

var myName = '';
var myNameCallback = null;

/**
 * Set the name given used by this device. The name is
 * retrievable via a function exposed to the Cordova side.
 * @param {string} name
 */
module.exports.setName = function (name) {
  myName = name;
  if (isFunction(myNameCallback)) {
    myNameCallback(name);
  } else {
    logger.warn('myNameCallback not set!');
  }
};

/**
 * Get the name of this device.
 */
module.exports.getName = function () {
  return myName;
};

if (typeof jxcore !== 'undefined' && jxcore.utils.OSInfo().isMobile) {
  Mobile('setLogCallback').registerAsync(function (callback) {
    logCallback = callback;
  });

  Mobile('setMyNameCallback').registerAsync(function (callback) {
    myNameCallback = callback;
    // If the name is already set, pass it to the callback
    // right away.
    if (myName) {
      myNameCallback(myName);
    }
  });
} else {
  logCallback = function (message) {
    console.log(message);
  };
}

/**
 * Returns the file path to the temporary directory that can be used by tests
 * to store temporary data.
 * On desktop, returns a directory that does not persist between app restarts
 * and is removed when the process exits.
 * @returns {string}
 */
var tmpObject = null;
module.exports.tmpDirectory = function () {
  if (typeof jxcore !== 'undefined' && jxcore.utils.OSInfo().isMobile) {
    return os.tmpdir();
  }

  tmp.setGracefulCleanup();
  if (tmpObject === null) {
    tmpObject = tmp.dirSync({
      unsafeCleanup: true
    });
  }
  return tmpObject.name;
};

/**
 * Returns a promise that resolved with true or false depending on if this
 * device has the hardware capabilities required.
 * On Android, checks the BLE multiple advertisement feature and elsewhere
 * always resolves with true.
 */
module.exports.hasRequiredHardware = function () {
  return new Promise(function (resolve) {
    if (jxcore.utils.OSInfo().isAndroid) {
      var checkBleMultipleAdvertisementSupport = function () {
        Mobile('isBleMultipleAdvertisementSupported').callNative(
          function (error, result) {
            if (error) {
              logger.warn('BLE multiple advertisement error: ' + error);
              resolve(false);
              return;
            }
            switch (result) {
              case 'Not resolved': {
                logger.info(
                  'BLE multiple advertisement support not yet resolved'
                );
                setTimeout(checkBleMultipleAdvertisementSupport, 5000);
                break;
              }
              case 'Supported': {
                logger.info('BLE multiple advertisement supported');
                resolve(true);
                break;
              }
              case 'Not supported': {
                logger.info('BLE multiple advertisement not supported');
                resolve(false);
                break;
              }
              default: {
                logger.warn('BLE multiple advertisement issue: ' + result);
                resolve(false);
              }
            }
          }
        );
      };
      checkBleMultipleAdvertisementSupport();
    } else {
      resolve(true);
    }
  });
};

module.exports.returnsValidNetworkStatus = function () {
  // The require is here instead of top of file so that
  // we can require the test utils also from an environment
  // where Mobile isn't defined (which is a requirement when
  // thaliMobile is required).
  var ThaliMobile = require('thali/NextGeneration/thaliMobile');
  // Check that network status is as expected and
  // report to CI that this device is ready.
  return ThaliMobile.getNetworkStatus()
  .then(function (networkStatus) {
    module.exports.logMessageToScreen(
      'Device did not have required hardware capabilities!'
    );
    if (networkStatus.bluetoothLowEnergy === 'on') {
      // If we are on a device that doesn't have required capabilities
      // the network status for BLE must not be reported to be "on"
      // which would mean "The radio is on and available for use."
      return Promise.resolve(false);
    } else {
      return Promise.resolve(true);
    }
  });
};

module.exports.getOSVersion = function () {
  return new Promise(function (resolve) {
    if (!jxcore.utils.OSInfo().isMobile) {
      return resolve('dummy');
    }
    Mobile('getOSVersion').callNative(function (version) {
      resolve(version);
    });
  });
};


module.exports.verifyCombinedResultSuccess =
  function (t, combinedResult, message) {
    t.equal(combinedResult.wifiResult, null,
      message || 'error should be null');
    t.equal(combinedResult.nativeResult, null,
      message || 'error should be null');
  };

function levelDownPouchDBGenerator(defaultDirectory) {
  // Shamelessly stolen from https://github.com/pouchdb/pouchdb/blob/fb77927d2f14911478032884f1576b770815bcab/packages/pouchdb-core/src/setup.js#L108-L137
  function PouchAlt(name, opts, callback) {
    if (!(this instanceof PouchAlt)) {
      return new PouchAlt(name, opts, callback);
    }

    if (typeof opts === 'function' || typeof opts === 'undefined') {
      callback = opts;
      opts = {};
    }

    if (name && typeof name === 'object') {
      opts = name;
      name = undefined;
    }

    opts = extend({}, opts);

    if (name !== undefined && name.indexOf('http') !== 0) {
      if (!opts.db) {
        opts.db = require('leveldown-mobile');
      }

      if (!opts.prefix) {
        opts.prefix = defaultDirectory;
      }
    }

    PouchDB.call(this, name, opts, callback);
  }

  inherits(PouchAlt, PouchDB);

  PouchAlt.preferredAdapters = PouchDB.preferredAdapters.slice();
  Object.keys(PouchDB).forEach(function (key) {
    if (!(key in PouchAlt)) {
      PouchAlt[key] = PouchDB[key];
    }
  });

  return PouchAlt;
}

// Use a folder specific to this test so that the database content
// will not interfere with any other databases that might be created
// during other tests.
var dbPath = path.join(module.exports.tmpDirectory(), 'pouchdb-test-directory');
fs.ensureDirSync(dbPath);

var LevelDownPouchDB = levelDownPouchDBGenerator(dbPath);

module.exports.getLevelDownPouchDb = function () {
  return LevelDownPouchDB;
};

module.exports.getRandomPouchDBName= function () {
  return randomString.generate({
    length: 40,
    charset: 'alphabetic'
  });
};

module.exports.getRandomlyNamedTestPouchDBInstance = function () {
  return new LevelDownPouchDB(module.exports.getRandomPouchDBName());
};

module.exports.getPouchDBFactoryInRandomDirectory = function () {
  var directory = path.join(dbPath, randomString.generate({
    length: 20,
    charset: 'alphabetic'
  }));
  fs.ensureDirSync(directory);
  return levelDownPouchDBGenerator(directory);
};

var preAmbleSizeInBytes = notificationBeacons.PUBLIC_KEY_SIZE +
  notificationBeacons.EXPIRATION_SIZE;

module.exports.extractPreAmble = function (beaconStreamWithPreAmble) {
  return beaconStreamWithPreAmble.slice(0, preAmbleSizeInBytes);
};

module.exports.extractBeacon = function (beaconStreamWithPreAmble,
                                         beaconIndexToExtract) {
  var beaconStreamNoPreAmble =
    beaconStreamWithPreAmble.slice(preAmbleSizeInBytes);
  var beaconCount = 0;
  for (var i = 0; i < beaconStreamNoPreAmble.length;
       i += notificationBeacons.BEACON_SIZE) {
    if (beaconCount === beaconIndexToExtract) {
      return beaconStreamNoPreAmble
        .slice(i, i + notificationBeacons.BEACON_SIZE);
    }
    ++beaconCount;
  }
  return null;
};

module.exports._get = function (host, port, path, options) {
  var complete = false;
  return new Promise(function (resolve, reject) {
    var request = https.request(options, function (response) {
      var responseBody = '';
      response.on('data', function (data) {
        responseBody += data;
      });
      response.on('end', function () {
        complete = true;
        resolve(responseBody);
      });
      response.on('error', function (error) {
        if (!complete) {
          logger.error('%j', error);
          reject(error);
        }
      });
      response.resume();
    });
    request.on('error', function (error) {
      if (!complete) {
        logger.error('%j', error);
        reject(error);
      }
    });
    // Wait for 15 seconds since the request can take a while
    // in mobile environment over a non-TCP transport.
    request.setTimeout(15 * 1000);
    request.end();
  });
};

module.exports.get = function (host, port, path, pskIdentity, pskKey) {
  var options = {
    hostname: host,
    port: port,
    path: path,
    agent: new ForeverAgent.SSL({
      ciphers: thaliConfig.SUPPORTED_PSK_CIPHERS,
      pskIdentity: pskIdentity,
      pskKey: pskKey
    })
  };
  return module.exports._get(host, port, path, options);
};

module.exports.getWithAgent = function (host, port, path, agent) {
  var options = {
    hostname: host,
    port: port,
    path: path,
    agent: agent
  };
  return module.exports._get(host, port, path, options);
};

/**
 * @typedef {Object} peerAndBody
 * @property {string} httpResponseBody
 * @property {string} peerId
 */

/**
 * This function will grab the first peer it can via nonTCPAvailableHandler and
 * will try to issue the GET request. If it fails then it will continue to
 * listen to nonTCPAvailableHandler until it sees a port for the same PeerID
 * and will try the GET again. It will repeat this process if there are
 * failures until the timer runs out.
 *
 * @param {string} path
 * @param {string} pskIdentity
 * @param {Buffer} pskKey
 * @param {?string} [selectedPeerId] This is only used for a single test that
 * needs to reconnect to a known peer, otherwise it is null.
 * @returns {Promise<Error | peerAndBody>}
 */
module.exports.getSamePeerWithRetry = function (path, pskIdentity, pskKey,
                                                selectedPeerId) {
  // We don't load thaliMobileNativeWrapper until after the tests have started
  // running so we pick up the right version of mobile
  var thaliMobileNativeWrapper = require('thali/NextGeneration/thaliMobileNativeWrapper');
  return new Promise(function (resolve, reject) {
    var retryCount = 0;
    var MAX_TIME_TO_WAIT_IN_MILLISECONDS = 1000 * 30 * 2;
    var exitCalled = false;
    var peerID = selectedPeerId;
    var getRequestPromise = null;

    function exitCall(success, failure) {
      if (exitCalled) {
        return;
      }
      exitCalled = true;
      clearTimeout(timeoutId);
      thaliMobileNativeWrapper.emitter
        .removeListener('nonTCPPeerAvailabilityChangedEvent',
          nonTCPAvailableHandler);
      return failure ? reject(failure) : resolve(
        {
          httpResponseBody: success,
          peerId: peerID
        });
    }

    var timeoutId = setTimeout(function () {
      exitCall(null, new Error('Timer expired'));
    }, MAX_TIME_TO_WAIT_IN_MILLISECONDS);

    function tryAgain(portNumber, err) {
      ++retryCount;
      logger.warn('Retry count for getSamePeerWithRetry is ' + retryCount);
      getRequestPromise =
        module.exports.get('127.0.0.1', portNumber, path, pskIdentity, pskKey);
      getRequestPromise
        .then(function (result) {
          exitCall(result);
        })
        .catch(function (err) {
          logger.debug('getSamePeerWithRetry got an error it will retry - ' +
            err);
        });
    }

    function nonTCPAvailableHandler(record) {
      // Ignore peer unavailable events
      if (record.portNumber === null) {
        if (peerID && record.peerIdentifier === peerID) {
          logger.warn('We got a peer unavailable notification for a ' +
            'peer we are looking for.');
        }
        return;
      }

      if (peerID && record.peerIdentifier !== peerID) {
        return;
      }

      logger.debug('We got a peer ' + JSON.stringify(record));

      if (!peerID) {
        peerID = record.peerIdentifier;
        return tryAgain(record.portNumber);
      }


      // We have a predefined peerID
      if (!getRequestPromise) {
        return tryAgain(record.portNumber);
      }

      getRequestPromise
        .then(function () {
          // In theory this could maybe happen if a connection somehow got
          // cut before we were notified of a successful result thus causing
          // the system to automatically issue a new port, but that is
          // unlikely
        })
        .catch(function (err) {
          return tryAgain(record.portNumber, err);
        });
    }

    thaliMobileNativeWrapper.emitter.on('nonTCPPeerAvailabilityChangedEvent',
      nonTCPAvailableHandler);
  });
};

module.exports.createPskPouchDBRemote = function (serverPort, dbName,
                                                 pskId, pskKey, host) {
  var serverUrl = 'https://' + (host ? host : '127.0.0.1') + ':' + serverPort +
    thaliConfig.BASE_DB_PATH + '/' + dbName;

  /**
   * See the notes in thaliReplicationPeerAction.start for why the below
   * is here and why it's wrong and should use agent instead but can't.
   */
  return new LevelDownPouchDB(serverUrl,
    {
      ajax: {
        agentClass: ForeverAgent.SSL,
        agentOptions: {
          keepAlive: true,
          keepAliveMsecs: thaliConfig.TCP_TIMEOUT_WIFI/2,
          maxSockets: Infinity,
          maxFreeSockets: 256,
          ciphers: thaliConfig.SUPPORTED_PSK_CIPHERS,
          pskIdentity: pskId,
          pskKey: pskKey,
          secureOptions: pskId + serverUrl
        }
      }
    });
};

module.exports.validateCombinedResult = function (combinedResult) {
  if (combinedResult.wifiResult !== null ||
    combinedResult.nativeResult !== null) {
    return Promise.reject(new Error('Had a failure in ThaliMobile.start - ' +
      JSON.stringify(combinedResult)));
  }
  return Promise.resolve();
};

module.exports.setUpServer = function (testBody, appConfig) {
  var app = express();
  appConfig && appConfig(app);
  app.use(thaliConfig.BASE_DB_PATH, expressPouchdb(LevelDownPouchDB, {mode: 'minimumForPouchDB'}));
  var testCloseAllServer = makeIntoCloseAllServer(https.createServer(
    {
      ciphers: thaliConfig.SUPPORTED_PSK_CIPHERS,
      pskCallback : function (id) {
        return id === pskId ? pskKey : null;
      },
      key: thaliConfig.BOGUS_KEY_PEM,
      cert: thaliConfig.BOGUS_CERT_PEM
    }, app));
  testCloseAllServer.listen(0, function () {
    var serverPort = testCloseAllServer.address().port;
    var randomDBName = randomString.generate(30);
    var remotePouchDB =
      module.exports.createPskPouchDBRemote(serverPort, randomDBName, pskId,
                                            pskKey);
    testBody(serverPort, randomDBName, remotePouchDB);
  });
  return testCloseAllServer;
};

var MAX_FAILURE = 10;

module.exports.turnParticipantsIntoBufferArray = function (t, devicePublicKey) {
  var publicKeys = [];
  t.participants.forEach(function (participant) {
    var publicKey = new Buffer(participant.data);
    if (Buffer.compare(publicKey, devicePublicKey) !== 0) {
      publicKeys.push(publicKey);
    }
  });
  return publicKeys;
};

module.exports.startServerInfrastructure =
  function (thaliNotificationServer, publicKeys, ThaliMobile, router) {
    return thaliNotificationServer.start(publicKeys)
      .then(function () {
        return ThaliMobile.start(router,
          thaliNotificationServer.getPskIdToSecret());
      })
      .then(function (combinedResult) {
        return module.exports.validateCombinedResult(combinedResult);
      })
      .then(function () {
        return ThaliMobile.startListeningForAdvertisements();
      })
      .then(function (combinedResult) {
        return module.exports.validateCombinedResult(combinedResult);
      })
      .then(function () {
        return ThaliMobile.startUpdateAdvertisingAndListening();
      })
      .then(function (combinedResult) {
        return module.exports.validateCombinedResult(combinedResult);
      });
  };

module.exports.runTestOnAllParticipants = function (t, router,
                                                    thaliNotificationClient,
                                                    thaliNotificationServer,
                                                    ThaliMobile,
                                                    devicePublicKey,
                                                    testToRun) {
  var publicKeys =
    module.exports.turnParticipantsIntoBufferArray(t, devicePublicKey);

  return new Promise(function (resolve, reject) {
    var completed = false;
    /*
     Each participant is recorded via their public key
     If the value is -1 then they are done
     If the value is 0 then no test has completed
     If the value is greater than 0 then that is how many failures there have
     been.
     */
    var participantCount = {};

    publicKeys.forEach(function (participantPublicKey) {
      participantCount[participantPublicKey] = 0;
    });

    var participantTask = {};

    publicKeys.forEach(function (participantPublicKey) {
      participantTask[participantPublicKey] = Promise.resolve();
    });

    function success(publicKey) {
      if (completed) {
        return;
      }

      participantCount[publicKey] = -1;

      var participantKeys =
        Object.getOwnPropertyNames(participantCount);
      for (var i = 0; i < participantKeys.length; ++i) {
        if (participantCount[participantKeys[i]] !== -1) {
          return;
        }
      }

      completed = true;
      clearTimeout(timerCancel);
      resolve();
    }

    function fail(publicKey, err) {
      logger.debug('Got an err - ' + err);
      if (completed || participantCount[publicKey] === -1) {
        return;
      }
      ++participantCount[publicKey];
      if (participantCount[publicKey] >= MAX_FAILURE) {
        completed = true;
        clearTimeout(timerCancel);
        reject(err);
      }
    }

    var timerCancel = setTimeout(function () {
      reject(new Error('Test timed out'));
    }, 5 * 60 * 1000);

    thaliNotificationClient.on(
      thaliNotificationClient.Events.PeerAdvertisesDataForUs,
      function (notificationForUs) {
        if (completed) {
          return;
        }
        participantTask[notificationForUs.keyId]
          .then(function () {
            if (!completed) {
              participantTask[notificationForUs.keyId] =
                testToRun(notificationForUs)
                  .then(function () {
                    success(notificationForUs.keyId);
                  })
                  .catch(function (err) {
                    fail(notificationForUs.keyId, err);
                    return Promise.resolve();
                  });
              return participantTask[notificationForUs.keyId];
            }
          });
      });

    thaliNotificationClient.start(publicKeys);
    return module.exports.startServerInfrastructure(thaliNotificationServer,
                                                    publicKeys,
                                                    ThaliMobile, router)
      .catch(function (err) {
        reject(err);
      });
  });
};

// We doesn't want our test to run infinite time.
// We will replace t.end with custom exit function.
module.exports.testTimeout = function (t, timeout, callback) {
  var timer = setTimeout(function () {
    t.fail('test timeout');
    t.end();
  }, timeout);

  var oldEnd = t.end;
  t.end = function () {
    // Restoring original t.end.
    t.end = oldEnd;

    if (typeof callback === 'function') {
      callback();
    }

    clearTimeout(timer);
    return oldEnd.apply(this, arguments);
  }
}
