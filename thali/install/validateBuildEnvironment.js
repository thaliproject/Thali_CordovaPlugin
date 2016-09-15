'use strict';

var exec = require('child-process-promise').exec;
var Promise = require('lie');
var path = require('path');
var fs = require('fs-extra-promise');

var androidBrewBasePath = '/usr/local/Cellar/android-sdk';

var commandsAndResults =
  {
    'xcode': {
      'versionRequired': '7.3.1',
      'versionCheck': 'xcodebuild -version',
      'versionResult': function (expectedVersion, result) {
        return result.startsWith('Xcode '+ expectedVersion + '\n');
      }
    },
    'osX': {
      'versionRequired': '10.11.6',
      'versionCheck': 'sw_vers -productVersion',
      'versionResult': function (expectedVersion, result) {
        return expectedVersion === result.trim();
      }
    },
    'node': {
      'versionRequired': '6.3.1',
      'versionCheck': 'node -v',
      'versionResult': function (expectedVersion, result) {
        return 'v' + expectedVersion === result.trim();
      }
    },
    'npm': {
      'versionRequired': '3.10.3',
      'versionCheck': 'npm -v',
      'versionResult': function (expectedVersion, result) {
        return expectedVersion === result.trim();
      }
    },
    'brew': {
      'versionRequired': '0.9.9',
      'versionCheck': 'brew -v',
      'versionResult': function (expectedVersion, result) {
        return result.startsWith('Homebrew ' + expectedVersion + ' ');
      }
    },
    'ruby': {
      'versionRequired': '2.3.0p0',
      'versionCheck': 'ruby -v',
      'versionResult': function (expectedVersion, result) {
        return result.startsWith('ruby ' + expectedVersion + ' ');
      }
    },
    'wget': {
      'versionRequired': '1.18',
      'versionCheck': 'wget -V',
      'versionResult': function (expectedVersion, result) {
        return result.startsWith('GNU Wget ' + expectedVersion + ' ');
      }
    },
    'openssl': {
      'versionRequired': '0.9.8zh',
      'versionCheck': 'openssl version',
      'versionResult': function (expectedVersion, result) {
        return result.startsWith('OpenSSL ' + expectedVersion + ' ');
      }
    },
    'jxcore': {
      'versionRequired': '0.3.1.4',
      'versionCheck': 'jx -jxv',
      'versionResult': function (expectedVersion, result) {
        return 'v' + expectedVersion === result.trim();
      }
    },
    'androidSDKTools' : {
      'versionRequired': '24.4.1_1',
      'versionCheck': function () {
        return fs.readdirAsync(androidBrewBasePath);
      },
      'versionResult': function (expectedVersion, result) {
        return result.indexOf(expectedVersion) !== -1;
      }
    },
    'androidBuildTools': {
      'versionRequired': '23.0.3',
      'versionCheck': function () {
        return fs.readdirAsync(path.join(androidSdkVersionPath(),
                                'build-tools'));
      },
      'versionResult': function (expectedVersion, result) {
        return result.indexOf(expectedVersion) !== -1;
      }
    },
    'androidPlatform': {
      'versionRequired': '23',
      'versionCheck': function () {
        return fs.readdirAsync(path.join(androidSdkVersionPath(), 'platforms'));
      },
      'versionResult': function (expectedVersion, result) {
        return result.indexOf('android-'+expectedVersion) !== -1;
      }
    },
    'cordovaAndroidSetMinSDK': {
      'versionRequired': '22',
      'versionCheck': 'echo $ORG_GRADLE_PROJECT_cdvMinSdkVersion',
      'versionResult': function (expectedVersion, result) {
        return expectedVersion === result.trim();
      }
    },
    'cordovaAndroidSetBuildToolsVersion': {
      'versionRequired': function () {
        return commandsAndResults.androidBuildTools.versionRequired;
      },
      'versionCheck': 'echo $ORG_GRADLE_PROJECT_cdvBuildToolsVersion',
      'versionResult': function (expectedVersion, result) {
        return expectedVersion === result.trim();
      }
    },
    'cordovaAndroidSetCompileSdkVersion': {
      'versionRequired': function () {
        return commandsAndResults.androidPlatform.versionRequired;
      },
      'versionCheck': 'echo $ORG_GRADLE_PROJECT_cdvCompileSdkVersion',
      'versionResult': function (expectedVersion, result) {
        return expectedVersion === result.trim();
      }
    },
    'AndroidHome': {
      'versionRequired': function () {
        return androidSdkVersionPath();
      },
      'versionCheck': 'echo $ANDROID_HOME',
      'versionResult': function (expectedVersion, result) {
        return expectedVersion === result.trim();
      }
    },
    'python': {
      'versionRequired': '2.7.10',
      'versionCheck': 'python -V',
      'checkStdErr': true, // http://bugs.python.org/issue28160?@ok_message=msg%20276496%20created%0Aissue%2028160%20created&@template=item
      'versionResult': function (expectedVersion, result) {
        return 'Python ' + expectedVersion === result.trim();
      }
    },
    'cordova': {
      'versionRequired': '6.0.0',
      'versionCheck': 'cordova -v',
      'versionResult': function (expectedVersion, result) {
        return expectedVersion === result.trim();
      }
    },
    'java': {
      'versionRequired': '1.8.0_102',
      'versionCheck': 'java -version',
      'checkStdErr': true, // Review ID: JI-9043760
      'versionResult': function (expectedVersion, result) {
        return result.startsWith('java version "' + expectedVersion + '"\n');
      }
    },
    'git': {
      'versionRequired': '2.7.4',
      'versionCheck': 'git --version',
      'versionResult': function (expectedVersion, result) {
        return result.startsWith('git version ' + expectedVersion + ' ');
      }
    }
  };

function androidSdkVersionPath() {
  return path.join(androidBrewBasePath,
                    commandsAndResults.androidSDKTools.versionRequired);
}

module.exports.commandsAndResults = commandsAndResults;

function execAndCheck(command, checkStdErr, expectedVersion, validator) {
  return exec(command)
    .then(function (result) {
      var output = checkStdErr ? result.stderr : result.stdout;
      return validator(expectedVersion, output) ? true :
        Promise.reject('Command: ' + command + ' failed');
    });
}

function processCommandsAndResults(commandsAndResults) {
  var promises = [];
  Object.getOwnPropertyNames(commandsAndResults).forEach(function (name) {
    var commandAndResult = commandsAndResults[name];
    var versionRequired = typeof commandAndResult.versionRequired === 'function'
      ? commandAndResult.versionRequired() : commandAndResult.versionRequired;
    if (typeof commandAndResult.versionCheck === 'function') {
      promises.push(
        commandAndResult.versionCheck()
          .then(function (directories) {
            return commandAndResult.versionResult(versionRequired, directories);
          }));
      return;
    }
    promises.push(execAndCheck(commandAndResult.versionCheck,
                               commandAndResult.checkStdErr, versionRequired,
                                commandAndResult.versionResult));
  });
  return Promise.all(promises);
}

processCommandsAndResults(commandsAndResults)
  .then(function () {
    // Good to clean this up in case we have changed the version of jxcore
    var home = process.env.HOME;
    var jx = path.join(home, '.jx');
    var nodeGyp = path.join(home, 'node-gyp');
    return Promise.all([fs.removeAsync(jx), fs.removeAsync(nodeGyp)]);
  }).then(function () {
    console.log('Environment validated');
    process.exit(1);
  }).catch(function (err) {
    console.log('Environment not valid: ' + err);
    process.exit(-1);
  });
