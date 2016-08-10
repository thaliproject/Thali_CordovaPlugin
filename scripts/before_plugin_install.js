//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root
//  for full license information.
//

'use strict';

var exec = require('child_process').exec;
var path = require('path');

module.exports = function (context) {

    console.log('Installing dependencies required for Cordova hooks');

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

      deferred.resolve();
    };
    exec("npm install", { cwd: hooksDir }, execCallback);

    return deferred.promise;
  };
