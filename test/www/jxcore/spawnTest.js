'use strict';

var assert = require('assert');
var fs     = require('fs-extra-promise');

var thaliTape = require('./lib/thaliTape');

// The global.Mobile object is replaced here after thaliTape
// has been required so that thaliTape can pick up the right
// test framework to be used.
if (typeof Mobile === 'undefined') {
  global.Mobile = require('./lib/wifiBasedNativeMock.js')();
}


assert(process.argv.length === 4, 'we should receive 2 arguments: testFile and options');

var testFile = process.argv[2];
assert(fs.existsSync(testFile), 'test file should exist');

var options  = process.argv[3];
options = JSON.parse(options);
assert(options.platform            !== undefined, '\'platform\' should be defined');
assert(options.version             !== undefined, '\'version\' should be defined');
assert(options.hasRequiredHardware !== undefined, '\'hasRequiredHardware\' should be defined');
assert(options.nativeUTFailed      !== undefined, '\'nativeUTFailed\' should be defined');


require(testFile);
thaliTape.begin(options)
.then(function () {
  process.exit(0);
})
.catch(function (error) {
  process.exit(1);
});
