'use strict';

var assert = require('assert');
var fs     = require('fs-extra-promise');

if (typeof Mobile === 'undefined' && process.env.isMobileForced) {
  global.Mobile = require('./lib/wifiBasedNativeMock.js')();
}

var thaliTape = require('./lib/thaliTape');

if (typeof Mobile === 'undefined') {
  global.Mobile = require('./lib/wifiBasedNativeMock.js')();
}


// We will wait a bit before process.exit (for logs).
var EXIT_TIMEOUT = 100;

function run (testFile, options) {
  assert(fs.existsSync(testFile), 'test file should exist');

  assert(options.platform            !== undefined, '\'platform\' should be defined');
  assert(options.version             !== undefined, '\'version\' should be defined');
  assert(options.hasRequiredHardware !== undefined, '\'hasRequiredHardware\' should be defined');
  assert(options.nativeUTFailed      !== undefined, '\'nativeUTFailed\' should be defined');

  require(testFile);
  return thaliTape.begin(options);
}
if (!module.parent) {
  assert(process.argv.length === 4, 'we should receive 2 arguments: testFile and options');

  var testFile = process.argv[2];

  var options = process.argv[3];
  options = JSON.parse(options);

  run(testFile, options)
  .then(function () {
    setTimeout(function () {
      process.exit(0);
    }, EXIT_TIMEOUT);
  })
  .catch(function (error) {
    setTimeout(function () {
      process.exit(1);
    }, EXIT_TIMEOUT);
  });
}
module.exports.run = run;
