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
  if('filter' in argv || 'f' in argv) {
    return execute({
      filter: argv.filter
    });
  }

  return execute({
    filter: DEFAULT_TESTS_FOLDER
  });
};

// Works for both when required as module and when executed from CLI
parseArgv(argv);