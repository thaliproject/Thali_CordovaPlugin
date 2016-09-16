'use strict';

/* jshint esnext: true */

var exec = require('child-process-promise').exec;
var path = require('path');
var fs = require('fs-extra-promise');

var androidBrewBasePath = '/usr/local/Cellar/android-sdk';

var versions =
{
  xcode: '7.3.1',
  osX: '10.11.6',
  node: '6.3.1',
  npm: '3.10.3',
  brew: '0.9.9',
  ruby: '2.3.0p0',
  wget: '1.18',
  openssl: '0.9.8zh',
  jxcore: '0.3.1.4',
  androidSDKTools: '24.4.1_1',
  androidBuildTools: '23.0.3',
  androidPlatform: '23',
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
  git: '2.7.4'
};

module.exports.versions = versions;

function execAndCheck(command, checkStdErr, validator) {
  return exec(command)
    .then(function (result) {
      var output = checkStdErr ? result.stderr : result.stdout;
      return validator(output) ? true :
        Promise.reject('Command: ' + command + ' failed');
    });
}

function versionResultGenerator(commandAndResult, validator) {
  if (typeof commandAndResult.versionCheck === 'function') {
    return new Promise(function (resolve, reject) {
      return validator(commandAndResult.versionCheck()) ?
        resolve(true) : reject(false);
    });
  }
  return execAndCheck(commandAndResult.versionCheck,
                      commandAndResult.checkStdErr, validator);
}

var commandsAndResults =
  {
    xcode: {
      versionCheck: 'xcodebuild -version',
      versionResult: (objectName) => versionResultGenerator(
        commandsAndResults[objectName],
        (result) => result.startsWith('Xcode '+ versions[objectName] + '\n'))
    },
    osX: {
      versionCheck: 'sw_vers -productVersion',
      versionResult: (objectName) => versionResultGenerator(
        commandsAndResults[objectName],
        (result) => versions[objectName] === result.trim())
    },
    node: {
      versionCheck: 'node -v',
      versionResult: (objectName) => versionResultGenerator(
        commandsAndResults[objectName],
        (result) =>  'v' + versions[objectName] === result.trim())
    },
    npm: {
      versionCheck: 'npm -v',
      versionResult: (objectName) => versionResultGenerator(
        commandsAndResults[objectName],
        (result) =>  versions[objectName] === result.trim())
    },
    brew: {
      versionCheck: 'brew -v',
      versionResult: (objectName) => versionResultGenerator(
        commandsAndResults[objectName],
        (result) =>  result.startsWith('Homebrew ' + versions[objectName] +
                      ' '))
    },
    ruby: {
      versionCheck: 'ruby -v',
      versionResult: (objectName) => versionResultGenerator(
        commandsAndResults[objectName],
        (result) =>  result.startsWith('ruby ' + versions[objectName] + ' '))
    },
    wget: {
      versionCheck: 'wget -V',
      versionResult: (objectName) => versionResultGenerator(
        commandsAndResults[objectName],
        (result) =>  result.startsWith('GNU Wget ' + versions[objectName] +
          ' '))
    },
    openssl: {
      versionCheck: 'openssl version',
      versionResult: (objectName) => versionResultGenerator(
        commandsAndResults[objectName],
        (result) =>  result.startsWith('OpenSSL ' + versions[objectName] + ' '))
    },
    jxcore: {
      versionCheck: 'jx -jxv',
      versionResult: (objectName) => versionResultGenerator(
        commandsAndResults[objectName],
        (result) =>  'v' + versions[objectName] === result.trim())
    },
    androidSDKTools: {
      versionCheck: () => fs.readdirSync(androidBrewBasePath),
      versionResult: (objectName) => versionResultGenerator(
        commandsAndResults[objectName],
        (result) =>  result.indexOf(versions[objectName]) !== -1)
    },
    androidBuildTools: {
      versionCheck: () => fs.readdirSync(path.join(androidSdkVersionPath(),
                                'build-tools')),
      versionResult: (objectName) => versionResultGenerator(
        commandsAndResults[objectName],
        (result) =>  result.indexOf(versions[objectName]) !== -1)
    },
    androidPlatform: {
      versionCheck: () => fs.readdirSync(path.join(androidSdkVersionPath(),
                                          'platforms')),
      versionResult: (objectName) => versionResultGenerator(
        commandsAndResults[objectName],
        (result) =>  result.indexOf('android-'+versions[objectName]) !== -1)
    },
    cordovaAndroidSetMinSDK: {
      versionCheck: 'echo $ORG_GRADLE_PROJECT_cdvMinSdkVersion',
      versionResult: (objectName) => versionResultGenerator(
        commandsAndResults[objectName],
        (result) =>  versions[objectName] === result.trim())
    },
    cordovaAndroidSetBuildToolsVersion: {
      versionCheck: 'echo $ORG_GRADLE_PROJECT_cdvBuildToolsVersion',
      versionResult: (objectName) => versionResultGenerator(
        commandsAndResults[objectName],
        (result) =>  versions[objectName] === result.trim())
    },
    cordovaAndroidSetCompileSdkVersion: {
      versionCheck: 'echo $ORG_GRADLE_PROJECT_cdvCompileSdkVersion',
      versionResult: (objectName) => versionResultGenerator(
        commandsAndResults[objectName],
        (result) =>  versions[objectName] === result.trim())
    },
    AndroidHome: {
      versionCheck: 'echo $ANDROID_HOME',
      versionResult: (objectName) => versionResultGenerator(
        commandsAndResults[objectName],
        (result) =>  versions[objectName] === result.trim())
    },
    python: {
      versionCheck: 'python -V',
      checkStdErr: true, // http://bugs.python.org/issue28160 - fixed in 3.4
      versionResult: (objectName) => versionResultGenerator(
        commandsAndResults[objectName],
        (result) =>  'Python ' + versions[objectName] === result.trim())
    },
    cordova: {
      versionCheck: 'cordova -v',
      versionResult: (objectName) => versionResultGenerator(
        commandsAndResults[objectName],
        (result) =>  versions[objectName] === result.trim())
    },
    java: {
      versionCheck: 'java -version',
      checkStdErr: true, // http://bugs.java.com/bugdatabase/view_bug.do?bug_id=JDK-8166116
      versionResult: (objectName) => versionResultGenerator(
        commandsAndResults[objectName],
        (result) =>  result.startsWith('java version "' + versions[objectName] +
          '"\n'))
    },
    git: {
      versionCheck: 'git --version',
      versionResult: (objectName) => versionResultGenerator(
        commandsAndResults[objectName],
        (result) =>  result.startsWith('git version ' + versions[objectName] +
          ' '))
    }
  };

function androidSdkVersionPath() {
  return path.join(androidBrewBasePath,
                    versions.androidSDKTools);
}

function processCommandsAndResults(commandsAndResults) {
  var promises = [];
  Object.getOwnPropertyNames(commandsAndResults).forEach(function (name) {
    promises.push(commandsAndResults[name].versionResult(name));
  });
  return Promise.all(promises);
}

// Detects if we were called from the command line
if (require.main === module) {
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
