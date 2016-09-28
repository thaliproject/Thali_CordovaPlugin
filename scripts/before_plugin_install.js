//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root
//  for full license information.
//

'use strict';

var exec = require('child_process').exec;
var path = require('path');
var fs = require('fs');

function updateJXcoreExtensionImport(context) {
  var cordova_util = context.requireCordovaModule('cordova-lib/src/cordova/util'),
      ConfigParser = context.requireCordovaModule('cordova-lib').configparser,
      projectRoot = cordova_util.isCordova(),
      xml = cordova_util.projectConfig(projectRoot),
      cfg = new ConfigParser(xml);

  var jxcoreExtensionPath = path.join(
    context.opts.plugin.dir, 'src', 'ios', 'JXcoreExtension.m');
  try {
    var oldContent = fs.readFileSync(jxcoreExtensionPath, 'utf8')
    var newContent = oldContent.replace('%PROJECT_NAME%', cfg.name())
    fs.writeFileSync(jxcoreExtensionPath, newContent, 'utf8');
  } catch (error) {
    console.log(error);
    console.log('Failed to rename JXcoreExtension.m import');
  }
  return
};

module.exports = function (context) {

    var Q = context.requireCordovaModule('q');
    var deferred = new Q.defer();

    // replacing PROJECT_NAME pattern with actual Cordova's project name
    updateJXcoreExtensionImport(context)

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
      'Installing dependencies for Thali Cordova plugin hooks in ' +
      hooksDir);
    exec('jx npm install --autoremove "*.gz"', { cwd: hooksDir }, execCallback);

    return deferred.promise;
  };
