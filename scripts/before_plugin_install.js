//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root
//  for full license information.
//

'use strict';

/* jshint esnext: true */

var exec = require('child_process').exec;
var path = require('path');

module.exports = function (context) {
  var Q = context.requireCordovaModule('q');
  var deferred = new Q.defer();

  // Temporary hack to run npm install on this plugin's hooks dependencies.
  var hooksDir = path.resolve(__dirname);

  console.log(
    `\nInstalling Cordova plugin hooks dependencies in ${hooksDir}`);
  exec(`npm install; find . -name "*.gz" -delete`, { cwd: hooksDir },
    (error, stdout, stderr) => {

        if (stdout) { console.log(`stdout:\n${stdout}`); }
        if (stderr) { console.log(`stderr:\n${stderr}`); }

        if (error) {
          console.log(
            `Install Cordova hooks dependencies failed\n`);

          deferred.reject(error);
          return;
        }

        console.log(
          `Install Cordova hooks dependencies success\n`);

        deferred.resolve();
      }
  );

  return deferred.promise;
};
