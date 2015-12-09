/*
 * This file needs to be renamed as app.js when we want to run unit tests
 * in order this to get loaded by the jxcore ready event.
 * This effectively acts as main entry point to the unit test app
 */

"use strict";

var testUtils = require("./lib/testUtils");

testUtils.toggleRadios(true);

Mobile('GetDeviceName').callNative(function (name) {
  testUtils.setMyName(name);
  require('./runTests.js');
  console.log('Test app app.js loaded');
});
