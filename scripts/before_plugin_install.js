//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root
//  for full license information.
//

'use strict';

var exec = require('child_process').exec;
var path = require('path');

module.exports = function (context) {

    var Q = context.requireCordovaModule('q');
    var deferred = new Q.defer();

    // Temporary hack to run npm install on this plugin's hooks dependencies.
    var hooksDir = path.resolve(__dirname);
    var execCallback = function (error, stdout, stderr) {
      if (error) {
        if (stdout) { console.log('stdout: ' + stdout); }
        if (stderr) { console.log('stderr: ' + stderr); }

        deferred.reject(error);
        return;
      }

      if (stdout) {
        console.log(
          'Install dependencies for Thali Cordova plugin hooks success');
        console.log(stdout);
      }

      if (stderr) {
        console.log(
          'Install dependencies for Thali Cordova plugin hooks with errors');
        console.log(stderr);
      }

      deferred.resolve();
    };

    console.log(
      'Installing dependencies required for Thali Cordova plugin hooks in ' +
      hooksDir);
    exec('npm install --no-optional --production',
      { cwd: hooksDir }, execCallback);

    return deferred.promise;
  };
