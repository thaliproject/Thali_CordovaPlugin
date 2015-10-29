'use strict';
var exec = require('child_process').exec;
var path = require('path');
var os = require('os');
var https = require('https');
var unzip = require('unzip');
var Promise = require('lie');
var fs = require('fs-extra-promise');
var url = require('url');
var request = require('request');
var scp = require('scp');
var FILE_NOT_FOUND = "ENOENT";
var MAGIC_DIRECTORY_NAME_FOR_LOCAL_DEPLOYMENT = "localdev"; // If this file exists in the thaliDontCheckIn directory then
// we will copy the Cordova plugin from a sibling Thali_CordovaPlugin
// project to this Cordova project.

// I tried child-process-promise but it failed without errors and I just don't
// have time to fight with it right now.
function childProcessExecPromise(command, currentWorkingDirectory) {
  return new Promise(function(resolve, reject) {
    exec(command, { cwd: currentWorkingDirectory }, function(error, stdout, stderr) {
      if (error) {
        reject(error);
      }
      resolve(stdout.toString());
    });
  })
}


// Unfortunately the obvious library, request-promise, doesn't handle streams
// well so it would take the multi-megabyte ZIP response file and turn it into
// an in-memory string. So we use this instead.
function httpRequestPromise(method, urlObject) {
  if (method != "GET" && method != "HEAD") {
    return Promise.reject(new Error("We only support GET or HEAD requests"));
  }

  return new Promise(function(resolve, reject) {
    var httpsRequestOptions = {
      host: urlObject.host,
      method: method,
      path: urlObject.path,
      keepAlive: true
    };

    var req = https.request(httpsRequestOptions, function(res) {
      if (res.statusCode != 200) {
        reject(new Error("Did not get 200 for " + urlObject.href + ", instead got " + res.statusCode));
        return;
      }

      resolve(res);
    }).on('error', function(e) {
      reject(new Error("Got error on " + urlObject.href + " - " + e));
    });

    req.end();
  });
}

function getEtagFileLocation(depotName, branchName, directoryToInstallIn) {
  return path.join(directoryToInstallIn, "etag-" + depotName + "-" + branchName);
}

function getEtagFromEtagFile(depotName, branchName, directoryToInstallIn) {
  var etagFileLocation = getEtagFileLocation(depotName, branchName, directoryToInstallIn);
  return fs.readFileAsync(etagFileLocation)
    .catch(function(err) {
      if (err.code != FILE_NOT_FOUND) {
        return Promise.reject(err);
      } else {
        return Promise.resolve();
      }
    });
}

function returnEtagFromResponse(httpResponse) {
  // The etag value is returned with quotes but when we set the header it adds its
  // own quotes so we need to strip those quotes here
  return httpResponse && httpResponse.headers && httpResponse.headers.etag &&
    httpResponse.headers.etag.substring(1, httpResponse.headers.etag.length - 1);
}

function writeToEtagFile(depotName, branchName, directoryToInstallIn, httpResponse) {
  var etag = returnEtagFromResponse(httpResponse);

  if (etag == null) {
    return Promise.reject(new Error("Did not get ETag header, something is wrong because Github always sends one!"));
  }

  var etagFileLocation = getEtagFileLocation(depotName, branchName, directoryToInstallIn);
  return fs.writeFileAsync(etagFileLocation, etag);
}

function getGitHubZipUrlObject(projectName, depotName, branchName) {
  return url.parse("https://codeload.github.com/" + projectName + "/" + depotName + "/zip/" + branchName);
}

/**
 * This method is a hack because I'm having trouble getting GitHub to respect if-none-match headers. So instead
 * I'm doing a HEAD request and manually checking if the etags match.
 */
function doGitHubEtagsMatch(projectName, depotName, branchName, directoryToInstallIn) {
  return getEtagFromEtagFile(depotName, branchName, directoryToInstallIn)
    .then(function(etagFromFile) {
      if (!etagFromFile) {
        return false;
      }

      return httpRequestPromise("HEAD",
        getGitHubZipUrlObject(projectName, depotName, branchName))
        .then(function(res) {
          var etagFromHeadRequest = returnEtagFromResponse(res);
          return etagFromFile == etagFromHeadRequest;
        });
    });
}

function createUnzippedDirectoryPath(depotName, branchName, directoryToInstallIn) {
  return path.join(directoryToInstallIn, depotName + "-" + branchName);
}

function createGitHubZipResponse(depotName, branchName, directoryToInstallIn, directoryUpdated) {
  return {
    unzipedDirectory: createUnzippedDirectoryPath(depotName, branchName, directoryToInstallIn),
    directoryUpdated: directoryUpdated
  };
}

