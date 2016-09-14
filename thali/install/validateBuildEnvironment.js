'use strict';

var exec = require('child-process-promise').exec;
var Promise = require('lie');
var path = require('path');
var fs = require('fs-extra-promise');

var androidSdkPath = null;

function getAndroidSdkPath() {
  if (androidSdkPath) {
    return Promise.resolve(androidSdkPath);
  }
  return exec('which android')
    .catch(function (err) {
      return Promise.reject('which android failed with ' + err);
    })
    .then(function (result) {
      androidSdkPath = path.join(path.dirname(result.stdout), '..');
      return androidSdkPath;
    });
}

var commandsAndResults = [
  {
    'node': {
      'versionRequired': '6.3.1',
      'versionCheck': 'node -v',
      'versionResult': function (expectedVersion, result) {
        return 'v' + expectedVersion === result.trim();
      }
    }
  },
  {
    'npm': {
      'versionRequired': '3.10.3',
      'versionCheck': 'npm -v',
      'versionResult': function (expectedVersion, result) {
        return expectedVersion === result.trim();
      }
    }
  },
  {
    'brew': {
      'versionRequired': '0.9.9',
      'versionCheck': 'brew -v',
      'versionResult': function (expectedVersion, result) {
        return result.startsWith('Homebrew ' + expectedVersion + ' ');
      }
    }
  },
  {
    'ruby': {
      'versionRequired': '2.3.0p0',
      'versionCheck': 'ruby -v',
      'versionResult': function (expectedVersion, result) {
        return result.startsWith('ruby ' + expectedVersion + ' ');
      }
    }
  },
  {
    'wget': {
      'versionRequired': '1.18',
      'versionCheck': 'wget -V',
      'versionResult': function (expectedVersion, result) {
        return result.startsWith('GNU Wget ' + expectedVersion + ' ');
      }
    }
  },
  {
    'openssl': {
      'versionRequired': '0.9.8zh',
      'versionCheck': 'openssl version',
      'versionResult': function (expectedVersion, result) {
        return result.startsWith('OpenSSL ' + expectedVersion + ' ');
      }
    }
  },
  {
    'jxcore': {
      'versionRequired': '0.3.1.4',
      'versionCheck': 'jx -jxv',
      'versionResult': function (expectedVersion, result) {
        return 'v' + expectedVersion === result.trim();
      }
    }
  },
  // {
  //   'androidBuildTools': {
  //     'versionRequired': '23.0.3',
  //     'versionCheck': function () {
  //       return getAndroidSdkPath()
  //         .then(function (androidSdkPath) {
  //           var androidBuildToolsPath = path.join(androidSdkPath,
  //                                                 'build-tools');
  //           return fs.readdirAsync(androidBuildToolsPath);
  //         });
  //     },
  //     'versionResult': function (expectedVersion, result) {
  //       return result.findIndex(function (dirName) {
  //           return dirName === expectedVersion;
  //         }) !== -1;
  //     }
  //   }
  // }
];

module.exports.commandsAndResults = commandsAndResults;

function execAndCheck(command, expectedVersion, validator) {
  return exec(command)
    .then(function (result) {
      return validator(expectedVersion, result.stdout) ? true :
        Promise.reject('Command: ' + command + ' failed');
    });
}

function processCommandsAndResults(commandsAndResults) {
  var promises = [];
  commandsAndResults.forEach(function (wrapperObject) {
    var commandAndResult =
      wrapperObject[Object.getOwnPropertyNames(wrapperObject)[0]];
    if (typeof commandAndResult.versionCheck === 'function') {
      promises.push(
        commandAndResult.versionCheck()
        .then(function (directories) {
          return commandAndResult.versionResult(
                  commandAndResult.versionRequired, directories);
        }));
    }
    promises.push(execAndCheck(commandAndResult.versionCheck,
      commandAndResult.versionRequired,
      commandAndResult.versionResult));
  });
  return Promise.all(promises);
}

processCommandsAndResults(commandsAndResults)
  .then(function () {
    console.log("it worked!");
  })
  .catch(function (err) {
    console.log(err);
  });
