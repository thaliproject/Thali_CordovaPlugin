//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root
//  for full license information.
//

'use strict';

var fs = require('fs-extra-promise');
var path = require('path');
var exec = require('./utils/child_process').exec;
var https = require('https');
var unzip = require('unzip');
var url = require('url');
var Promise = require('./utils/Promise');
var FILE_NOT_FOUND = 'ENOENT';

// If this file exists in the thaliDontCheckIn directory then
// we will copy the Cordova plugin from a sibling Thali_CordovaPlugin
// project to this Cordova project.
var MAGIC_DIRECTORY_NAME_FOR_LOCAL_DEPLOYMENT = 'localdev';

// Unfortunately the obvious library, request-promise, doesn't handle streams
// well so it would take the multi-megabyte ZIP response file and turn it into
// an in-memory string. So we use this instead.
function httpRequestPromise(method, urlObject) {
  if (method !== 'GET' && method !== 'HEAD') {
    return Promise.reject(new Error('We only support GET or HEAD requests'));
  }

  return new Promise(function (resolve, reject) {
    var httpsRequestOptions = {
      host: urlObject.host,
      method: method,
      path: urlObject.path,
      keepAlive: true
    };

    var req = https.request(httpsRequestOptions, function (res) {
      if (res.statusCode !== 200) {
        reject(new Error('Did not get 200 for ' + urlObject.href +
          ', instead got ' + res.statusCode));
        return;
      }

      resolve(res);
    })
    .on('error', function (e) {
      reject(new Error('Got error on ' + urlObject.href + ' - ' + e));
    });

    req.end();
  });
}

function getEtagFileLocation(depotName, branchName, directoryToInstallIn) {
  return path.join(directoryToInstallIn,
                   'etag-' + depotName + '-' + branchName);
}

function getEtagFromEtagFile(depotName, branchName, directoryToInstallIn) {
  var etagFileLocation =
    getEtagFileLocation(depotName, branchName, directoryToInstallIn);
  return fs.readFileAsync(etagFileLocation)
    .catch(function (err) {
      if (err.code !== FILE_NOT_FOUND) {
        return Promise.reject(err);
      } else {
        return Promise.resolve();
      }
    });
}

/**
 * This method is used to retrieve the release configuration data
 * stored in the releaseConfig.json
 *
 * @returns {Promise}
 */
function getReleaseConfig() {
  var configFileName = path.join(__dirname, '..', 'package.json');

  return fs.readFileAsync(configFileName, 'utf-8')
    .then(function (data) {
      var conf;
      try {
        conf = JSON.parse(data);
        if (conf && conf.thaliInstall) {
          return conf.thaliInstall;
        }
        return Promise.reject('Configuration error!');
      }
      catch (err) {
        return Promise.reject(new Error(err));
      }
    });
}

function returnEtagFromResponse(httpResponse) {
  // The etag value is returned with quotes but when we set the header it adds
  // its own quotes so we need to strip those quotes here
  return httpResponse && httpResponse.headers && httpResponse.headers.etag &&
    httpResponse.headers.etag.substring(1,
                                        httpResponse.headers.etag.length - 1);
}

function writeToEtagFile(depotName, branchName, directoryToInstallIn,
                         httpResponse) {
  var etag = returnEtagFromResponse(httpResponse);

  if (etag == null) {
    return Promise.reject(
      new Error('Did not get ETag header, something is wrong because Github' +
        'always sends one!'));
  }

  var etagFileLocation =
    getEtagFileLocation(depotName, branchName, directoryToInstallIn);
  return fs.writeFileAsync(etagFileLocation, etag);
}

function getGitHubZipUrlObject(projectName, depotName, branchName) {
  return url.parse('https://codeload.github.com/' + projectName + '/' +
    depotName + '/zip/' + branchName);
}

/**
 * This method is a hack because I'm having trouble getting GitHub to respect
 * if-none-match headers. So instead I'm doing a HEAD request and manually
 * checking if the etags match.
 *
 * @param {string} projectName
 * @param {string} depotName
 * @param {string} branchName
 * @param {string} directoryToInstallIn
 * @returns {boolean}
 */