function installGitHubZip(projectName, depotName, branchName, directoryToInstallIn) {
  var gitHubZipUrlObject = getGitHubZipUrlObject(projectName, depotName, branchName);

  return doGitHubEtagsMatch(projectName, depotName, branchName, directoryToInstallIn)
    .then(function(doTheEtagsMatch) {
      if (doTheEtagsMatch) {
        return createGitHubZipResponse(depotName, branchName, directoryToInstallIn, false);
      }
      console.log('Starting to download Thali Cordova plugin from: ' + gitHubZipUrlObject.href);
      return httpRequestPromise("GET", gitHubZipUrlObject)
        .then(function(res) {
          return new Promise(function(resolve, reject) {
            res.pipe(unzip.Extract({ path: directoryToInstallIn}))
              .on('close', function() {
                resolve();
              }).on('error', function(e) {
                reject(new Error("Could not extract zip file from " + gitHubZipUrlObject.href + ", error was " + e));
              });
          }).then(function() {
              return writeToEtagFile(depotName, branchName, directoryToInstallIn, res);
            }).then(function() {
              return createGitHubZipResponse(depotName, branchName, directoryToInstallIn, true);
            });
        });
    });
}

function uninstallPluginsIfNecessary(weAddedPluginsFile, appRootDirectory) {
  return fs.readFileAsync(weAddedPluginsFile).catch(function(err) {
    if (err) {
      if (err.code == FILE_NOT_FOUND) {
        return false;
      }

      return Promise.reject(err);
    }

    return true;
  }).then(function(doWeNeedToUninstall) {
    if (!doWeNeedToUninstall) {
      return;
    }
    console.log('Removing previously installed Thali Cordova plugin');
    return childProcessExecPromise('cordova plugin remove org.thaliproject.p2p', appRootDirectory)
  })
}

/**
 * This will copy the contents of a Thali_CordovaPlugin local depot to the right directory in the
 * current Cordova project so it will be installed. This is used for local development only.
 */
function copyDevelopmentThaliCordovaPluginToProject(appRootDirectory, thaliDontCheckIn, depotName, branchName) {
  var targetDirectory = createUnzippedDirectoryPath(depotName, branchName, thaliDontCheckIn);
  var sourceDirectory = path.join(appRootDirectory, "../Thali_CordovaPlugin");
  return new Promise(function(resolve, reject) {
    fs.remove(targetDirectory, function(err) {
      if (err) {
        reject(new Error("copyDevelopmentThaliCordovaPluginToProject remove failed with " + err));
        return;
      }
      console.log('Copying files from ' + sourceDirectory + ' to ' + targetDirectory);
      fs.copy(sourceDirectory, targetDirectory, function (err) {
        if (err) {
          reject(new Error("copyDevelopmentThaliCordovaPluginToProject failed with" + err));
          return;
        }
        resolve(createGitHubZipResponse(depotName, branchName, thaliDontCheckIn, true));
      });
    });
  });
}

/**
 * Functionality for handling the remote cache operations.
 */
