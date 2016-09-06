'use strict';
var fs = require('fs');
var path = require('path');
/**
 * @param {String|String[]} location is a folder where files
 * should be searched or a list of filenames to be proceeded
 * can be a folder or file itself
 * @param {RegExp} pattern that founded files should match
 * @returns {String[]} filePaths is a list of file paths
 */
module.exports = function (location, pattern) {
  var ptrn = pattern || /.*/;
  var cwd = process.cwd();
  var filePaths = [];

  // location is a folder name
  if (typeof location === 'string') {
    fs.readdirSync(location)
      .forEach(function (file) {
        if (file.match(ptrn)) {
          var filePath = path.resolve(cwd, location, file);
          filePaths.push(filePath);
        }
      });
  }

  // location is an array of filenames
  if (Array.isArray(location)) {
    location.forEach(function (file) {
      if (file.match(ptrn)) {
        var filePath = path.resolve(cwd, file);
        filePaths.push(filePath);
      }
    });
  }

  return filePaths;
}