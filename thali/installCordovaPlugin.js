//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root
//  for full license information.
//

'use strict';

var path = require('path');
var exec = require('./install/utils/child_process').exec;

// If we are in the test directory inside of the GitHub Repo then we are trying
// to do local development on the desktop and don't need the Cordova
// dependencies
var rootDirectory = path.join(__dirname, '..');
if (path.basename(rootDirectory) === 'Thali_CordovaPlugin') {
  console.log('We believe we are in a clone of the GitHub Repo so we will not '+
              'install Cordova dependencies');
  process.exit(0);
}

var installDirectory = path.join(__dirname, 'install');

// First check that the installation is done to a Cordova project
exec('cordova info')
  .catch(function () {
    console.log('The installation directory does not seem to be a Cordova ' +
                'project and currently the installation is supported only to ' +
                'Cordova apps. Please see further information from:');
    console.log('https://github.com/thaliproject/Thali_CordovaPlugin');

    process.exit(1);
  })
  .then(function () {
    return exec('npm install --no-optional --production',
        { cwd: installDirectory });
  })
  .then(function () {
    return exec('find . -name "*.gz" -delete',
      { cwd: installDirectory });
  })
  .catch(function (error) {
    console.log('Could not install dependencies for install directory. - ' +
                error);
    process.exit(1);
  })
  .then(function () {
    require(installDirectory)(function (error) {
      if (error) {
        console.log('Failed with - ' + error);
        process.exit(1);
      }

      process.exit(0);
    });
  });
