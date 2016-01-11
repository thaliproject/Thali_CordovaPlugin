// Some user-accessible config for unit tests
// Format is: { platform:{ ...settings.. } }

// numDevices - The number of devices the server will start a test with (-1 == all devices)
//              Any other devices after that will just be ignored
//              Note: Unit tests are designed to require just two devices

var config = {
  ios: {
    numDevices:2
  },
  android: {
    numDevices:2
  }
}

module.exports = config;
