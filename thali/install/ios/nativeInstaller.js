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

function updateProjectBuildProperties(xcodeProject, buildWithTests) {
  console.log('Adding Build Properties');

  // Tell to Xcode project that we use Swift in our framework
  // I believe that this line of code will be removed in the future
  xcodeProject.removeBuildProperty(
    'EMBEDDED_CONTENT_CONTAINS_SWIFT');

  xcodeProject.removeBuildProperty(
    'ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES');
  xcodeProject.addBuildProperty(
    'ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES', 'YES');

  xcodeProject.removeBuildProperty(
    'IPHONEOS_DEPLOYMENT_TARGET');
  xcodeProject.addBuildProperty(
    'IPHONEOS_DEPLOYMENT_TARGET', '10.0');

  xcodeProject.removeBuildProperty(
    'SWIFT_VERSION');
  xcodeProject.addBuildProperty(
    'SWIFT_VERSION', '3.0');

  xcodeProject.removeBuildProperty(
    'CLANG_WARN_ENUM_CONVERSION');
  xcodeProject.addBuildProperty(
    'CLANG_WARN_ENUM_CONVERSION', 'YES');

  xcodeProject.removeBuildProperty(
    'CLANG_WARN_INFINITE_RECURSION');
  xcodeProject.addBuildProperty(
    'CLANG_WARN_INFINITE_RECURSION', 'YES');

  xcodeProject.removeBuildProperty(
    'CLANG_WARN_SUSPICIOUS_MOVE');
  xcodeProject.addBuildProperty(
    'CLANG_WARN_SUSPICIOUS_MOVE', 'YES');

  xcodeProject.removeBuildProperty(
    'CLANG_WARN_UNREACHABLE_CODE');
  xcodeProject.addBuildProperty(
    'CLANG_WARN_UNREACHABLE_CODE', 'YES');

  xcodeProject.removeBuildProperty(
    'ENABLE_STRICT_OBJC_MSGSEND');
  xcodeProject.addBuildProperty(
    'ENABLE_STRICT_OBJC_MSGSEND', 'YES');

  xcodeProject.removeBuildProperty(
    'ENABLE_TESTABILITY');
  xcodeProject.addBuildProperty(
    'ENABLE_TESTABILITY', 'YES');

  xcodeProject.removeBuildProperty(
    'GCC_NO_COMMON_BLOCKS');
  xcodeProject.addBuildProperty(
    'GCC_NO_COMMON_BLOCKS', 'YES');

  xcodeProject.removeBuildProperty(
    'GCC_WARN_64_TO_32_BIT_CONVERSION');
  xcodeProject.addBuildProperty(
    'GCC_WARN_64_TO_32_BIT_CONVERSION', 'YES');

  xcodeProject.removeBuildProperty(
    'SWIFT_OPTIMIZATION_LEVEL');
  xcodeProject.addBuildProperty(
    'SWIFT_OPTIMIZATION_LEVEL', '-Owholemodule');

  if (buildWithTests) {
    console.log('buildWithTests:' + buildWithTests);

    xcodeProject.removeBuildProperty(
      'OTHER_SWIFT_FLAGS');
    xcodeProject.addBuildProperty('OTHER_SWIFT_FLAGS', '\"-DTEST\"');

    xcodeProject.removeBuildProperty('GCC_PREPROCESSOR_DEFINITIONS');
    xcodeProject.updateBuildProperty(
      'GCC_PREPROCESSOR_DEFINITIONS',
      ['\"$(inherited)\"', '\"TEST=1\"']);
  }
}

function updateProjectFrameworks(
  xcodeProject, frameworkOutputDir, buildWithTests) {
  // Project should not have more that one target.
  var targetUUID = xcodeProject.getFirstTarget().uuid;

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

  if (buildWithTests) {
    xcodeProject.addFramework(
      path.join(frameworkOutputDir, 'SwiftXCTest.framework'),
      {customFramework: true, embed: true, link: true, sign: true});
  }

  xcodeProject.addFramework(
    path.join(frameworkOutputDir, 'CocoaAsyncSocket.framework'),
    {customFramework: true, embed: true, link: true, sign: true});
}

function updateProjectTestingInfrastructure(
  xcodeProject, testingInfrastructureDir, buildWithTests) {
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
}

