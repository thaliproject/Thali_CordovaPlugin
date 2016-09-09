'use strict';

var config = require('./config.json');
var DEFAULT_TESTS_FOLDER = config.DEFAULT_TESTS_FOLDER;

module.exports = function () {
  console.info(' :: Thali Test Runner ::\n');
  console.info('By default Thali Test Runner will execute test files from',
    DEFAULT_TESTS_FOLDER, ' folder\n');
  console.info('To execute all test files from ' + DEFAULT_TESTS_FOLDER +
    'folder type\n`jx runner/index.js`\n');
  console.info('To execute test files from an another folder ' +
    'type\n`jx runner/index.js <path to a folder>`\n');
  console.info('To execute a single test file ' +
    'type\n`jx runner/index.js <path to a test file>`\n');
  console.info('It\'s also possible to specify files and folders together:');
  console.info('`jx runner/index.js <path to a folder> <path to a test file> ' +
  '<path to another test file>`');
};