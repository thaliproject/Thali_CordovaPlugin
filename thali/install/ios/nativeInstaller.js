'use strict';

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
// The above copyright notice and this permission notice shall be included in
// all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
// this code was adapted from
// https://github.com/Justin-Credible/cordova-plugin-braintree/blob/master/hooks/after_plugin_install.js
//
//
//  Copyright (C) Microsoft. All rights reserved. Licensed under the MIT
//  license. See LICENSE.txt file in the project root for full license
//  information.
//

var exec = require('child-process-promise').exec;
var fs = require('fs-extra-promise');
var path = require('path');
var Promise = require('lie');
var xcode = require('xcode');

function addFramework(
  projectPath, frameworkProjectDir, frameworkOutputDir,
  buildWithTests, testingInfrastructureDir) {

  // We need to build ThaliCore.framework before embedding it into the project
  return buildFramework(
    frameworkProjectDir, frameworkOutputDir, buildWithTests)
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

          if (buildWithTests) {
            xcodeProject.removeBuildProperty(
              'OTHER_SWIFT_FLAGS');
            xcodeProject.addBuildProperty('OTHER_SWIFT_FLAGS', '\"-DTEST\"');

            xcodeProject.removeBuildProperty('GCC_PREPROCESSOR_DEFINITIONS');
            xcodeProject.updateBuildProperty(
              'GCC_PREPROCESSOR_DEFINITIONS',
              ['\"$(inherited)\"', '\"TEST=1\"']);
          }

          // First check to see if the Embed Framework node exists, if not, add
          // it. This is all we need to do as they are added to the embedded
          // section by default.
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
            // If we don't set it, the folder type defaults to "Shared
            // Frameworks".
            buildPhaseResult.buildPhase.dstSubfolderSpec = 10;
            console.log('Adding Embedded Build Phase');
          } else {
            console.log('Embedded Build Phase already added');
          }

          // This is critical to include,
          // otherwise the library loader cannot find libs at runtime
          // on a device.
          xcodeProject.addBuildProperty(
            'LD_RUNPATH_SEARCH_PATHS',
            '\"$(inherited) @executable_path/Frameworks\"', 'Debug');
          xcodeProject.addBuildProperty(
            'LD_RUNPATH_SEARCH_PATHS',
            '\"$(inherited) @executable_path/Frameworks\"', 'Release');

          // Add the frameworks again.
          // This time they will have the code-sign option set
          // so they get code signed when being deployed to devices.
          console.log('Adding ThaliCore.framework');
          xcodeProject.addFramework(
            path.join(frameworkOutputDir, 'ThaliCore.framework'),
            {customFramework: true, embed: true, link: true, sign: true});

          // Add the frameworks again.
          // This time they will have the code-sign option set
          // so they get code signed when being deployed to devices.
          if (buildWithTests) {
            console.log('Adding XCTest.framework');
            var xcTestFrameworkPath = '/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/Library/Frameworks/XCTest.framework';
            // var xcTestFrameworkPath =
            // '/Applications/Xcode.app/Contents/Developer/Platforms/
            // iPhoneSimulator.platform/Developer/Library/Frameworks/XCTest
            // .framework';
            xcodeProject.addFramework(
              xcTestFrameworkPath,
              {customFramework: true, embed: true, link: true, sign: true});
          }

          if (buildWithTests) {
            var testingFiles =
              fs.readdirSync(testingInfrastructureDir)
                .filter(function (file) {
                  return file.endsWith('.swift');
                })
                .map(function (file) {
                  return path.join(testingInfrastructureDir, file);
                });

            testingFiles
              .forEach(function (file) {
                xcodeProject.addSourceFile(file);
              });
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

/**
 * @param {string} projectDir Xcode project directory
 * @param {string} outputDir Framework output directory
 * @param {boolean} buildWithTests
 * @returns {Promise} Output of exec
 */
function buildFramework(projectDir, outputDir, buildWithTests) {
  var projectName = 'ThaliCore';
  var projectScheme = 'ThaliCore';
  if (buildWithTests) {
    projectScheme = 'ThaliCoreCITests';
  }

  var projectConfiguration = 'Release';
  var sdk = 'iphoneos';
  var projectPath = path.join(projectDir, projectName + '.xcodeproj');
  var buildDir = path.join(projectDir, 'build');

  var buildCmd = 'set -o pipefail && ' +
    'xcodebuild -project' +
    ' \"' + projectPath + '\"' +
    ' -scheme ' + '\"' + projectScheme + '\"' +
    ' -configuration ' + projectConfiguration +
    ' -sdk ' + sdk +
    ' ONLY_ACTIVE_ARCH=NO ' +
    ' BUILD_DIR=' + '\"' + buildDir + '\"' +
    ' clean build';

  console.log('Building ThaliCore.framework');

  // todo: fixed buffer size should be fixed with streaming in #1001
  return exec(buildCmd, { maxBuffer: 10*1024*1024 } )
    .then(function () {
      return fs.ensureDir(outputDir);
    })
    .then(function () {
      var frameworkBuildDir = path.join(
        buildDir, projectConfiguration + '-' + sdk, projectName + '.framework');
      var frameworkOutputDir = path.join(
        outputDir, projectName + '.framework');

      return fs.copy(frameworkBuildDir, frameworkOutputDir, { clobber: false });
    });
}

module.exports = {
  addFramework: addFramework
};
