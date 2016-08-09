'use strict';
var spawn = require('child_process').spawn;
var exec = require('child_process').exec;
var path = require('path');
var http = require('http');
var fs = require('fs'); // Will be overwritten by fs-extra-promise
var Promise = null; // Wil be set below

var pouchDBNodePackageName = 'pouchdb-node';
var expressPouchDBPackageName = 'express-pouchdb';

function getPackageJsonVersion(packageName) {
  // If you can't trust your own file, who can you trust?
  var packageJSON =
    JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json')));
  if (!packageJSON.dependencies || !packageJSON.dependencies[packageName]) {
    throw new Error('No such packageName - ' + packageName);
  }
  return packageJSON.dependencies[packageName];
}

function installPackage(packageName, version, callback) {
  var packageVersion = packageName + '@' + version;
  exec('jx install ' + packageVersion, function (error, stdout, stderr) {
    if (error) {
      console.log('jx install of ' + packageVersion + ' failed with error ' +
        error + ', stdout: ' + stdout + ', stderr: ' + stderr);
      return callback(error);
    }
    callback();
  });
}


// This is stolen from install.js, I copy it here to simplify the work of
// making this file function since as it is, it is run before we run
// 'npm install'.
function childProcessExecPromise(commandString, currentWorkingDirectory) {
  return new Promise(function (resolve, reject) {
    var commandSplit = commandString.split(' ');
    var command = commandSplit.shift();
    var theProcess = spawn(command, commandSplit,
                            { cwd: currentWorkingDirectory});
    theProcess.stdout.on('data', function (data) {
      console.log('' + data);
    });
    theProcess.stderr.on('data', function (data) {
      console.log('' + data);
    });
    theProcess.on('close', function (code) {
      if (code !== 0) {
        return reject(code);
      }
      return resolve();
    });
  });
}

/**
 * Runs an array of commands on the command line one by one.
 * @param {string[][]} arrayOfCommandDirs An array of arrays. The child arrays
 * each must contain exactly two values, the first is the command to execute
 * and the second is the directory to run the command in.
 * @returns {Promise<null|Error>} If all goes well then returns Promise resolve
 * with null otherwise returns a reject with an error
 */
function childProcessExecCommandLine(arrayOfCommandDirs) {
  var promiseResult = Promise.resolve();
  arrayOfCommandDirs.forEach(function (commandDir) {
    promiseResult = promiseResult.then(function () {
      return childProcessExecPromise(commandDir[0], commandDir[1]);
    });
  });
  return promiseResult;
}

/**
 * Deletes the targetDirName directory in the current working directory if any
 * and then downloads the specified branchName from the specified gitUrl and
 * then hard resets to the given commitId. It then installs and builds the
 * monorepo and publishes to the NPM repository (we assume that Sinopia or
 * equivalent has been set up locally but that is handled manually)
 *
 * @param  {string} gitUrl
 * @param  {string} branchName
 * @param  {string} commitId
 * @param  {string} packageName If specified only this package will be
 * published. Otherwise all the packages in the repo will be published.
 * @param  {string} targetDirName
 */
function installCustomMonoRepoPackage(gitUrl, branchName, commitId, packageName,
                                      targetDirName) {
  var customPouchDirPath = path.join(__dirname, targetDirName);
  var packagesDir = path.join(customPouchDirPath, 'packages');
  return fs.removeAsync(targetDirName)
    .then(function () {
      return childProcessExecCommandLine([
        ['git clone --single-branch --branch ' + branchName + ' ' +
          gitUrl + ' ' + targetDirName, __dirname],
        ['git reset --hard ' + commitId, customPouchDirPath],
        // We intentionally are using npm and not 'jx npm' below because
        // PouchDB at least depends on leveldown which can't be built in
        // jxcore (only leveldown-mobile). There is probably a way to hack
        // the build to skip that part and let us use JXcore but since we are
        // only going to use pure Javascript output by these build process
        // but it's not worth the effort.
        ['npm install', customPouchDirPath],
        ['npm build', customPouchDirPath] // Probably not needed
      ]);
    })
    .then(function () {
      if (packageName) {
        return [packageName];
      }
      return fs.readdirAsync(packagesDir);
    })
    .then(function (dirs) {
      var promises = [];
      // The two repos we currently support use Lerna but unfortunately
      // PouchDB's repo does not support Lerna's publish command so we
      // have to install things manually.
      dirs.forEach(function (dirName) {
        var packageDir = path.join(packagesDir, dirName);
        var packageJsonLocation = path.join(packageDir, 'package.json');
        var publishPromise = fs.readJsonAsync(packageJsonLocation)
          .then(function (packageJson) {
            if (packageJson.private) {
              return Promise.resolve();
            }
            return childProcessExecCommandLine([
              // We can't ship gz files in Android so we have to delete them
              ['find . -name \"*.gz\" -delete', packageDir],
              ['npm publish', packageDir]
            ])
              .catch(function (err) {
                // The actual error is usually just an int so we publish more
                // here to make debugging easier
                console.log('Ignoring install error - ' + err + ' for entry ' +
                            packageDir);
                return Promise.reject(err);
              });
          });
        promises.push(publishPromise);
      });
      return Promise.all(promises);
    });
}

