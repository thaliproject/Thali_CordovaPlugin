/*
 * This file needs to be renamed as app.js when we want to run unit tests
 * in order this to get loaded by the jxcore ready event.
 * This effectively acts as main entry point to the unit test app
 */

"use strict";

var testUtils = require("./lib/testUtils");

if (typeof Mobile === 'undefined') {
  global.Mobile = require('./lib/MobileUsingWifi.js');
}

testUtils.toggleRadios(true);

Mobile('GetDeviceName').callNative(function (name) {
  console.log("My device name is: %s", name);
  testUtils.setName(name);
  require('./runTests.js');
  console.log('Test app app.js loaded');
});
