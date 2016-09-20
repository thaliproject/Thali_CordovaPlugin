'use strict';

/* jshint esnext: true */

var exec = require('child-process-promise').exec;
var path = require('path');
var fs = require('fs-extra-promise');

var androidBrewBasePath = '/usr/local/Cellar/android-sdk';

// We need to check for the config values in package.json in thali root to set
// the values of JXcore-cordva
/*

 ANDROID_HOME - Agreed, I'll fix

 Sinopia - We have to make sure we have set up NPM to talk to it

 */

var versions =
{
  xcode: '7.3.1',
  xcodeCommandLineTools: ' ',
  osX: '10.11.6',
  node: '6.6.0',
  npm: '3.10.3',
  brew: '0.9.9',
  ruby: '2.3.0p0',
  wget: '1.18',
  jxcore: '0.3.1.4',
  androidSDKTools: '24.4.1_1',
  androidBuildTools: '23.0.3',
  androidPlatform: 'android-23',
  cordovaAndroidSetMinSDK: '22',
  get cordovaAndroidSetBuildToolsVersion() {
    return this.androidBuildTools;
  },
  get cordovaAndroidSetCompileSdkVersion() {
    return this.androidPlatform;
  },
  get AndroidHome() {
    return androidSdkVersionPath();
  },
  python: '2.7.10',
  cordova: '6.3.1',
  java: '1.8.0_102',
  git: '2.7.4',
  swiftLint: '0.1.1'
};

module.exports.versions = versions;

function execAndCheck(command, checkStdErr, version, validator) {
  return exec(command)
    .then(function (result) {
      var output = checkStdErr ? result.stderr : result.stdout;
      return validator(output, version) ? Promise.resolve(true) :
        Promise.reject(new Error('Command: ' + command + ' failed'));
    });
}

/**
 * Checks if the named object is installed with the named version, if any. If
 * versionNumber isn't given then we default to checking the versions global
 * object.
 * @param {string} objectName Name of the object to validate
 * @param {string} [versionNumber] An optional string specifying the desired
 * version. If omitted we will check the versions structure.
 * @returns {Promise<Error|boolean>} If the desired object is found at the
 * desired version then a resolve will be returned set to true. Otherwise an
 * error will be returned specifying what went wrong.
 */
function checkVersion(objectName, versionNumber) {
  const desiredVersion = versionNumber ? versionNumber : versions[objectName];
  const commandAndResult = commandsAndResults[objectName];
  if (!commandAndResult) {
    return Promise.reject(
      new Error('Unrecognized objectName in commandsAndResults'));
  }
  if (!desiredVersion) {
    return Promise.reject(new Error('Unrecognized objectName in versions'));
  }
  if (typeof commandAndResult.versionCheck === 'function') {
    return new Promise(function (resolve, reject) {
      return commandAndResult.versionValidate(
                  commandAndResult.versionCheck(), desiredVersion) ?
                  resolve(true) : reject(new Error('Version not installed'));
    });
  }
  return execAndCheck(commandAndResult.versionCheck,
                      commandAndResult.checkStdErr,
                      desiredVersion,
                      commandAndResult.versionValidate);
}

module.exports.checkVersion = checkVersion;

