'use strict';
var spawn = require('child_process').spawn;
var fs = require('fs-extra-promise');
var path = require('path');
var Promise = require('lie');

// This is stolen from install.js, I don't want to put it into a utility
// file because I'm hoping this file will go away.
function childProcessExecPromise(commandString, currentWorkingDirectory) {
  return new Promise(function (resolve, reject) {
    var commandSplit = commandString.split(' ');
    var command = commandSplit.shift();
    var stdErrData = false;
    var theProcess = spawn(command, commandSplit,
                            { cwd: currentWorkingDirectory});
    theProcess.stdout.on('data', function (data) {
      console.log('' + data);
    });
    theProcess.stderr.on('data', function (data) {
      //stdErrData = true;
      console.log('' + data);
    });
    theProcess.on('close', function (code) {
      if (code !== 0) {
        return reject(code);
      }
      if (stdErrData) {
        return reject(-1);
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
 * monorepo and links the identified package to the current working directory's
 * node_modules.
 *
 * @param  {string} gitUrl
 * @param  {string} branchName
 * @param  {string} commitId
 * @param  {string} packageName
 * @param  {string} targetDirName
 */
function installCustomMonoRepoPackage(gitUrl, branchName, commitId, packageName,
                                      targetDirName) {
  var customPouchDirPath = path.join(__dirname, targetDirName);
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
        // it's not worth the effort.
        ['npm install', customPouchDirPath],
        ['npm build', customPouchDirPath],
        ['npm link ' + path.join(__dirname, targetDirName, 'packages',
                                  packageName) , __dirname]
      ]);
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
  var packageName = 'pouchdb-node';
  var targetDir = 'customPouchDir';

  return installCustomMonoRepoPackage(gitUrl, branch, commitId, packageName,
                                      targetDir);
}

function installExpressPouchDB () {
  var gitUrl = 'https://github.com/yaronyg/pouchdb-server.git';
  var branch = '326-endless-polling';
  var commitId = 'a012907';
  var packageName = 'express-pouchdb';
  var targetDir = 'customPouchServerDir';

  return installCustomMonoRepoPackage(gitUrl, branch, commitId, packageName,
                                      targetDir);
}

function installAll() {
  var promises = [];
  promises.push(installNodePouchDB());
  promises.push(installExpressPouchDB());
  return Promise.all(promises)
    .catch(function (err) {
      console.log('ERROR DURING INSTALLCUSTOMPOUCHDB - ' + err);
      process.exit(-1);
    });
}

installAll();
