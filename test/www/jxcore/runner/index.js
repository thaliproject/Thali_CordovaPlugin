'use strict';
var argv = require('minimist')(process.argv.slice(2));
var config = require('./config.json');
var help = require('./help');
var execute = require('./execute');

var DEFAULT_TESTS_FOLDER = config.DEFAULT_TESTS_FOLDER;
var defaultLocation = [DEFAULT_TESTS_FOLDER];
/**
 * @param {Object} argv a minimist parsed cli arguments
 */
var parseArgv = function (argv) {
  if ('help' in argv || 'h' in argv) {
    return help();
  }

  var locations = argv['_'];

  if(locations.length) {
    return execute(locations);
  }

  return execute(defaultLocation);
};

// If running from CLI
if (!module.parent) {
  return parseArgv(argv);
}

// If running as module
module.exports.run = function (locations) {
  var opts = locations || defaultLocation;
  return execute(opts);
};
