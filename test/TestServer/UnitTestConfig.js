'use strict';

// Some user-accessible config for unit tests
// Format is: { platform:{ ...settings.. } }

// numDevices - The number of devices the server will start a test with
//              (-1 == all devices)
//              Any other devices after that will just be ignored

var config = {
  ios: {
    numDevices: 0
  },
  android: {
    numDevices: 3
  }
};

module.exports = config;
