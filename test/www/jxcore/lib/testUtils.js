'use strict';

var logCallback;
var os = require('os');
var tmp = require('tmp');
var PouchDB = require('PouchDB');
var path = require('path');
var randomstring = require('randomstring');

/**
 * Turn Bluetooth and WiFi either on or off.
 * This is a NOOP on iOS and the desktop.
 * @param {boolean} on - true to turn radios on and false to turn them off
 */
exports.toggleRadios = function (on) {

  if (typeof jxcore === 'undefined' || !jxcore.utils.OSInfo().isMobile ||
      !jxcore.utils.OSInfo().isAndroid)
  {
    return;
  }

  if (jxcore.utils.OSInfo().isAndroid) {
    console.log('Toggling radios to ' + on);
    exports.toggleBluetooth(on, function () {
      exports.toggleWifi(on, function () {
        console.log('Radios toggled');
      });
    });
  } else {
    console.log('ERROR: toggleRadios called on unsupported platform');
  }
};

exports.toggleWifi = function (on, callback) {

  if (typeof jxcore === 'undefined') {
    callback();
    return;
  }

  Mobile.toggleWiFi(on, function (err) {
    if (err) {
      console.log('Could not toggle Wifi - ' + err);
    }
    callback();
  });
};

exports.toggleBluetooth = function (on, callback) {
  Mobile.toggleBluetooth(on, function (err) {
    if (err) {
      console.log('Could not toggle Bluetooth - ' + err);
    }
    callback();
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

module.exports.getMockWifiNetworkStatus = function (wifiEnabled) {
  return {
    wifi: wifiEnabled ? 'on' : 'off',
    bluetooth: 'doNotCare',
    bluetoothLowEnergy: 'doNotCare',
    cellular: 'doNotCare'
  };
};


module.exports.getTestPouchDBInstance = function (name) {
  // Use a folder specific to this test so that the database content
  // will not interfere with any other databases that might be created
  // during other tests.
  var dbPath = path.join(module.exports.tmpDirectory(),
    'pouch-for-testThaliSendNotificationBasedOnReplication-test');
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
