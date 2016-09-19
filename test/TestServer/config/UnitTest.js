'use strict';

// Default amount of devices required to run tests.

module.exports = {
  devices: {
    ios: 3,
    android: 3
  },
  minDevices: {
    ios: 3,
    android: 3
  },
  // if 'devices[platform]' is -1 we wont limit the amount of devices.
  // We will wait some amount of time before tests.
  waiting_for_devices_timeout: 5 * 1000
};
