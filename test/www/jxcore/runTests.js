'use strict';

var fs = require('fs-extra-promise');
var path = require('path');
var thaliTape = require('./lib/thali-tape');

var testsToRun = process.argv.length > 2 ? process.argv[2] : 'bv_tests';

fs.readdirSync(path.join(__dirname, testsToRun)).forEach(function(fileName) {
  if ((fileName.indexOf('test') == 0) && fileName.indexOf('.js', fileName.length - 3) != -1) {
    var filePath = path.join(__dirname, testsToRun, fileName);
    try {
      require(filePath);
    } catch (e) {
      console.error("Error loading: %s", filePath);
      console.error(e.stack);
      throw e; 
    }
  }
});

thaliTape.begin();
