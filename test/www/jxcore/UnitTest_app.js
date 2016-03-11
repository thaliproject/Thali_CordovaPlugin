/*
 * This file needs to be renamed as app.js when we want to run unit tests
 * in order this to get loaded by the jxcore ready event.
 * This effectively acts as main entry point to the unit test app
 */

'use strict';

if (typeof Mobile === 'undefined') {
  global.Mobile = require('./lib/wifiBasedNativeMock.js')();
}

var testUtils = require('./lib/testUtils');

testUtils.toggleRadios(true);

// Give radio toggling a little bit of time to turn on
// radios and do Wifi access point association etc.
// We can't call then on the promise returned from
// toggleRadios since that triggers this issue:
// https://github.com/thaliproject/Thali_CordovaPlugin/issues/563
var radioToggleTimeout = jxcore.utils.OSInfo().isMobile ? 5000 : 0;
setTimeout(function () {
  testUtils.hasRequiredHardware()
  .then(function (hasRequiredHardware) {
    if (hasRequiredHardware) {
      Mobile('GetDeviceName').callNative(function (name) {
        console.log('My device name is: %s', name);
        testUtils.setName(name);
        require('./runTests.js');
      });
    } else {
      testUtils.logMessageToScreen(
        'Device did not have required hardware capabilities!'
      );
      console.log('****TEST_LOGGER:[PROCESS_ON_EXIT_SUCCESS]****');
    }
  });
}, radioToggleTimeout);

console.log('Unit Test app is loaded');
