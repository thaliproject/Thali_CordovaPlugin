'use strict';

var util   = require('util');
var format = util.format;

var assert       = require('assert');
var fs           = require('fs-extra-promise');
var randomString = require('randomstring');
var path         = require('path');
var spawn        = require('child_process').spawn;
var objectAssign = require('object-assign');
var Promise      = require('bluebird');

// Before including anything serious from thali we want to ensure
// that we have SSDP_NT env defined.
if (!process.env.SSDP_NT) {
  // We want to provide a new random value.
  process.env.SSDP_NT = randomString.generate({
    length: 'http://www.thaliproject.org/ssdp'.length
  });
}

// This file is special, if it has 'Mobile' enabled
// we need to enable mobile in any child process.
if (typeof Mobile !== 'undefined') {
  process.env.isMobileForced = 1;
}

require('./lib/utils/process.js');
var testUtils = require('./lib/testUtils');
var logger    = require('./lib/testLogger')('runTests');

var platform = require('thali/NextGeneration/utils/platform');


var DEFAULT_TESTS_DIRECTORY = 'bv_tests';

// We will wait a bit before process.exit (for logs).
var EXIT_TIMEOUT = 100;

// 'fileName' should start with 'test' and end with '.js'.
function isFileNameValid (fileName) {
  return /^test.*?\.js$/i.test(fileName);
}

function getTestFile (directory, fileName) {
  assert(isFileNameValid(fileName), 'file name should be valid');
  var filePath = path.resolve(path.join(directory, fileName));
  assert(fs.existsSync(filePath), 'test file should exist');
  return filePath;
}

function getTestFilesFromDirectory (directory) {
  var testFiles = fs.readdirSync(directory)
  .filter(function (fileName) {
    return isFileNameValid(fileName);
  })
  .map(function (fileName) {
    return path.resolve(path.join(directory, fileName));
  });
  testFiles.forEach(function (filePath) {
    assert(fs.existsSync(filePath), 'test file should exist');
  });
  assert(testFiles.length > 0, 'we should have at least one test');
  return testFiles;
}

function getTestFilesFromPath (testPath) {
  if (fs.isDirectorySync(testPath)) {
    return getTestFilesFromDirectory(testPath);
  } else {
    return [getTestFile(
      path.dirname (testPath),
      path.basename(testPath)
    )];
  }
}

var testFiles;
if (process.argv.length < 3) {
  testFiles = getTestFilesFromDirectory(DEFAULT_TESTS_DIRECTORY);
} else if (process.argv.length === 3) {
  testFiles = getTestFilesFromPath(process.argv[2]);
} else {
  logger.warn(
    'arguments won\'t be used:',
    process.argv.slice(3)
    .map(function (argument) {
      return '\'' + argument + '\'';
    })
    .join(', ')
  );
  testFiles = getTestFilesFromPath(process.argv[2]);
}

// We can have here jxcore or node.
var node = process.env['_'] || 'node';
var env  = objectAssign({}, process.env);

function runTest (testFile, options) {
  function instanceLogger () {
    this.write.apply(this, arguments);
  }

  return new Promise(function (resolve, reject) {
    logger.debug('spawning test: \'%s\'', testFile);

    if (options.platform === 'ios') {
      // We couldn't use 'spawn' on ios.           
      require('./spawnTest')
      .run(testFile, options)
      .then(resolve)
      .catch(reject)
      .finally(function () {
        logger.debug('finished test: \'%s\'', testFile);
      });
      return;
    }

    var instance = spawn(
      node,
      ['./spawnTest.js', testFile, JSON.stringify(options)],
      { env: env }
    );

    instance.stdout
    .on('data', instanceLogger.bind(process.stdout))
    .on('error', instanceLogger.bind(process.stderr));

    instance.stderr
    .on('data', instanceLogger.bind(process.stderr))
    .on('error', instanceLogger.bind(process.stderr));

    instance.on('exit', function (code, signal) {
      logger.debug('finished test: \'%s\'', testFile);
      if (code === 0 && signal === null) {
        resolve();
      } else {
        reject(new Error(format(
          'test process failed with code: %d, signal: \'%s\'',
          code, signal
        )));
      }
    });
  });
}

function run () {
  testUtils.hasRequiredHardware()
  .then(function (hasRequiredHardware) {
    return testUtils.getOSVersion()
    .then(function (version) {
      var currentPlatform = platform.name;
      // Our current platform can be 'darwin', 'linux', 'windows', etc.
      // Our 'thaliTape' expects all these platforms will be named as 'desktop'.
      if (!platform.isMobile || !currentPlatform) {
        currentPlatform = 'desktop';
      }

      var nativeUTFailed = global.nativeUTFailed;
      if (nativeUTFailed === undefined || nativeUTFailed === null) {
        nativeUTFailed = false;
      }

      var options = {
        platform:            currentPlatform,
        version:             version,
        hasRequiredHardware: hasRequiredHardware,
        nativeUTFailed:      nativeUTFailed
      };

      return Promise.mapSeries(testFiles, function (testFile) {
        return runTest(testFile, options);
      });
    });
  })
  .then(function () {
    logger.debug('****TEST_LOGGER:[PROCESS_ON_EXIT_SUCCESS]****');
    setTimeout(function () {
      process.exit(0);
    }, EXIT_TIMEOUT);
  })
  .catch(function (error) {
    logger.error(
      'unexpected error: \'%s\', stack: \'%s\'',
      error.toString(), error.stack
    );
    logger.debug('****TEST_LOGGER:[PROCESS_ON_EXIT_FAILED]****');
    setTimeout(function () {
      process.exit(1);
    }, EXIT_TIMEOUT);
  });
}

if (!module.parent) {
  run();
}
module.exports = run;
