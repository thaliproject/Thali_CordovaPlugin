'use strict';

var fs = require('fs-extra-promise');
var path = require('path');
var format = require('util').format;

var logger = require('./testLogger')('testLoader');

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

module.exports.load = function (testsToRun) {
  if (hasJavaScriptSuffix(testsToRun)) {
    loadFile(testsToRun);
  } else {
    fs.readdirSync(testsToRun)
    .forEach(function (fileName) {
      if (fileName.indexOf('test') === 0 && hasJavaScriptSuffix(fileName)) {
        var filePath = path.join(testsToRun, fileName);
        loadFile(filePath);
      }
    });
  }
};
