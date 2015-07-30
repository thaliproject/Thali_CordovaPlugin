/// <reference path="../typings/node/node.d.ts"/>
'use strict';
var exec = require('child_process').exec;
var path = require('path');
var https = require('https')
var unzip = require('unzip');
var Promise = require('lie');
var fs = require('fs');
var url = require('url');
var currentFolder = process.cwd();

//get the app root folder from app/www/jxcore/node_modules/thali
var appRootDirectory = path.join(__dirname, '../../../../');
var thaliDontCheckIn = path.join(appRootDirectory, "thaliDontCheckIn" );

function readFilePromise(filename) {
    return new Promise(function(resolve, reject) {
       fs.readFile(filename, "utf8", function(err, data) {
          if (err) {
              reject(err);
          } else {
              resolve(data);
          } 
       });
    });
}

function writeFilePromise(filename, data) {
    return new Promise(function(resolve, reject) {
        fs.writeFile(filename, data, "utf8", function(err) {
            if (err) {
                reject(err);
            } else {
                resolve();
            }
        })
    });
}

function execPromise(command, cwd) {
    return new Promise(function(resolve, reject) {
        exec(command,
            {cwd: cwd},
            function (error, stdout, stderr) {
                if (error) {
                    reject("command " + command + " failed with - " + error);
                }          
                resolve(true);      
            });
    });                    
}

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
    return readFilePromise(etagFileLocation)
    .catch(function(err) {
       var fileNotFoundCode = "ENOENT";
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
    return writeFilePromise(etagFileLocation, etag);
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
        
        return httpRequestPromise("HEAD", getGitHubZipUrlObject(projectName, depotName, branchName))
        .then(function(res) {
            var etagFromHeadRequest = returnEtagFromResponse(res);
            return etagFromFile == etagFromHeadRequest;
        });
    });
}

function createGitHubZipResponse(depotName, branchName, directoryToInstallIn, directoryUpdated) {
    return {
        unzipedDirectory: path.join(directoryToInstallIn, depotName + "-" + branchName),
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

function updatePluginXMLJXCoreLocation(thaliCordovaPluginDirectory, jxCoreDirectory) {
    var pluginFileLocation = path.join(thaliCordovaPluginDirectory, "plugin.xml");
    return readFilePromise(pluginFileLocation).then(function(data) {
        // BUBUG: This is fragile, a single character change and the replace won't work! We should really do a
        // proper XML parse and output.
        var replaceDependency = 
            data.replace("<dependency id=\"io.jxcore.node\" url=\"https://github.com/jxcore/jxcore-cordova\" />",
                         "<dependency id=\"io.jxcore.node\" subdir=\"" + jxCoreDirectory + "\" />");
       return writeFilePromise(pluginFileLocation, replaceDependency);        
    }).then(function() {
        return thaliCordovaPluginDirectory;
    });
}

function uninstallPluginsIfNecessary(weAddedPluginsFile) {
    return readFilePromise(weAddedPluginsFile).catch(function(err) {
        var fileNotFoundCode = "ENOENT";
        if (err.code != fileNotFoundCode) {
            return Promise.reject(err);
        } else {
            return false;
        }   
    }).then(function(doWeNeedToUninstall) {
        if (!doWeNeedToUninstall) {
            return;
        }
        
        return execPromise('cordova plugin remove org.thaliproject.p2p', appRootDirectory);
    })
}

var jxcoreFolder = path.join(__dirname, '../../' );
if(!(path.basename(jxcoreFolder) == 'jxcore')) {
    console.log('Could not locate JXCore folder. Exiting the thali plugin installation..');
    process.exit(1);
}

var thaliProjectName = "thaliproject";
var thaliDepotName = "Thali_CordovaPlugin";
var thaliBranchName = "story_0_yarong";
var getThaliCordovaPluginZip = installGitHubZip(thaliProjectName, thaliDepotName, thaliBranchName, thaliDontCheckIn);

var jxCoreProjectName = "jxcore";
var jxCoreDepotName = "jxcore-cordova";
var jxCoreBranchName = "0.0.3-dev";
var getJxCoreCordovaPluginZip = installGitHubZip(jxCoreProjectName, jxCoreDepotName, jxCoreBranchName, thaliDontCheckIn);

Promise.all([getThaliCordovaPluginZip, getJxCoreCordovaPluginZip])
.then(function(results) {
    var thaliCordovaPluginUnZipResult = results[0];
    var jxCoreUnZipResult = results[1];
    
    if (thaliCordovaPluginUnZipResult.directoryUpdated || jxCoreUnZipResult.directoryUpdated) {
        var weAddedPluginsFile = path.join(thaliDontCheckIn, "weAddedPlugins");
        return uninstallPluginsIfNecessary(weAddedPluginsFile)
        .then(function() {
            return updatePluginXMLJXCoreLocation(thaliCordovaPluginUnZipResult.unzipedDirectory,
                                                jxCoreUnZipResult.unzipedDirectory);    
        }).then(function(thaliCordovaPluginDirectory) {
            return execPromise('cordova plugin add ' + thaliCordovaPluginDirectory, appRootDirectory);            
        }).then(function() {
            return writeFilePromise(weAddedPluginsFile, "yes");
        });
    }
}).then(function() {
    process.exit(0);
}).catch(function(error) {
    console.log(error);
    process.exit(1);
});