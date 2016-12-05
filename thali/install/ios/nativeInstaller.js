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

'use strict';

var exec = require('child-process-promise').exec;
var fs = require('fs-extra-promise');
var path = require('path');
var Promise = require('lie');
var xcode = require('xcode');

function addFramework(
  projectPath, frameworksDir, buildWithTests, testingInfrastructureDir) {

  // We need to build ThaliCore.framework before embedding it into the project
  return buildFrameworks(frameworksDir, buildWithTests)
    .then(function (frameworksPaths) {
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

          xcodeProject.addBuildProperty(
            'ENABLE_TESTABILITY', 'YES', 'Debug');

          xcodeProject.addBuildProperty(
            'IPHONEOS_DEPLOYMENT_TARGET', '10.0');

          // Tell to Xcode project that we use Swift in our framework
          // I believe that this line of code will be removed in the future
          xcodeProject.addBuildProperty(
            'ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES', 'YES');
          xcodeProject.addBuildProperty(
            'SWIFT_VERSION', '3.0');

          xcodeProject.addBuildProperty(
            'OTHER_SWIFT_FLAGS', '\"-DTEST\"');

          xcodeProject.addBuildProperty(
            'GCC_PREPROCESSOR_DEFINITIONS',
            ['\"$(inherited)\"', '\"TEST=1\"']);

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

          // Link frameworks
          frameworksPaths
            .forEach(function (frameworkPath) {
              console.log('Adding framework: ' + frameworkPath);

              xcodeProject.addFramework(
                frameworkPath,
                {customFramework: true, embed: false, link: true, sign: false});
            });

          // since we're using Carthage we need to add build phase
          // that runs carthage copy-frameworks
          // for all frameworks created by Carthage

          var projectDir = path.dirname(projectPath);
          var relativeFrameworksPaths = frameworksPaths
            .map(function (frameworkPath) {
              var frameworkDir = path.dirname(frameworkPath);
              var frameworkName = path.basename(frameworkPath);
              var relativeDir = path.relative(projectDir, frameworkDir);

              return '\"' + '$(SRCROOT)' + path.sep +
                path.join(relativeDir, frameworkName) + '\"';
            });

          xcodeProject.addBuildPhase(
            [],
            'PBXShellScriptBuildPhase',
            'Carthage Copy Frameworks',
            targetUUID,
            {
              inputPaths: relativeFrameworksPaths,
              shellPath: '/bin/sh',
              shellScript: '/usr/local/bin/carthage copy-frameworks'
            }
          );

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
}

/**
 * @param {string} frameworksDir Xcode project directory
 * @param {string} outputDir Framework output directory
 * @param {boolean} buildWithTests
 * @returns {Promise} Output of exec
 */
function buildFrameworks(frameworksDir, buildWithTests) {

  var buildDir = path.join(
    frameworksDir, 'Carthage', 'Build', 'iOS'
  );
  // NOTE: --configuration Debug is important since
  // we need ENABLE_TESTABILITY flag set to YES
  var buildCmd = 'carthage update --platform ios --configuration Debug ' +
    '--project-directory ' + frameworksDir;

  console.log('Building ThaliCore.framework');

  // todo: fixed buffer size should be fixed with streaming in #1001
  return exec(buildCmd, { maxBuffer: 10*1024*1024 } )
    .then(function () {
      return fs.readdirAsync(buildDir)
        .then(function (files) {
          return files
            .filter(function (file) {
              if (!file.endsWith('.framework')) {
                return false;
              }

              if (!buildWithTests && file.indexOf('Test') !== -1) {
                return false;
              }

              return true;
            })
            .map(function (file) {
              return path.join(buildDir, file);
            });
        });
    });
}

module.exports = {
  addFramework: addFramework
};