(function () {
  // Will be set later on based on determining if remote cache is needed,
  // but can be used for testing purposes to force-enable remote cache.
  var remoteCacheEnabled = false;
  var remoteCacheUser = 'pi';
  var remoteCacheHost = '192.168.1.150';
  var remoteCacheRoot = '~';
  var remoteCacheShouldUpdate = false;

  module.remoteCacheGet = function (jxCorePluginId, jxCoreVersionNumber, jxCoreCacheFolder) {
    return new Promise(function(resolve, reject) {
      // A hack way to determine if we are running in CI environment where
      // we want to leverage the remote cache.
      exec('CIGIVEMEMYIP.sh', function (err, stdout, stderr) {
        if (err && !remoteCacheEnabled) {
          // We are not in CI so carry on.
          resolve();
          return;
        }
        // We are in CI so add flag to enable remote cache.
        remoteCacheEnabled = true;
        fs.mkdirsSync(jxCoreCacheFolder);
        console.log('We are in CI so trying to fetch the plugin via scp');
        scp.get({
          file: path.join(remoteCacheRoot, 'thali', 'jxcore', jxCoreVersionNumber, jxCorePluginId),
          user: remoteCacheUser,
          host: remoteCacheHost,
          path: jxCoreCacheFolder
        }, function (err, stdout, stderr) {
          if (err) {
            console.log('We were not able to fetch the plugin via scp');
            // If the plugin wasn't found from the remote cache, update a flag
            // to state that the cache should be updated after a successful download.
            remoteCacheShouldUpdate = true;
          } else {
            console.log('We fetched the plugin via scp');
          }
          resolve();
        });
      });
    });
  };

  module.remoteCacheSet = function (jxCoreCacheRoot) {
    return new Promise(function(resolve, reject) {
      if (remoteCacheEnabled && remoteCacheShouldUpdate) {
        console.log('Starting to update the remote cache');
        scp.send({
          file: path.join(jxCoreCacheRoot, 'thali'),
          user: remoteCacheUser,
          host: remoteCacheHost,
          path: remoteCacheRoot
        }, function (err, stdout, stderr) {
          if (err) {
            console.log('We tried to update the remove cache, but failed');
          } else {
            console.log('Successfully updated the remote cache');
          }
          resolve();
        });
      } else {
        // If we don't have to deal with the remote cache, just move on.
        resolve();
        return;
      }
    });
  };

  module.remoteCachePurge = function () {
    if (remoteCacheEnabled) {
      var sshConnection = 'ssh '+ remoteCacheUser + '@' + remoteCacheHost;
      var purgeCommand = '"rm -rf ' + path.join(remoteCacheRoot, 'thali') + '"';
      console.log('Purging the remote cache using command: ' + purgeCommand);
      return childProcessExecPromise(sshConnection + ' ' + purgeCommand, '.');
    } else {
      return Promise.resolve();
    }
  };
}());

function doesMagicDirectoryNamedExist(thaliDontCheckIn) {
  var magicFileLocation = path.join(thaliDontCheckIn, MAGIC_DIRECTORY_NAME_FOR_LOCAL_DEPLOYMENT);
  return fs.existsSync(magicFileLocation);
}

function fetchAndInstallJxCoreCordovaPlugin(baseDir, jxCoreVersionNumber) {
  var jxCorePluginId = 'io.jxcore.node';
  var jxCorePluginFileName = 'io.jxcore.node.jx';
  var jxCoreCacheRoot = os.tmpdir();
  var jxCoreCacheFolder = path.join(jxCoreCacheRoot, 'thali', 'jxcore', jxCoreVersionNumber);
  var jxCoreCachedPlugin = path.join(jxCoreCacheFolder, jxCorePluginId);
  var jxCoreFileLocation = path.join(jxCoreCacheFolder, jxCorePluginFileName);

  return childProcessExecPromise('cordova plugin remove ' + jxCorePluginId, baseDir)
    .then(function () {
      return Promise.resolve();
    })
    .catch(function () {
      // This shouldn't be considered an error scenario, because it meant Cordova
      // wan't able to remove a previously-installed plugin version, which is in
      // fact a typical scenario when Thali is installed onto a new app.
      return Promise.resolve();
    })
    .then(function() {
      return module.remoteCacheGet(jxCorePluginId, jxCoreVersionNumber, jxCoreCacheFolder);
    })
    .then(function() {
      // Check if the plugin is found from the local cache and use that instead
      // of downloading it, if found.
      if (fs.existsSync(jxCoreCachedPlugin)) {
        console.log('Using jxcore Cordova plugin from: ' + jxCoreCachedPlugin);
        return Promise.resolve();
      } else {
        fs.mkdirsSync(jxCoreCacheFolder);
      }

      return new Promise(function(resolve, reject) {
        var requestUrl = 'http://jxcordova.cloudapp.net/' + jxCoreVersionNumber + '/' + jxCorePluginFileName;
        var receivedData = 0;
        var contentLength = 0;
        var previousPercentageProgress = 0;
        console.log('Starting to download from ' + requestUrl);
        request(requestUrl)
          .on('response', function (response) {
            contentLength = response.headers['content-length'];
            console.log('Started download of content with length: ' + contentLength);
            console.log('Download progress: 0%');
          })
          .on('data', function (data) {
            receivedData += data.length;
            var currentPercentageProgress = parseInt(receivedData / contentLength * 100);
            if (currentPercentageProgress !== previousPercentageProgress && currentPercentageProgress % 20 === 0) {
              console.log('Download progress: ' + currentPercentageProgress + '%');
              previousPercentageProgress = currentPercentageProgress;
            }
          })
          .pipe(fs.createWriteStream(jxCoreFileLocation)
          .on('finish', function() {
            console.log('Downloaded ' + jxCorePluginFileName + ' to: ' + jxCoreFileLocation);
            console.log('Running jx against the file downloaded to: ' + jxCoreFileLocation);
            childProcessExecPromise('jx ' + jxCoreFileLocation, jxCoreCacheFolder)
              .then(function () {
                resolve();
              }).catch(function (error) {
                console.log('Failed to process the downloaded file');
                // Delete the "corrupted" files so that they don't interfere in subsequent
                // installation attempts.
                fs.removeAsync(jxCoreCacheFolder)
                  .then(function () {
                    // Always reject the above-created promise
                    // because we are in the case where unpackaging
                    // has failed and installation should not continue.
                    reject(error);
                  });
                });
          })
          .on('error', function(error) {
            console.log('Error downloading from: ' + requestUrl);
            fs.unlinkAsync(jxCoreFileLocation)
              .then(function() {
                reject(error);
              }).catch(function(err) {
                console.log('Tried to delete the bad ' + jxCorePluginFileName + ' file but failed with error: ' + err);
                reject(error);
              });
          }));
      });
    }).then(function() {
      var cordovaPluginFolder = path.join(jxCoreCacheFolder, jxCorePluginId);
      console.log('Adding Cordova plugin to app at: ' + baseDir);
      return childProcessExecPromise('cordova plugin add ' + cordovaPluginFolder, baseDir)
        .then(function () {
          return module.remoteCacheSet(jxCoreCacheRoot);
        })
        .catch(function (err) {
          console.log('Failed to add Cordova plugin from: ' + cordovaPluginFolder);
          // If adding the Cordova plugin fails, clean the local cache folder
          // and also purge the remote cache since failure to add the plugin indicates
          // that the value in the cache is somehow corrupted.
          // At the end, reject the promise to fail the entire installation, because
          // the plugin installed here is a mandatory dependency.
          return fs.removeAsync(jxCoreCacheFolder)
            .then(function () {
              return module.remoteCachePurge();
            })
            .then(function () {
              return Promise.reject(err);
            });
        });
    });
}

