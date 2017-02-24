'use strict';

/* jshint esnext: true */

const exec = require('child-process-promise').exec;
const path = require('path');
const fs = require('fs-extra-promise');
const thaliConfig = require('../package.json');
const os = require('os');
const http = require('http');
const url = require('url');
const assert = require('assert');

const versions =
{
  xcode: '8.2.1',
  xcodeCommandLineTools: ' ',
  macOS: '10.12.3',
  node: '6.9.1',
  npm: '3.10.8',
  brew: '1.1.',
  ruby: '2.3.0p0',
  wget: '1.18',
  jxcore: '0.3.1.8',
  androidHome: ' ',
  androidBuildTools: thaliConfig.thaliInstall.androidConfig.buildToolsVersion,
  androidPlatform: thaliConfig.thaliInstall.androidConfig.compileSdkVersion,
  // We don't have an easy way to identify the version of the support libraries
  // we have but if they were installed recently enough then they will have
  // what we need.
  androidSupportLibraries: '41.0.0',
  python: '2.7.10',
  cordova: '6.4.0',
  java: '1.8.0_102',
  git: '2.10.0',
  swiftlint: '0.16.1',
  carthage: '0.19.1',
  sinopiaNode: ' ',
  sinopiaJxCore: ' '
};

module.exports.versions = versions;

function sinopiaVersionCheck(sinopiaUrl) {
  return new Promise((resolve, reject) => {
    var parsedUrl = url.parse(sinopiaUrl);
    if (parsedUrl.protocol !== 'http:') {
      return Promise.reject();
    }
    var testThaliUrl =
      sinopiaUrl + (sinopiaUrl.endsWith('/') ? '' : '/') + 'thali';
    http.get(testThaliUrl, (res) => {
      let result = '';
      res.on('data', (chunk) => result += chunk);
      res.on('end', () => {
        try {
          var thaliResponse = JSON.parse(result);
          thaliResponse.name === 'thali' ? resolve() : reject();
        } catch (e) {
          reject(e);
        }
      });
      res.on('error', (err) => reject(err));
    });
  });
}

function boolToPromise(result) {
  return result ? Promise.resolve() : Promise.reject();
}

const commandsAndResults =
{
  xcode: {
    platform: ['darwin'],
    versionCheck: 'xcodebuild -version',
    versionValidate:
      (result, version) =>
        boolToPromise(result.startsWith('Xcode '+ version + '\n'))
  },
  xcodeCommandLineTools: {
    platform: ['darwin'],
    // I couldn't find any reliable way to validate which versions of the
    // tools are installed. The best I could do was find out which directory
    // they are supposed to be in. I tried http://stackoverflow.com/questions/15371925/how-to-check-if-command-line-tools-is-installed
    // and xcode-select -p returns a directory inside of XCode and none of
    // the pkgutil commands worked properly on my machine.
    // Also note that in some circumstances this directory can also contain
    // a subdirectory called SDKs. It's not clear if it's always there so we
    // don't check for it.
    versionCheck: () => fs.readdirAsync('/Library/Developer/CommandLineTools'),
    versionValidate:
      (result) => boolToPromise(result && result.length >= 2 &&
                    result.indexOf('Library') !== -1 &&
                    result.indexOf('usr') !== -1)
  },
  macOS: {
    platform: ['darwin'],
    versionCheck: 'sw_vers -productVersion',
    versionValidate:
      (result, version) => boolToPromise(version === result.trim())
  },
  node: {
    versionCheck: 'node -v',
    versionValidate:
      (result, version) => boolToPromise('v' + version === result.trim())
  },
  npm: {
    versionCheck: 'npm -v',
    versionValidate:
      (result, version) => boolToPromise(version === result.trim())
  },
  brew: {
    platform: ['darwin'],
    versionCheck: 'brew -v',
    versionValidate:
      (result, version) =>
        boolToPromise(result.startsWith('Homebrew ' + version))
  },
  ruby: {
    platform: ['darwin'],
    versionCheck: 'ruby -v',
    versionValidate:
      (result, version) =>
        boolToPromise(result.startsWith('ruby ' + version + ' '))
  },
  wget: {
    versionCheck: 'wget -V',
    versionValidate:
      (result, version) =>
        boolToPromise(result.startsWith('GNU Wget ' + version + ' '))
  },
  jxcore: {
    versionCheck: 'jx -jxv',
    versionValidate:
      (result, version) => boolToPromise('v' + version === result.trim())
  },
  androidHome: {
    versionCheck: () => process.env.ANDROID_HOME,
    versionValidate:
      (result) => {
        if (result) {
          return fs.readdirAsync(result);
        } else {
          return Promise.reject();
        }
      }
  },
  androidBuildTools: {
    versionCheck: () => fs.readdirAsync(path.join(process.env.ANDROID_HOME,
      'build-tools')),
    versionValidate:
      (result, version) => boolToPromise(result.indexOf(version) !== -1)
  },
  androidPlatform: {
    versionCheck: () => fs.readdirAsync(path.join(process.env.ANDROID_HOME,
      'platforms')),
    versionValidate:
      (result, version) => boolToPromise(result.indexOf(version) !== -1)
  },
  androidSupportLibraries: {
    versionCheck: () => {
      const sourcePropertiesLocation =
        path.join(process.env.ANDROID_HOME,
          'extras/android/m2repository/source.properties');
      return fs.readFileAsync(sourcePropertiesLocation, 'utf8')
        .then((sourcePropertiesFileContents) => {
          const regEx =
            sourcePropertiesFileContents.match(/^Pkg\.Revision=(.*)$/m);
          if (!regEx[1]) {
            return Promise.reject();
          }
          return Promise.resolve(regEx[1]);
        });
    },
    versionValidate:
      (result, version) => boolToPromise(version === result.trim())
  },
  python: {
    versionCheck: 'python -V',
    checkStdErr: true, // http://bugs.python.org/issue28160 - fixed in 3.4
    versionValidate:
      (result, version) => boolToPromise('Python ' + version === result.trim())
  },
  cordova: {
    versionCheck: 'cordova -v',
    versionValidate:
      (result, version) => boolToPromise(version === result.trim())
  },
  java: {
    versionCheck: 'java -version',
    checkStdErr: true, // http://bugs.java.com/bugdatabase/view_bug.do?bug_id=JDK-8166116
    versionValidate:
      (result, version) => boolToPromise(result.startsWith('java version "' +
                                          version + '"\n'))
  },
  git: {
    versionCheck: 'git --version',
    versionValidate:
      (result, version) => boolToPromise(
                                    'git version ' + version === result.trim())
  },
  swiftlint: {
    platform: ['darwin'],
    versionCheck: 'swiftlint version',
    versionValidate:
      (result, version) => boolToPromise(version === result.trim())
  },
  carthage: {
    platform: ['darwin'],
    versionCheck: 'carthage version',
    versionValidate:
      (result, version) => boolToPromise(version === result.trim())
  },
  sinopiaNode: {
    versionCheck: 'npm get registry',
    versionValidate:
      (result) => sinopiaVersionCheck(result.trim())
  },
  sinopiaJxCore: {
    // The first time jx npm is run it can do an install, to simplify things
    // we just call it twice so the second call will be normal and give us the
    // url
    versionCheck: 'jx npm get registry > /dev/null && jx npm get registry',
    versionValidate:
      (result) => sinopiaVersionCheck(result.trim())
  }

};


