'use strict';

var fs = require('fs-extra-promise');
var path = require('path');
var format = require('util').format;

var logger = require('./testLogger')('testLoader');


function sortFiles(files, preferredOrder) {
  if (!Array.isArray(preferredOrder)) {
    logger.info('Tests order is not specified. They will be sorted by name');
    preferredOrder = [];
  }
  files.sort(function (f1, f2) {
    var f1Name = path.basename(f1);
    var f2Name = path.basename(f2);
    var index1 = preferredOrder.indexOf(f1Name);
    var index2 = preferredOrder.indexOf(f2Name);

    if (index1 === -1 && index2 === -1) {
      // compare by name
      return f1Name > f2Name ? 1 : f1Name === f2Name ? 0 : -1;
    }

    // move unknown tests to the end of the list
    if (index1 === -1) { return 1; }
    if (index2 === -1) { return -1; }

    return index1 - index2;
  });
}


function hasJavaScriptSuffix (path) {
  return path.indexOf('.js', path.length - 3) !== -1;
};

function loadFile (filePath) {
  logger.info('loading file:', filePath);
  try {
    require(filePath);
  } catch (error) {
    var prettyError = format(
      'test load failed, filePath: \'%s\', error: \'%s\', stack: \'%s\'',
      filePath, error.toString(), error.stack
    );
    logger.error(prettyError);
    throw new Error(prettyError);
  }
};

module.exports.load = function (testsToRun, preferredOrder) {
  loadFile("../bv_tests/testTests.js");
  return;
  if (hasJavaScriptSuffix(testsToRun)) {
    loadFile(testsToRun);
  } else {
    var testFiles = fs.readdirSync(testsToRun).filter(function (fileName) {
      return fileName.indexOf('test') === 0 && hasJavaScriptSuffix(fileName);
    });
    sortFiles(testFiles, preferredOrder);
    testFiles.forEach(function (fileName) {
      if (fileName.indexOf('test') === 0 && hasJavaScriptSuffix(fileName)) {
        var filePath = path.join(testsToRun, fileName);
        loadFile(filePath);
      }
    });
  }
};
