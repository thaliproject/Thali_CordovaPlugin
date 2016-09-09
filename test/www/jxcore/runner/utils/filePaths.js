'use strict';
var fs = require('fs');
var path = require('path');

var isDirectory = function (location) {
  return fs.lstatSync(location).isDirectory();
};

var directoryFiles = function (folder) {
  var filePaths = [];
  fs.readdirSync(folder)
    .forEach(function (file) {
      var filePath = path.resolve(folder, file);
      filePaths.push(filePath);
    });
  return filePaths;
};

var normalizePath = function (filePath) {
    var cwd = process.cwd();
    return path.resolve(cwd, filePath);
};
/**
 * @param {String[]} locations - a list of folders and files
 * where tests should be searched
 * @param {RegExp} pattern that founded files should match
 * @returns {String[]} filePaths is a list of normalized file paths
 */
module.exports = function (locations, pattern) {
  var filePaths = [];

  locations.forEach(function (location) {
    if (isDirectory(location)) {
      var files = directoryFiles(location);
      filePaths = filePaths.concat(files);
    } else {
      filePaths.push(location);
    }
  });

  if (pattern) {
    filePaths = filePaths.filter(function (filePath) {
      return filePath.match(pattern);
    });
  }

  filePaths = filePaths.map(normalizePath);

  return filePaths;
};