function execAndCheck(command, checkStdErr, version, validator) {
  return exec(command)
    .then((result) => {
      const output = checkStdErr ? result.stderr : result.stdout;
      return validator(output, version);
    })
    .then(() => Promise.resolve(true))
    .catch(() => Promise.reject(new Error('Command: ' + command + ' failed')));
}

function promiseTry(fn) {
  try {
    return Promise.resolve(fn());
  } catch (error) {
    return Promise.reject(error);
  }
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
  if (commandAndResult.platform &&
      !commandAndResult.platform.includes(os.platform()))
  {
    return Promise.reject(new Error('Requested object is not supported on ' +
      'this platform'));
  }
  if (typeof commandAndResult.versionCheck === 'function') {
    return promiseTry(commandAndResult.versionCheck)
      .catch(() =>
        Promise.reject(new Error('Version Check failed on ' + objectName)))
      .then((versionCheckResult) =>
        commandAndResult.versionValidate(versionCheckResult, desiredVersion))
      .then(() => Promise.resolve(true))
      .catch(() => Promise.reject(
                        new Error('Version not installed of ' + objectName)));
  }
  return execAndCheck(commandAndResult.versionCheck,
                      commandAndResult.checkStdErr,
                      desiredVersion,
                      commandAndResult.versionValidate);
}

module.exports.checkVersion = checkVersion;

function processCommandsAndResults(commandsAndResults) {
  let passed = true;
  let errorMessage = '';
  let runningPromise = Object.getOwnPropertyNames(commandsAndResults)
        .reduce((runningPromise, name) => {
          if (commandsAndResults[name].platform &&
            !commandsAndResults[name].platform.includes(os.platform())) {
            return runningPromise;
          }
          return runningPromise.then(() =>
            checkVersion(name)
              .catch((err) => {
                passed = false;
                errorMessage += '\n' + 'Object Name: ' + name + ' : ' + err;
                return Promise.resolve();
              }));
        }, Promise.resolve());
  return runningPromise
    .then(() => passed ? Promise.resolve() : Promise.reject(errorMessage));
}

// Detects if we were called from the command line
if (require.main === module) {
  if (os.platform() !== 'darwin') {
    console.log('WARNING: WE ONLY SUPPORT OS/X AS A BUILD PLATFORM, USING ANY' +
      'OTHER PLATFORM IS NOT OFFICIALLY SUPPORTED. WE STILL CHECK A FEW ' +
      'THINGS BUT YOU ARE REALLY ON YOUR OWN');
  }
  assert.deepStrictEqual(Object.getOwnPropertyNames(versions),
                         Object.getOwnPropertyNames(commandsAndResults),
                         'Versions and commandsAndResults keys must be equal');
  processCommandsAndResults(commandsAndResults)
    .then(() => {
      // Good to clean this up in case we have changed the version of jxcore
      const home = process.env.HOME;
      const jx = path.join(home, '.jx');
      const jxc = path.join(home, '.jxc');
      const nodeGyp = path.join(home, '.node-gyp');
      return Promise.all([fs.removeAsync(jx), fs.removeAsync(jxc),
                         fs.removeAsync(nodeGyp)]);
    })
    .then(() => {
      console.log('Environment validated');
      process.exit(0);
    })
    .catch((err) => {
      console.log('Environment not valid: ' + err);
      process.exit(-1);
    });
}
