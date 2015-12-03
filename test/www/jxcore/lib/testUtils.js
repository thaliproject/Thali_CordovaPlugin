var LogCallback;
var myName;
var os = require('os');

/**
 * Turn Bluetooth and WiFi either on or off
 * This is a NOOP on iOS and the desktop
 * @param {boolean} on - true to turn radios on and false to turn them off
 */
exports.toggleRadios = function (on) {
  if (!jxcore.utils.OSInfo().isMobile) {
    return;
  }
  console.log('Toggling radios to ' + on);
  exports.toggleBluetooth(on, function () {
    exports.toggleWifi(on, function () {
      console.log('Radios toggled');
    });
  });
};

exports.toggleWifi = function (on, callback) {
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


/**
 * Sets the myName value returned on the getMyName call used in Cordova from the test framework's Cordova WebView
 * @param name
 */
exports.setMyName = function(name) {
  myName = name;
};

if (jxcore.utils.OSInfo().isMobile) {
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