module.exports = function(callback, appRootDirectory) {
  // Get the app root as an argument or from app/www/jxcore/node_modules/thali.
  // Passing as argument can be leveraged in local development and testing scenarios.
  appRootDirectory = appRootDirectory || path.join(__dirname, '../../../../../');
  var thaliDontCheckIn = path.join(appRootDirectory, "thaliDontCheckIn" );
  var appScriptsFolder = path.join(appRootDirectory, "plugins/org.thaliproject.p2p/scripts");
  var jxcoreFolder = path.join(appRootDirectory, 'www/jxcore' );

  var jxCoreVersionNumber = "0.0.7";

  var thaliProjectName = "thaliproject";
  var thaliDepotName = "Thali_CordovaPlugin";
  var thaliBranchName = "master";

  if (!fs.existsSync(jxcoreFolder)) {
    var jxcoreFolderNotFoundError = 'Could not locate JXCore folder. Exiting the thali plugin installation..';
    console.log(jxcoreFolderNotFoundError);
    callback(new Error(jxcoreFolderNotFoundError), null);
    return;
  }

  fetchAndInstallJxCoreCordovaPlugin(appRootDirectory, jxCoreVersionNumber)
    .then(function () {
      if (doesMagicDirectoryNamedExist(thaliDontCheckIn)) {
        return copyDevelopmentThaliCordovaPluginToProject(appRootDirectory, thaliDontCheckIn, thaliDepotName, thaliBranchName);
      } else {
        return installGitHubZip(thaliProjectName, thaliDepotName, thaliBranchName, thaliDontCheckIn);
      }
    })
    .then(function(thaliCordovaPluginUnZipResult) {
      if (thaliCordovaPluginUnZipResult.directoryUpdated) {
        var weAddedPluginsFile = path.join(thaliDontCheckIn, "weAddedPlugins");
        return uninstallPluginsIfNecessary(weAddedPluginsFile, appRootDirectory)
          .then(function() {
            console.log('Adding Thali Cordova plugin from: ' + thaliCordovaPluginUnZipResult.unzipedDirectory);
            return childProcessExecPromise('cordova plugins add ' + thaliCordovaPluginUnZipResult.unzipedDirectory,
              appRootDirectory);
          }).then(function() {
            // The step below is required, because the Android after prepare Cordova hook
            // depends on external node modules that need to be installed.
            console.log('Running jx npm install in: ' + appScriptsFolder);
            return childProcessExecPromise('jx npm install --autoremove "*.gz"', appScriptsFolder);
          }).then(function() {
            return fs.writeFileAsync(weAddedPluginsFile, "yes");
          });
      }
    })
    .then(function() {
      // Success
      callback();
    })
    .catch(function(error) {
      callback(error, null);
    });
};
