//
// The MIT License (MIT)
//
// Copyright (c) 2016 Justin Unterreiner
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
// this code was adapted from https://github.com/Justin-Credible/cordova-plugin-braintree/blob/master/hooks/after_plugin_install.js
//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root
//  for full license information.
//

'use strict';
var exec = require('child-process-promise').exec;
var fs = require('fs-extra-promise');
var path = require('path');
var Promise = require('lie');
var xcode = require('xcode');

function isTestEnvironment() {
  try {
    var utFlag = fs.lstatSync('platforms/ios/unittests');

    try {
      console.log('Removing UT flag');
      fs.removeSync('platforms/ios/unittests');
    } catch (err) {
      console.log(err);
      console.log('Failed to remove the UT flag file, continuing anyway');
    }

    return utFlag.isFile();
  } catch (err) {
    console.log('Not a test environment, continue normally.');
    return false;
  }
};

function addThaliCoreFramework(
  projectPath, thaliCoreFrameworkProjectFolder, includeTests) {
  // We need to build ThaliCore.framework before embedding it into the project
  var thaliFrameworkOutputFolder = path.join(
    thaliCoreFrameworkProjectFolder, 'framework');
  return buildThaliCoreFramework(
    thaliCoreFrameworkProjectFolder, thaliFrameworkOutputFolder, includeTests)
    .then(function () {
      var pbxProjectPath = path.join(projectPath, 'project.pbxproj');
      var xcodeProject = xcode.project(pbxProjectPath);

      return new Promise(function (resolve, reject) {

        xcodeProject.parse(function (error) {

            // If we couldn't parse the project, bail out.
            if (error) {
              var message =
                'Cannot parse Xcode project: ' + JSON.stringify(error);
              reject(new Error(message));
              return;
            }

            // Project should not have more that one target.
            var targetUUID = xcodeProject.getFirstTarget().uuid;

            console.log('Adding Build Properties');

            // Tell to Xcode project that we use Swift in our framework
            // I believe that this line of code will be removed in the future
            xcodeProject.removeBuildProperty(
              'EMBEDDED_CONTENT_CONTAINS_SWIFT');
            xcodeProject.addBuildProperty(
              'EMBEDDED_CONTENT_CONTAINS_SWIFT', 'YES');

            xcodeProject.removeBuildProperty(
              'OTHER_SWIFT_FLAGS');
            xcodeProject.addBuildProperty('OTHER_SWIFT_FLAGS', '\"-DTEST\"');

            xcodeProject.removeBuildProperty('GCC_PREPROCESSOR_DEFINITIONS');
            xcodeProject.updateBuildProperty(
              'GCC_PREPROCESSOR_DEFINITIONS',
              ['\"$(inherited)\"', '\"TEST=1\"']);

            // First check to see if the Embed Framework node exists, if not, add it.
            // This is all we need to do as they are added to the embedded section by default.
            if (!xcodeProject.pbxEmbedFrameworksBuildPhaseObj(targetUUID)) {
                var buildPhaseResult = xcodeProject.addBuildPhase(
                  [],
                  'PBXCopyFilesBuildPhase',
                  'Embed Frameworks',
                  targetUUID,
                  'framework');
                // No idea why,
                // but "Framework" (value 10) is not available in node-xcode,
                // set it here manually so libraries
                // embed correctly.
                // If we don't set it, the folder type defaults to "Shared Frameworks".
                buildPhaseResult.buildPhase.dstSubfolderSpec = 10;
                console.log('Adding Embedded Build Phase');
            } else {
                console.log('Embedded Build Phase already added');
            }

            // This is critical to include,
            // otherwise the library loader cannot find libs at runtime
            // on a device.
            xcodeProject.addBuildProperty(
              'LD_RUNPATH_SEARCH_PATHS', '\"$(inherited) @executable_path/Frameworks\"', 'Debug');
            xcodeProject.addBuildProperty(
              'LD_RUNPATH_SEARCH_PATHS', '\"$(inherited) @executable_path/Frameworks\"', 'Release');

            // Add the frameworks again.
            // This time they will have the code-sign option set
            // so they get code signed when being deployed to devices.
            console.log('Adding ThaliCore.framework');
            xcodeProject.addFramework(
              path.join(thaliFrameworkOutputFolder, 'ThaliCore.framework'),
              {customFramework: true, embed: true, link: true, sign: true});

            // Add the frameworks again.
            // This time they will have the code-sign option set
            // so they get code signed when being deployed to devices.
            if (includeTests) {
              console.log('Adding XCTest.framework');
              var xcTestFrameworkPath = '/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/Library/Frameworks/XCTest.framework';
              // var xcTestFrameworkPath = '/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneSimulator.platform/Developer/Library/Frameworks/XCTest.framework';
              xcodeProject.addFramework(
                xcTestFrameworkPath,
                {customFramework: true, embed: true, link: true, sign: true});
            }

            resolve(xcodeProject);
          });
      })
      .then(function (xcodeProject) {
        // Save the project file back to disk.
        return fs.writeFileAsync(
          pbxProjectPath, xcodeProject.writeSync(), 'utf-8');
      });
    });
};


