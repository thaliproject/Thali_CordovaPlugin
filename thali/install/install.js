'use strict';
var exec = require('child_process').exec;
var path = require('path');
var https = require('https');
var unzip = require('unzip');
var Promise = require('lie');
var fs = require('fs-extra-promise');
var url = require('url');
var fileNotFoundCode = "ENOENT";
var magicDirectoryNameToDoLocalDevelopment = "localdev"; // If this file exists in the thaliDontCheckIn directory then
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
           resolve();
        });
    })
}


// Unfortunately the obvious library, request-promise, doesn't handle streams
// well so it would take the multi-megabyte ZIP response file and turn it into
// an in-memory string. So we use this instead.
function httpRequestPromise(method, urlObject) {
    if (method != "GET" && method != "HEAD") {
        return Promise.reject("We only support GET or HEAD requests");
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
                reject("Did not get 200 for " + urlObject.href + ", instead got " + res.statusCode);
                return;
            }
            
            resolve(res);
        }).on('error', function(e) {
            reject("Got error on " + urlObject.href + " - " + e);
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
        if (err.code != fileNotFoundCode) {
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
        return Promise.reject("Did not get ETag header, something is wrong because Github always sends one!");
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

function createUnzipedDirectoryPath(depotName, branchName, directoryToInstallIn) {
    return path.join(directoryToInstallIn, depotName + "-" + branchName);
}

function createGitHubZipResponse(depotName, branchName, directoryToInstallIn, directoryUpdated) {
    return {
        unzipedDirectory: createUnzipedDirectoryPath(depotName, branchName, directoryToInstallIn),
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
        return httpRequestPromise("GET", gitHubZipUrlObject)
        .then(function(res) {
            return new Promise(function(resolve, reject) {
                res.pipe(unzip.Extract({ path: directoryToInstallIn}))
                .on('close', function() {
                    resolve();
                }).on('error', function(e) {
                   reject("Could not extract zip file " + gitHubZipUrlObject.href + ", error was " + e); 
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
            if (err.code == fileNotFoundCode) {
                return false;
            }
            
            return Promise.reject(err);
        }
        
        return true;
    }).then(function(doWeNeedToUninstall) {
        if (!doWeNeedToUninstall) {
            return;
        }
        
        return childProcessExecPromise('cordova plugin remove org.thaliproject.p2p', appRootDirectory)
    })
}

/**
 * This will copy the contents of a Thali_CordovaPlugin local depot to the right directory in the
 * current Cordova project so it will be installed. This is used for local development only.
 */
function copyDevelopmentThaliCordovaPluginToProject(appRootDirectory, thaliDontCheckIn, depotName, branchName) {
    var targetDirectory = createUnzipedDirectoryPath(depotName, branchName, thaliDontCheckIn);
    var sourceDirectory = path.join(appRootDirectory, "../Thali_CordovaPlugin");
    return new Promise(function(resolve, reject) {
        fs.remove(targetDirectory, function(err) {
            if (err) {
                reject("copyDevelopmentThaliCordovaPluginToProject remove failed with " + err);
                return;
            }
           fs.copy(sourceDirectory, targetDirectory, function (err) {
               if (err) {
                   reject("copyDevelopmentThaliCordovaPluginToProject failed with" + err);
                   return;
               }
               resolve(createGitHubZipResponse(depotName, branchName, thaliDontCheckIn, true));
           }); 
        });
    });
}

function doesMagicDirectoryNamedExist(thaliDontCheckIn) {
    var magicFileLocation = path.join(thaliDontCheckIn, magicDirectoryNameToDoLocalDevelopment);
    return fs.existsSync(magicFileLocation);
}

module.exports = function(callBack) {
   //get the app root folder from app/www/jxcore/node_modules/thali
    var appRootDirectory = path.join(__dirname, '../../../../../');
    var thaliDontCheckIn = path.join(appRootDirectory, "thaliDontCheckIn" );
    var appScriptsFolder = path.join(appRootDirectory, "plugins/org.thaliproject.p2p/scripts");
    var jxcoreFolder = path.join(appRootDirectory, 'www/jxcore' );

    if(!(path.basename(jxcoreFolder) == 'jxcore')) {
        callBack('Could not locate JXCore folder. Exiting the thali plugin installation..', null);
    }
    
    var thaliProjectName = "thaliproject";
    var thaliDepotName = "Thali_CordovaPlugin";
    var thaliBranchName = "story_0";
    var getThaliCordovaPluginZip = 
        doesMagicDirectoryNamedExist(thaliDontCheckIn) ?
            copyDevelopmentThaliCordovaPluginToProject(appRootDirectory, thaliDontCheckIn, thaliDepotName, thaliBranchName) :
            installGitHubZip(thaliProjectName, thaliDepotName, thaliBranchName, thaliDontCheckIn);

    getThaliCordovaPluginZip
    .then(function(thaliCordovaPluginUnZipResult) {      
        if (thaliCordovaPluginUnZipResult.directoryUpdated) {
            var weAddedPluginsFile = path.join(thaliDontCheckIn, "weAddedPlugins");
            return uninstallPluginsIfNecessary(weAddedPluginsFile, appRootDirectory)
            .then(function() {
                return childProcessExecPromise('cordova plugin add ' + thaliCordovaPluginUnZipResult.unzipedDirectory, appRootDirectory);   
            }).then(function() {
                return childProcessExecPromise('jx npm install', appScriptsFolder);       
            }).then(function() {
                return fs.writeFileAsync(weAddedPluginsFile, "yes");
            });
        }
    }).then(function() {
        callBack(null, null);
    }).catch(function(error) {
        callBack(error, null);
    });     
};
