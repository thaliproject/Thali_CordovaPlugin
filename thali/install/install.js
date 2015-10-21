'use strict';
var exec = require('child_process').exec;
var path = require('path');
var https = require('https');
var unzip = require('unzip');
var Promise = require('lie');
var fs = require('fs-extra-promise');
var url = require('url');
var request = require('request');
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

function doesMagicDirectoryNamedExist(thaliDontCheckIn) {
  var magicFileLocation = path.join(thaliDontCheckIn, MAGIC_DIRECTORY_NAME_FOR_LOCAL_DEPLOYMENT);
  return fs.existsSync(magicFileLocation);
}

function fetchAndInstallJxCoreCordovaPlugin(baseDir, jxCoreVersionNumber) {
  var jxParentDir = path.join(baseDir, "jxcore", jxCoreVersionNumber);
  var jxCoreFileLocation = path.join(jxParentDir, "io.jxcore.node.jx");
  var currentInstalledVersion = path.join(baseDir, "jxcore", "installedVersion");

  return fs.ensureDirAsync(jxParentDir)
    .then(function() {
      if (fs.existsSync(currentInstalledVersion)) {
        var currentVersion = fs.readFileSync(currentInstalledVersion, "utf8");
        if (currentVersion != jxCoreVersionNumber) {
          return childProcessExecPromise('cordova plugin remove io.jxcore.node', baseDir)
            .then(function () {
              return Promise.resolve(true);
            });
        }

        return Promise.resolve(false);
      }

      return Promise.resolve(true);
    }).then(function(anythingToDo) {
      if (!anythingToDo) {
        return Promise.resolve(false);
      }

      // This is a hack to let us copy the jx package file from some local location
      // where we have a copy into this directory just in case local Internet is very slow
      if (anythingToDo && fs.existsSync(jxCoreFileLocation)) {
        return Promise.resolve(true);
      }

      return new Promise(function(resolve, reject) {
        var requestUrl = 'https://github.com/jxcore/jxcore-cordova-release/raw/master/' + jxCoreVersionNumber + '/io.jxcore.node.jx';
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
            console.log("Downloaded io.jxcore.node.jx");
            resolve(true);
          })
          .on('error', function(error) {
            console.log("Error downloading io.jxcore.node.jx");
            fs.unlink(jxCoreFileLocation)
              .then(function() {
                reject(error);
              }).catch(function(err) {
                console.log("Tried to delete the bad io.jxcore.node.jx file but failed - " + err);
                reject(error);
              });
          }));
      });
    }).then(function(neededDownload) {
      if (neededDownload) {
        console.log('Running jx against the file downloaded to: ' + jxCoreFileLocation);
        return childProcessExecPromise('jx io.jxcore.node.jx', jxParentDir)
          .then(function() {
            console.log('Adding io.jxcore.node Cordova plugin');
            return childProcessExecPromise('cordova plugin add ./io.jxcore.node/', jxParentDir);
          }).then(function() {
            return fs.writeFileAsync(currentInstalledVersion, jxCoreVersionNumber, 'utf8');
          }).catch(function (error) {
            console.log('Failed to process the downloaded io.jxcore.node.jx file');
            // Delete the "corrupted" file so that it doesn't interfere in subsequent
            // installation attempts.
            return new Promise(function (resolve, reject) {
              fs.unlink(jxCoreFileLocation)
                .then(function () {
                  // Always reject the above-created promise
                  // because we are in the case where unpackaging
                  // has failed and installation should not continue.
                  reject(error);
              });
            });
          });
      }

      return Promise.resolve();
    });
}

module.exports = function(callback) {
  //get the app root folder from app/www/jxcore/node_modules/thali
  var appRootDirectory = path.join(__dirname, '../../../../../');
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

  fetchAndInstallJxCoreCordovaPlugin(thaliDontCheckIn, jxCoreVersionNumber)
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