function buildThaliCoreFramework(projectFolder, outputFolder, includeTests) {
  var projectName = 'ThaliCore';
  var projectScheme = 'ThaliCore';
  if (includeTests) {
    projectScheme = 'ThaliCoreCITests';
  }

  var projectConfiguration = 'Release';
  var sdk = 'iphoneos';
  var projectPath = path.join(projectFolder, projectName + '.xcodeproj');
  var buildDir = path.join(projectFolder, 'build');

  var buildCmd = 'set -o pipefail && ' +
    'xcodebuild -project ' +
    '\"' + projectPath + '\"' +
    ' -scheme ' + '\"' + projectScheme + '\"' +
    ' -configuration ' + projectConfiguration +
    ' -sdk ' + sdk +
    ' ONLY_ACTIVE_ARCH=NO ' +
    ' BUILD_DIR=' + '\"' + buildDir + '\"' +
    ' clean build';

  console.log('Building ThaliCore.framework');

  return exec(buildCmd, { maxBuffer: 200*1024 } )
    .then(function () {
      return exec('mkdir -p ' + '\"' + outputFolder + '\"');
    })
    .then(function () {
      var frameworkInputPath = path.join(
        buildDir, projectConfiguration + '-' + sdk, projectName + '.framework');
      var copyFrameworkCmd =
        'cp -R ' +
        ' \"' + frameworkInputPath + '\"' +
        ' \"' + outputFolder + '\"' ;

      return exec(copyFrameworkCmd);
    });
}

module.exports = function (context) {

    // Need a promise so that
    // the install waits for us to complete our project modifications
    // before the plugin gets installed.
    var Q = context.requireCordovaModule('q');
    var deferred = new Q.defer();

    // Only bother if we're on macOS
    if (process.platform !== 'darwin') {
      deferred.resolve();
      return deferred.promise;
    }

    var platforms = context.opts.cordova.platforms;

    // We can bail out if the iOS platform isn't present.
    if (platforms.indexOf('ios') === -1) {
      deferred.resolve();
      return deferred.promise;
    }

    // We need to build ThaliCore.framework before embedding it into the project

    var thaliProjectFolder = path.join(
      context.opts.plugin.dir, 'lib/ios/ThaliCore');

    // We need to embded frameworks to the project here.
    // They need to be embedded binaries and cordova does not yet support that.
    // We will use node-xcode directy to add them since that library has
    // been upgraded to support embedded binaries.

    // Cordova libs to get the project path and project name
    // so we can locate the xcode project file.
    var cordova_util = context.requireCordovaModule('cordova-lib/src/cordova/util'),
        ConfigParser = context.requireCordovaModule('cordova-lib').configparser,
        appRoot = context.opts.projectRoot,
        projectRoot = cordova_util.isCordova(),
        xml = cordova_util.projectConfig(projectRoot),
        cfg = new ConfigParser(xml);

    var projectPath = path.join(
      projectRoot, 'platforms/ios', cfg.name() + '.xcodeproj');

    return addThaliCoreFramework(
      projectPath, thaliProjectFolder, isTestEnvironment(appRoot));
  };
