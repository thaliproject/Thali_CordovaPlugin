'use strict';

var logCallback;
var os = require('os');
var tmp = require('tmp');
var PouchDB = require('PouchDB');
var path = require('path');
var randomstring = require('randomstring');
var Promise = require('lie');
var logger = require('thali/thalilogger')('testUtils');

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
    console.log('logCallback not set !!!!');
  }
};

var myName;

/**
 * Set the name given used by this device. The name is
 * retrievable via a function exposed to the Cordova side.
 * @param {string} name
 */
module.exports.setName = function (name) {
  myName = name;
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

  Mobile('getMyName').registerAsync(function (callback) {
    callback(myName);
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

if (typeof jxcore !== 'undefined' && jxcore.utils.OSInfo().isAndroid) {
  // Below is only for logging purposes.
  // Once we have had the BT off and we just turned it on,
  // we need to wait untill the BLE support is reported rigth way
  // seen with LG G4, Not seen with Motorola Nexus 6.
  setTimeout(function () {
    Mobile('IsBLESupported').callNative(function (err) {
      if (err) {
        console.log('BLE advertisement is not supported: ' + err );
        return;
      }
      console.log('BLE advertisement is supported');
    });
  }, 5000);
}


module.exports.getTestPouchDBInstance = function (name) {
  // Use a folder specific to this test so that the database content
  // will not interfere with any other databases that might be created
  // during other tests.
  var dbPath = path.join(module.exports.tmpDirectory(),
    'pouchdb-test-directory');
  var LevelDownPouchDB =
    PouchDB.defaults({db: require('leveldown-mobile'), prefix: dbPath});
  return new LevelDownPouchDB(name);
};

module.exports.getRandomlyNamedTestPouchDBInstance = function () {
  var randomPouchDBName = randomstring.generate({
    length: 40,
    charset: 'alphabetic'
  });
  return module.exports.getTestPouchDBInstance(randomPouchDBName);
};
