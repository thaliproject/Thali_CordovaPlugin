"use strict";

var copyDir = require('copy-dir');

console.log('copying files');

copyDir('../../../thali', 'test/www/jxcore/thali', function (err) {
  if (err) {
    console.error('Error in copying files %s', err);
  } else {
    console.log('ok');
  }
});
