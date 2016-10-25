//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root
//  for full license information.
//

'use strict';

var path = require('path');
var fs = require('fs');

// Replaces PROJECT_NAME pattern with actual Cordova's project name
function updateJXcoreExtensionImport(context) {
  var cordovaUtil =
    context.requireCordovaModule('cordova-lib/src/cordova/util');
  var ConfigParser = context.requireCordovaModule('cordova-lib').configparser;
  var projectRoot = cordovaUtil.isCordova();
  var xml = cordovaUtil.projectConfig(projectRoot);
  var cfg = new ConfigParser(xml);

  var Q = context.requireCordovaModule('q');
  var deferred = new Q.defer();

  var jxcoreExtensionPath = path.join(
    context.opts.plugin.dir, 'src', 'ios', 'JXcoreExtension.m');
  try {
    console.log('Updating JXcoreExtension.m');

    var oldContent = fs.readFileSync(jxcoreExtensionPath, 'utf8');
    var newContent = oldContent.replace('%PROJECT_NAME%', cfg.name());
    fs.writeFileSync(jxcoreExtensionPath, newContent, 'utf8');

    deferred.resolve();
  } catch (error) {
    console.log('Failed updating of JXcoreExtension.m');

    deferred.reject(error);
  }

  return deferred.promise;
}

module.exports = function (context) {
  return updateJXcoreExtensionImport(context);
};