function doGitHubEtagsMatch(projectName, depotName, branchName,
                            directoryToInstallIn) {
  return getEtagFromEtagFile(depotName, branchName, directoryToInstallIn)
    .then(function (etagFromFile) {
      if (!etagFromFile) {
        return false;
      }

      return httpRequestPromise('HEAD',
        getGitHubZipUrlObject(projectName, depotName, branchName))
        .then(function (res) {
          var etagFromHeadRequest = returnEtagFromResponse(res);
          return etagFromFile === etagFromHeadRequest;
        });
    });
}

function createUnzippedDirectoryPath(depotName, branchName,
                                     directoryToInstallIn) {
  return path.join(directoryToInstallIn, depotName + '-' + branchName);
}

function createGitHubZipResponse(depotName, branchName, directoryToInstallIn,
                                 directoryUpdated) {
  return {
    unzipedDirectory: createUnzippedDirectoryPath(depotName, branchName,
                                                  directoryToInstallIn),
    directoryUpdated: directoryUpdated
  };
}

function installGitHubZip(projectName, depotName, branchName,
                          directoryToInstallIn) {
  var gitHubZipUrlObject = getGitHubZipUrlObject(projectName, depotName,
                                                 branchName);

  return doGitHubEtagsMatch(projectName, depotName, branchName,
                            directoryToInstallIn)
    .then(function (doTheEtagsMatch) {
      if (doTheEtagsMatch) {
        return createGitHubZipResponse(depotName, branchName,
                                       directoryToInstallIn, false);
      }
      console.log('Starting to download Thali Cordova plugin from: ' +
                  gitHubZipUrlObject.href);
      return httpRequestPromise('GET', gitHubZipUrlObject)
        .then(function (res) {
          return new Promise(function (resolve, reject) {
            res.pipe(unzip.Extract({ path: directoryToInstallIn}))
              .on('close', function () {
                resolve();
              })
              .on('error', function (e) {
                reject(new Error('Could not extract zip file from ' +
                                 gitHubZipUrlObject.href + ', error was ' + e));
              });
          })
          .then(function () {
              return writeToEtagFile(depotName, branchName,
                                     directoryToInstallIn, res);
            })
            .then(function () {
              return createGitHubZipResponse(depotName, branchName,
                                             directoryToInstallIn, true);
            });
        });
    });
}

function uninstallPluginsIfNecessary(weAddedPluginsFile, appRootDirectory) {
  return fs.readFileAsync(weAddedPluginsFile).catch(function (err) {
    if (err) {
      if (err.code === FILE_NOT_FOUND) {
        return Promise.resolve(false);
      }
      return Promise.reject(err);
    }
    return Promise.resolve(true);
  })
  .then(function (doWeNeedToUninstall) {
    if (!doWeNeedToUninstall) {
      return Promise.resolve();
    }
    console.log('Trying to remove previously installed Thali Cordova plugin');
    var pluginRemoveCommand = 'cordova plugin remove org.thaliproject.p2p';
    return exec(pluginRemoveCommand, { cwd: appRootDirectory })
      .catch(function (error) {
        console.log('Ignoring a non-critical error: ' + error);
        // Resolve the promise even if plugin removal fails, because it is
        // possible that the user has removed the plugin outside of this install
        // script, but there is still the left-over file that says this script has
        // added the plugins.
        return Promise.resolve();
      });
  });
}

/**
 * This will copy the contents of a Thali_CordovaPlugin local depot to the right
 * directory in the current Cordova project so it will be installed. This is
 * used for local development only.
 *
 * @param {string} appRootDirectory
 * @param {string} thaliDontCheckIn
 * @param {string} depotName
 * @param {string} branchName
 * @returns {Promise<Object|Error>}
 */
function copyDevelopmentThaliCordovaPluginToProject(appRootDirectory,
                                                    thaliDontCheckIn,
                                                    depotName,
                                                    branchName) {
  var targetDirectory = createUnzippedDirectoryPath(depotName, branchName,
                                                    thaliDontCheckIn);
  var sourceDirectory = path.join(
    appRootDirectory, '..', 'Thali_CordovaPlugin');

  return new Promise(function (resolve, reject) {
    fs.remove(targetDirectory, function (err) {
      if (err) {
        reject(new Error('copyDevelopmentThaliCordovaPluginToProject remove ' +
                         'failed with ' + err));
        return;
      }
      console.log('Copying files from ' + sourceDirectory + ' to ' +
                  targetDirectory);
      fs.copy(sourceDirectory, targetDirectory, function (err) {
        if (err) {
          reject(
            new Error('copyDevelopmentThaliCordovaPluginToProject failed with' +
                      err));
          return;
        }
        resolve(createGitHubZipResponse(depotName, branchName, thaliDontCheckIn,
                                        true));
      });
    });
  });
}