var commandsAndResults =
  {
    xcode: {
      versionCheck: 'xcodebuild -version',
      versionValidate:
        (result, version) => result.startsWith('Xcode '+ version + '\n')
    },
    xcodeCommandLineTools: {
      // I couldn't find any reliable way to validate which versions of the
      // tools are installed. The best I could do was find out which directory
      // they are supposed to be in. I tried http://stackoverflow.com/questions/15371925/how-to-check-if-command-line-tools-is-installed
      // and xcode-select -p returns a directory inside of XCode and none of
      // the pkgutil commands worked properly on my machine.
      versionCheck: () => fs.readdirSync('/Library/Developer/CommandLineTools'),
      versionValidate:
        (result, version) => result && result.length === 2 &&
                              result[0] === 'Library' && result[1] === 'usr'
    },
    osX: {
      versionCheck: 'sw_vers -productVersion',
      versionValidate:
        (result, version) => version === result.trim()
    },
    node: {
      versionCheck: 'node -v',
      versionValidate:
        (result, version) =>  'v' + version === result.trim()
    },
    npm: {
      versionCheck: 'npm -v',
      versionValidate:
        (result, version) =>  version === result.trim()
    },
    brew: {
      versionCheck: 'brew -v',
      versionValidate:
        (result, version) =>  result.startsWith('Homebrew ' + version + ' ')
    },
    ruby: {
      versionCheck: 'ruby -v',
      versionValidate:
        (result, version) =>  result.startsWith('ruby ' + version + ' ')
    },
    wget: {
      versionCheck: 'wget -V',
      versionValidate:
        (result, version) =>  result.startsWith('GNU Wget ' + version + ' ')
    },
    jxcore: {
      versionCheck: 'jx -jxv',
      versionValidate:
        (result, version) =>  'v' + version === result.trim()
    },
    androidSDKTools: {
      versionCheck: () => fs.readdirSync(androidBrewBasePath),
      versionValidate:
        (result, version) =>  result.indexOf(version) !== -1
    },
    androidBuildTools: {
      versionCheck: () => fs.readdirSync(path.join(androidSdkVersionPath(),
                                'build-tools')),
      versionValidate:
        (result, version) =>  result.indexOf(version) !== -1
    },
    androidPlatform: {
      versionCheck: () => fs.readdirSync(path.join(androidSdkVersionPath(),
                                          'platforms')),
      versionValidate:
        (result, version) =>  result.indexOf(version) !== -1
    },
    cordovaAndroidSetMinSDK: {
      versionCheck: 'echo $ORG_GRADLE_PROJECT_cdvMinSdkVersion',
      versionValidate:
        (result, version) =>  version === result.trim()
    },
    cordovaAndroidSetBuildToolsVersion: {
      versionCheck: 'echo $ORG_GRADLE_PROJECT_cdvBuildToolsVersion',
      versionValidate:
        (result, version) =>  version === result.trim()
    },
    cordovaAndroidSetCompileSdkVersion: {
      versionCheck: 'echo $ORG_GRADLE_PROJECT_cdvCompileSdkVersion',
      versionValidate:
        (result, version) =>  version === result.trim()
    },
    AndroidHome: {
      versionCheck: 'echo $ANDROID_HOME',
      versionValidate:
        (result, version) =>  version === result.trim()
    },
    python: {
      versionCheck: 'python -V',
      checkStdErr: true, // http://bugs.python.org/issue28160 - fixed in 3.4
      versionValidate:
        (result, version) =>  'Python ' + version === result.trim()
    },
    cordova: {
      versionCheck: 'cordova -v',
      versionValidate:
        (result, version) =>  version === result.trim()
    },
    java: {
      versionCheck: 'java -version',
      checkStdErr: true, // http://bugs.java.com/bugdatabase/view_bug.do?bug_id=JDK-8166116
      versionValidate:
        (result, version) =>  result.startsWith('java version "' + version +
                                                  '"\n')
    },
    git: {
      versionCheck: 'git --version',
      versionValidate:
        (result, version) =>  result.startsWith('git version ' + version + ' ')
    },
    swiftLint: {
      versionCheck: 'swiftlint version',
      versionValidate:
        (result, version) => version === result.trim()
    }
  };

function androidSdkVersionPath() {
  return path.join(androidBrewBasePath,
                    versions.androidSDKTools);
}

function processCommandsAndResults(commandsAndResults) {
  var promises = [];
  Object.getOwnPropertyNames(commandsAndResults).forEach(function (name) {
    promises.push(checkVersion(name));
  });
  return Promise.all(promises);
}

// Detects if we were called from the command line
if (require.main === module) {
  const versionsCount = Object.getOwnPropertyNames(versions).length;
  const commandsAndResultCount =
    Object.getOwnPropertyNames(commandsAndResults).length;
  if (versionsCount !== commandsAndResultCount) {
    console.log('Versions and commandsAndResults don\'t have the same length,' +
                ' so something is wrong.');
    process.exit(-1);
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
    process.exit(0);
  }).catch(function (err) {
    console.log('Environment not valid: ' + err);
    process.exit(-1);
  });
}
