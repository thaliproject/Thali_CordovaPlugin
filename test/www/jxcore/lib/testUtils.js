var LogCallback;
var os = require('os');
var tmp = require('tmp');
var PouchDB = require('pouchdb');
var path = require('path');
var randomString = require('randomstring');
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
  return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
}

/**
 * Log a message to the screen - only applies when running on Mobile. It assumes we are using our test framework
 * with our Cordova WebView who is setup to receive logging messages and display them.
 * @param {string} message
 */
exports.logMessageToScreen = function(message) {
  if (isFunction(LogCallback)) {
    LogCallback(message);
  } else {
    console.log("LogCallback not set !!!!");
  }
};

var myName;

/**
 * Set the name given used by this device. The name is
 * retrievable via a function exposed to the Cordova side.
 * @param name
 */
exports.setName = function (name) {
  myName = name;
};

/**
 * Get the name of this device.
 */
exports.getName = function () {
  return myName;
};

if (typeof jxcore !== 'undefined' && jxcore.utils.OSInfo().isMobile) {
  Mobile('setLogCallback').registerAsync(function (callback) {
    LogCallback = callback;
  });

  Mobile('getMyName').registerAsync(function (callback) {
    callback(myName);
  });
} else {
  LogCallback = function(message) {
    console.log(message);
  }
}

/**
 * Returns the file path to the temporary directory that can be used by tests
 * to store temporary data.
 * On desktop, returns a directory that does not persist between app restarts
 * and is removed when the process exits.
 */
var tmpObject = null;
exports.tmpDirectory = function () {
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
 * Logs the result of BLE multiple advertisement feature support check on
 * Android.
 */
if (typeof jxcore !== 'undefined' && jxcore.utils.OSInfo().isAndroid) {
  Mobile('isBleMultipleAdvertisementSupported').callNative(function (err) {
    if (err) {
      console.log('BLE multiple advertisement not supported: ' + err);
    } else {
      console.log('BLE multiple advertisement supported');
    }
  });
}


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
