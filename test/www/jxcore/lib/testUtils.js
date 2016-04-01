'use strict';

var logCallback;
var os = require('os');
var tmp = require('tmp');
var PouchDB = require('pouchdb');
var path = require('path');
var randomString = require('randomstring');
var Promise = require('lie');
var http = require('http');
var https = require('https');
var logger = require('thali/thalilogger')('testUtils');
var ForeverAgent = require('forever-agent');
var thaliConfig = require('thali/NextGeneration/thaliConfig');

var notificationBeacons =
  require('thali/NextGeneration/notification/thaliNotificationBeacons');

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
 */
var tmpObject = null;
module.exports.tmpDirectory = function () {
  if (typeof jxcore !== 'undefined' && jxcore.utils.OSInfo().isMobile) {
    return os.tmpdir();
  }
  if (tmpObject === null) {
    tmp.setGracefulCleanup();
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

// Use a folder specific to this test so that the database content
// will not interfere with any other databases that might be created
// during other tests.
var dbPath = path.join(module.exports.tmpDirectory(), 'pouchdb-test-directory');
var LevelDownPouchDB = PouchDB.defaults({
  db: require('leveldown-mobile'),
  prefix: dbPath
});

module.exports.getTestPouchDBInstance = function (name) {
  return new LevelDownPouchDB(name);
};

module.exports.getRandomlyNamedTestPouchDBInstance = function () {
  var randomPouchDBName = randomString.generate({
    length: 40,
    charset: 'alphabetic'
  });
  return module.exports.getTestPouchDBInstance(randomPouchDBName);
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


module.exports._universalGet = function (options, requestFn) {
  var complete = false;
  return new Promise(function (resolve, reject) {
    var request = requestFn(options, function (response) {
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
    request.setTimeout(15 * 1000 * 1000);
    request.end();
  });
};

module.exports._httpsGet = function (options) {
  return module.exports._universalGet(options, https.request);
};

module.exports._httpGet = function (options) {
  return module.exports._universalGet(options, http.request);
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
  return module.exports._httpsGet(options);
};

module.exports.getWithAgent = function (host, port, path, agent) {
  var options = {
    hostname: host,
    port: port,
    path: path,
    agent: agent
  };
  return module.exports._httpsGet(options);
};

module.exports.httpGet = function (host, port, path) {
  var options = {
    hostname: host,
    port: port,
    path: path
  };
  return module.exports._httpGet(options);
};
