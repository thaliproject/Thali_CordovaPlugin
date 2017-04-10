'use strict';

// Default amount of devices required to run tests.

module.exports = {
  devices: {
    // This is a list of required platforms.
    // All required platform should have minDevices entry.
    // So all required platforms should be listed in desired platform list.
    ios: -1,
    android: -1,
    desktop: -1
  },
  minDevices: {
    // This is a list of desired platforms.
    ios: 2,
    android: 3,
    desktop: 3
  },
  // if 'devices[platform]' is -1 we wont limit the amount of devices.
  // We will wait some amount of time before tests.
  waiting_for_devices_timeout: 5 * 1000
};