function doesMagicDirectoryNamedExist(thaliDontCheckIn) {
  var magicFileLocation = path.join(thaliDontCheckIn,
    MAGIC_DIRECTORY_NAME_FOR_LOCAL_DEPLOYMENT);
  return fs.existsSync(magicFileLocation);
}

function fetchAndInstallJxCoreCordovaPlugin(
  baseDir, jxCoreVersionNumber, jxCoreUrl) {

  console.log(
    'Trying to install jxcore-cordova version: ' + jxCoreVersionNumber);

  var jxcBin = path.join(__dirname, 'node_modules', 'jxc', 'bin', 'jxc.bin.js');
  var jxCommand = 'jx ' + jxcBin +
    ' install ' + jxCoreVersionNumber + ' --use-url ' + jxCoreUrl;

  return exec(jxCommand, { cwd: baseDir })
    .catch(function (error) {
      return Promise.reject('jxc install exited with error: ' + error);
    });
}

module.exports = function (callback, appRootDirectory) {
  // Get the app root as an argument or from app/www/jxcore/node_modules/thali.
  // Passing as argument can be leveraged in local development and testing
  // scenarios.
  appRootDirectory = appRootDirectory ||
                     path.join(__dirname, '..', '..', '..', '..', '..');
  var thaliDontCheckIn = path.join(appRootDirectory, 'thaliDontCheckIn' );

  var thaliProjectName, thaliDepotName, thaliBranchName, btconnectorlib2;

  getReleaseConfig(thaliDontCheckIn)
    .then(function (conf) {

      thaliProjectName = conf.thali.projectName;
      thaliDepotName = conf.thali.depotName;
      thaliBranchName = conf.thali.branchName;
      btconnectorlib2 = conf.btconnectorlib2;

      return fetchAndInstallJxCoreCordovaPlugin(
        appRootDirectory,
        conf['jxcore-cordova'],
        conf['jxcore-cordova-url']
      );
    })
    .then(function () {
      if (doesMagicDirectoryNamedExist(thaliDontCheckIn)) {
        return copyDevelopmentThaliCordovaPluginToProject(appRootDirectory,
                                                          thaliDontCheckIn,
                                                          thaliDepotName,
                                                          thaliBranchName);
      } else {
        var errorMessage =
          'The magic for local deployment' +
          MAGIC_DIRECTORY_NAME_FOR_LOCAL_DEPLOYMENT +
          ' doesn\'t seem to exist' +
          ' currently the installation only supports local deployment.' +
          ' See README.md for the details.';

        return Promise.reject(new Error(errorMessage));

        // The lines below should be uncommented as soon as we do release
        //
        // return installGitHubZip(thaliProjectName, thaliDepotName,
        //                         thaliBranchName, thaliDontCheckIn);
      }
    })
    .then(function (thaliCordovaPluginUnZipResult) {
      // This step is used to prepare the gradle.properties file
      // containing the btconnectorlib2 version
      var projectDir = createUnzippedDirectoryPath(
        thaliDepotName, thaliBranchName, thaliDontCheckIn);
      var gradleFileName = path.join(
        projectDir, 'src', 'android', 'gradle.properties');

      return fs.writeFileAsync(gradleFileName,
        'btconnectorlib2Version=' + btconnectorlib2)
        .then(function () {
          return thaliCordovaPluginUnZipResult;
        });
    })
    .then(function (thaliCordovaPluginUnZipResult) {
      if (thaliCordovaPluginUnZipResult.directoryUpdated) {
        var weAddedPluginsFile = path.join(thaliDontCheckIn, 'weAddedPlugins');

        return uninstallPluginsIfNecessary(weAddedPluginsFile, appRootDirectory)
          .then(function () {
            console.log('Adding Thali Cordova plugin from: ' +
              thaliCordovaPluginUnZipResult.unzipedDirectory);

            return exec('cordova plugins add ' +
              thaliCordovaPluginUnZipResult.unzipedDirectory,
              { cwd: appRootDirectory });
          })
          .then(function () {
            return fs.writeFileAsync(weAddedPluginsFile, 'yes');
          });
      }
    })
    .then(function () {
      // Success
      callback();
    })
    .catch(function (error) {
      callback(error, null);
    });
};
