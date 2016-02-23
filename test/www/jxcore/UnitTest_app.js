/*
 * This file needs to be renamed as app.js when we want to run unit tests
 * in order this to get loaded by the jxcore ready event.
 * This effectively acts as main entry point to the unit test app
 */

'use strict';

if (typeof Mobile === 'undefined') {
  global.Mobile = require('./lib/wifiBasedNativeMock.js')();
}
else {
  var oldFn = Mobile.prototype.registerToNative;
  Mobile.prototype.registerToNative = function(target) {
    oldFn.call(this, target);
    Mobile("didRegisterToNative").callNative(this.name);
  }
}

var testUtils = require('./lib/testUtils');

testUtils.toggleRadios(true)
.then(function () {
  Mobile('GetDeviceName').callNative(function (name) {
    console.log('My device name is: %s', name);
    testUtils.setName(name);
    require('./runTests.js');
  });
})
.catch(function (error) {
  console.log('Something went wrong: ' + error);
});

console.log('Unit Test app is loaded');
