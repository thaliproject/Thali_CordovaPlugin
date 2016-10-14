//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root
//  for full license information.
//

'use strict';

var fs = require('fs');
var path = require('path');

function updateJXcoreExtensionImport(context) {
  var Q = context.requireCordovaModule('q');
  var deferred = new Q.defer();

  var cordova_util = context
    .requireCordovaModule('cordova-lib/src/cordova/util');
  var ConfigParser = context
    .requireCordovaModule('cordova-lib').configparser;
  var projectRoot = cordova_util.isCordova();
  var xml = cordova_util.projectConfig(projectRoot);
  var cfg = new ConfigParser(xml);

  var jxcoreExtensionPath = path.join(
    context.opts.plugin.dir, 'src', 'ios', 'JXcoreExtension.m');
  try {
    var oldContent = fs.readFileSync(jxcoreExtensionPath, 'utf8');
    var newContent = oldContent.replace('%PROJECT_NAME%', cfg.name());
    fs.writeFileSync(jxcoreExtensionPath, newContent, 'utf8');

    deferred.resolve();
  } catch (error) {
    console.log('Failed to rename JXcoreExtension.m import');
    deferred.reject(error);
  }

  return deferred.promise;
}

module.exports = function (context) {
  // replacing PROJECT_NAME pattern with actual Cordova's project name
  return updateJXcoreExtensionImport(context);
};
