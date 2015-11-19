var LogCallback;
var myName;
var os = require('os');
/**
 * Turn Bluetooth and WiFi either on or off
 * This is a NOOP on iOS and the desktop
 * @param {boolean} on - True to turn radios on and False to turn them off
 */
exports.toggleRadios = function(on) {
  if (typeof jxcore == 'undefined' || !jxcore.utils.OSInfo().isMobile) {
    return;
  }
  console.log("Turning radios to " + on);
  Mobile.toggleBluetooth(on, function(err) {
    if (err) {
      console.log("We could not set Bluetooth! - " + err);
    }
    console.log("toggleBluetooth - ");
    Mobile.toggleWiFi(on, function(err) {
      if (err) {
        console.log("We could not set WiFi! - " + err);
      }

      console.log("toggleWiFi");
    });
  });
};

exports.reFreshWifi = function() {
  if (typeof jxcore === 'undefined' || !jxcore.utils.OSInfo().isMobile) {
    return;
  }
  console.log("Turning Wifi off");
  Mobile.toggleWiFi(false, function(err) {
    if (err) {
      console.log("We could not turn wifi off! - " + err);
    }
    console.log("Turning Wifi back on");
    Mobile.toggleWiFi(true, function(err) {
      if (err) {
        console.log("We could turn wifi back on! - " + err);
      }

      console.log("toggleWiFi finished");

      if(jxcore.utils.OSInfo().isAndroid) {
        Mobile('ReconnectWifiAP').callNative(function (err) {
          if (err) {
            console.log("ReconnectWifiAP returned error: " + err );
            Coordinator.close();
            return;
          }

          console.log("ReconnectWifiAP finished");
        });
      }

    });
  });
};

exports.printNetworkInfo = function() {

  console.log("printNetworkInfo");

  var networkInterfaces = os.networkInterfaces();
  Object.keys(networkInterfaces).forEach(function (interfaceName) {
    console.log("found interfaceName: " +interfaceName);
    networkInterfaces[interfaceName].forEach(function (iface) {
      console.log("-iface: " +iface.family + " is internal : " + iface.internal + ", has ip: " + iface.address);
    });
  });
}

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