/**
 * There is a bug in Node-PouchDB that causes failures in Express-PouchDB. We
 * need to fix it but don't have time right now so we are using this as a
 * stop gap.
 */
function installNodePouchDB () {
  var gitUrl = 'https://github.com/pouchdb/pouchdb.git';
  var branch = 'master';
  var commitId = '8d2af9bd78';
  var targetDir = 'customPouchDir';

  return installCustomMonoRepoPackage(gitUrl, branch, commitId, null,
                                      targetDir);
}

/**
 * Express PouchDB has a bug that leaves setIntervals hanging around which eats
 * memory, kills CPU and hobbles our tests. Until our fix makes it into the
 * published version we need a custom version. Right now the PouchDB-Server repo
 * we are using isn't a true mono-repo in the sense that the packages are cross
 * connected. Instead the packages are just co-habitating. Furthermore other
 * than the one change we made to the express-pouchdb package, the contents of
 * the other packages are in NPM. So we just need to publish the one package we
 * are using and can ignore the rest for now.
 */
function installExpressPouchDB () {
  var gitUrl = 'https://github.com/yaronyg/pouchdb-server.git';
  var branch = 'thali-release';
  var commitId = '6f40454';
  var packageName = 'express-pouchdb';
  var targetDir = 'customPouchServerDir';

  return installCustomMonoRepoPackage(gitUrl, branch, commitId, packageName,
                                      targetDir);
}

function getNpmRegistryUrl() {
  return new Promise(function (resolve, reject) {
    exec('npm get registry', function (err, stdout, stderr) {
      if (err) {
        return reject(err);
      }
      if (stderr) {
        return reject(stderr);
      }
      return resolve(stdout.trim());
    });
  });
}

/**
 * Detects if the NPM registry configured on the system has a copy of the
 * version of a package we are looking for.
 * @param {string} packageName
 * @param {string} versionNumber
 * @param {string} registryUrl
 */
function versionExists(packageName, versionNumber, registryUrl) {
  return new Promise(function (resolve, reject) {
    var requestUrl = registryUrl + packageName + '/' + versionNumber;
    var responseBody = '';
    http.get(requestUrl)
    .on('response', function (res) {
      // Node won't exit if we don't read the response data,
      // even if we get a 404
      res.on('data', function (data) {
        responseBody += data;
      })
      .on('end', function () {
        // No, this isn't safe but since we are talking to our NPM server
        // it seems bizarre to not trust what it says since it could hurt
        // us in so many other ways.
        var npmResponseObj = JSON.parse(responseBody);
        resolve(npmResponseObj.version === versionNumber);
      });
      if (res.statusCode === 404) {
        return resolve(false);
      }
      if (res.statusCode !== 200) {
        return reject('bad status code ' + res.statusCode);
      }
    })
    .on('error', function (err) {
      reject('err - ' + err);
    });
  });
}

/**
 * We check to see if the NPM registry (which we assume is sinopia) contains
 * versions of PouchDB and Express-PouchDB that we specify in the local
 * project's package.json. If the versinos are published in the public NPM then
 * we will detect them and do nothing. If they are our magical versions then we
 * will see if they have already been put into the local NPM registry and if so
 * we will do nothing. But if they aren't there then we will build and publish
 * them. This code assumes that 'npm adduser' has already been used to enable
 * this machine to publish to its local NPM registry.
 */
function installAll() {
  var promises = [];
  var registryUrl = null;
  return getNpmRegistryUrl()
  .then(function (foundRegistryUrl) {
    registryUrl = foundRegistryUrl;
    var pouchDBNodeVersion = getPackageJsonVersion(pouchDBNodePackageName);
    return versionExists(pouchDBNodePackageName, pouchDBNodeVersion,
                         registryUrl);
  })
  .then(function (pouchDBVersionExists) {
    if (!pouchDBVersionExists) {
      promises.push(installNodePouchDB());
    }
    var expressPouchDBVersion =
      getPackageJsonVersion(expressPouchDBPackageName);
    return versionExists(expressPouchDBPackageName, expressPouchDBVersion,
                         registryUrl);
  })
  .then(function (expressPouchDBExists) {
    if (!expressPouchDBExists) {
      promises.push(installExpressPouchDB());
    }
    return Promise.all(promises);
  })
  .catch(function (err) {
    console.log('ERROR DURING INSTALLCUSTOMPOUCHDB - ' + err);
    process.exit(-1);
  });
}

// Two of the requires used by this package are not shipped with Node.js.
// But we have to run this code before we run NPM install. So we manually
// emulate 'npm install' for those two packages and then run our logic
// once they are loaded.
var fsExtraPromiseVersion = getPackageJsonVersion('fs-extra-promise');
installPackage('fs-extra-promise', fsExtraPromiseVersion,
  function (error) {
    if (error) {
      process.exit(-1);
    }
    fs = require('fs-extra-promise');
    var lieVersion = getPackageJsonVersion('lie');
    installPackage('lie', lieVersion, function (error) {
      if (error) {
        process.exit(-1);
      }
      Promise = require('lie');
      installAll();
    });
  });
