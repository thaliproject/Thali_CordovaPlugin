'use strict';
var argv = require('minimist')(process.argv.slice(2));
var help = require('./help');
var execute = require('./execute');

var DEFAULT_TESTS_FOLDER = 'bv_tests';

/**
 * @param {Object} argv a minimist parsed cli arguments
 */
var parseArgv = function (argv) {
  if ('help' in argv || 'h' in argv) {
    return help();
  }

  var testFiles = argv['_'];

  if(testFiles.length) {
    return execute({
      files: testFiles
    });
  }

  return execute({
    files: DEFAULT_TESTS_FOLDER
  });
};

// If running from CLI
if (!module.parent) {
  return parseArgv(argv);
}

// If running as module
module.exports.run = function () {
  return execute({
    files: DEFAULT_TESTS_FOLDER
  });
};