function addFramework(
  projectPath, frameworkProjectDir, frameworkOutputDir,
  buildWithTests, testingInfrastructureDir) {

  checkoutThaliCoreViaCarthage(
    frameworkOutputDir, frameworkProjectDir, buildWithTests)
    .then (function () {
      console.log('Checkouting done!');

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

              updateProjectBuildProperties(xcodeProject, buildWithTests);

              updateProjectFrameworks(
                xcodeProject, frameworkOutputDir, buildWithTests);

              updateProjectTestingInfrastructure(
                xcodeProject, testingInfrastructureDir, buildWithTests);

              resolve(xcodeProject);
            });
          })
          .then(function (xcodeProject) {
            // Save the project file back to disk.
            return fs.writeFileAsync(
              pbxProjectPath, xcodeProject.writeSync(), 'utf-8');
          });
        });
    })
};

function checkoutThaliCoreViaCarthage(cartfileDir, outputDir, buildWithTests) {
  var changeDirCmd = 'cd ' + cartfileDir;
  var removeCarthageDirCmd = 'rm -rf Carthage/';
  var carthageCmd = 'carthage update --no-build';
  var checkoutCmd = changeDirCmd + ' && ' + removeCarthageDirCmd + '&&' + carthageCmd;

  console.log('Checkouting ThaliCore and its dependencies');

  return exec(checkoutCmd, { maxBuffer: 10*1024*1024 } )
    .then(function () {
      return fs.ensureDir(outputDir);
    })
}

/**
 * @param {string} projectDir Xcode project directory
 * @param {string} outputDir Framework output directory
 * @param {boolean} buildWithTests
 * @returns {Promise} Output of exec
 */
function buildFramework(projectDir, outputDir, buildWithTests) {

  var cocoaAsyncSocketFrameworkName = 'CocoaAsyncSocket';
  var XCTestFrameworkName = 'SwiftXCTest';

  var projectName = 'ThaliCore';
  var projectScheme = 'ThaliCore';
  var projectConfiguration = 'Release';

  if (buildWithTests) {
    console.log('Building in debug mode');
    projectScheme = 'ThaliCoreCITests';
    projectConfiguration = 'Debug';
  }

  var sdk = 'iphoneos';
  var projectPath = path.join(projectDir, projectName + '.xcworkspace');
  var productPath = path.join(projectDir, "Products");
  var buildDir = path.join(projectDir, 'build');

  var buildCmd = 'set -o pipefail && ' +
    'xcodebuild -workspace' +
    ' \"' + projectPath + '\"' +
    ' -scheme ' + '\"' + projectScheme + '\"' +
    ' -configuration ' + projectConfiguration +
    ' -sdk ' + sdk +
    ' ONLY_ACTIVE_ARCH=NO ' +
    ' IPHONEOS_DEPLOYMENT_TARGET=10.0' +
    ' clean build';

  console.log('Building ThaliCore.framework');
  console.log('Build command:\n' + buildCmd);

  // todo: fixed buffer size should be fixed with streaming in #1001
  return exec(buildCmd, { maxBuffer: 10*1024*1024 } )
    .then(function () {
      console.log('Building ThaliCore.framework has been finished');
      return fs.ensureDir(outputDir);
    })
    .then(function () {
      var thaliCoreFrameworkBuildDir = path.join(
        productPath, projectName + '.framework');
      var frameworkOutputDir = path.join(
        outputDir, projectName + '.framework');

      return fs.copy(thaliCoreFrameworkBuildDir, frameworkOutputDir, { clobber: false });
    })
    .then(function () {
      var cocoaAsyncSocketFrameworkBuildDir = path.join(
        productPath, cocoaAsyncSocketFrameworkName + '.framework');
      var frameworkOutputDir = path.join(
        outputDir, cocoaAsyncSocketFrameworkName + '.framework');

      return fs.copy(cocoaAsyncSocketFrameworkBuildDir, frameworkOutputDir, { clobber: false });
    })
    .then(function () {
      if (!buildWithTests) {
        //Don't cope XCTestFramework if plugin built without tests. XCTestFramework doesn't even exist.
        return new Promise(function (resolve) {
          resolve();
        })
      }

      var swiftXCTestFrameworkBuildDir = path.join(
        productPath, XCTestFrameworkName + '.framework');
      var frameworkOutputDir = path.join(
        outputDir, XCTestFrameworkName + '.framework');

      return fs.copy(swiftXCTestFrameworkBuildDir, frameworkOutputDir, { clobber: false });
    });
}

module.exports = {
  addFramework: addFramework
};
