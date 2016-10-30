'use strict';

var thaliTestRunner = require('./runner');
var MobileMock = require('./lib/wifiBasedNativeMock');

if (global.Mobile === undefined) {
  global.Mobile = MobileMock();
}

thaliTestRunner.run();