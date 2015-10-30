'use strict';
var exec = require('child_process').exec;
var path = require('path');
var Promise = require('lie');
var fs = require('fs-extra-promise');
var scp = require('scp');

// Will be set later on based on determining if remote cache is needed,
// but can be used for testing purposes to force-enable remote cache.
var remoteCacheEnabled = false;
var remoteCacheUser = 'pi';
var remoteCacheHost = '192.168.1.150';
var remoteCacheRoot = '~';
var remoteCacheShouldUpdate = false;

module.exports.get = function (localPath, remotePath) {
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
      fs.mkdirsSync(localPath);
      console.log('We are in CI so trying to fetch the plugin via scp');
      scp.get({
        file: remotePath,
        user: remoteCacheUser,
        host: remoteCacheHost,
        path: localPath
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

module.exports.set = function (localPath, remotePath) {
  return new Promise(function(resolve, reject) {
    if (remoteCacheEnabled && remoteCacheShouldUpdate) {
      console.log('Starting to update the remote cache');
      scp.send({
        file: localPath,
        user: remoteCacheUser,
        host: remoteCacheHost,
        path: remotePath
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

module.exports.purge = function (remotePath) {
  return new Promise(function(resolve, reject) {
    if (!remoteCacheEnabled) {
      resolve();
      return;
    }
    var sshConnection = 'ssh '+ remoteCacheUser + '@' + remoteCacheHost;
    var purgeCommand = '"rm -rf ' + remotePath + '"';
    console.log('Purging the remote cache using command: ' + purgeCommand);
    exec(sshConnection + ' ' + purgeCommand, function (err, stdout, stderr) {
      if (err) {
        reject(err);
        return;
      }
      resolve();
    });
  });
};
