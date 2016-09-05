'use strict';
var fs = require('fs');
var path = require('path');
/**
 * @param {String} location where files should be search
 * can be a folder or file itself
 * @param {RegExp} pattern that founded files should match
 */
module.exports = function (location, pattern) {
  if (typeof location !== 'string') {
    throw new Error('location must be a string!');
  }

  var cwd = process.cwd();
  var filePaths = [];

  if (location.match(pattern)) {
    var filePath = path.resolve(cwd, location);
    filePaths.push(filePath);
  } else {
    fs.readdirSync(location)
      .forEach(function (file) {
        if (file.match(pattern)) {
          var filePath = path.resolve(cwd, location, file);
          filePaths.push(filePath);
        }
      });
  }

  return filePaths;
}