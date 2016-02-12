var LogCallback;
var os = require('os');
var tmp = require('tmp');

/**
 * Turn Bluetooth and WiFi either on or off
 * This is a NOOP on iOS and the desktop
 * @param {boolean} on - true to turn radios on and false to turn them off
 */
exports.toggleRadios = function(on) {

  if (typeof jxcore == 'undefined' || !jxcore.utils.OSInfo().isMobile || 
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
    console.log("ERROR: toggleRadios called on unsupported platform");
  }
};

exports.toggleWifi = function (on, callback) {

  if (typeof jxcore == 'undefined') {
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
 * Logs the result of BLE advertisement support check on Android.
 */
if (typeof jxcore !== 'undefined' && jxcore.utils.OSInfo().isAndroid) {
  Mobile('isBleAdvertisingSupported').callNative(function (err) {
    if (err) {
      console.log('BLE advertisements not supported: ' + err);
    } else {
      console.log("BLE advertisements supported");
    }
  });
}
