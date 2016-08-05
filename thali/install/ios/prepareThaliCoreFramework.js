'use strict';
var childProcessExecPromise = require('../utils.js').childProcessExecPromise;
var exec = require('child_process').exec;
var fs = require('fs-extra-promise');
var path = require("path");
var Promise = require('lie');
var xcode = require("xcode");

module.exports.addFramework = function(projectPath, thaliCoreFrameworkProjectFolder, includeTests) {
  // We need to build ThaliCore.framework before embedding it into the project
  var thaliFrameworkOutputFolder = path.join(thaliCoreFrameworkProjectFolder, "framework");
  return buildThaliCoreFramework(thaliCoreFrameworkProjectFolder, thaliFrameworkOutputFolder, includeTests)
    .then(function() {
      var pbxProjectPath = path.join(projectPath, "project.pbxproj");
      var xcodeProject = xcode.project(pbxProjectPath);

      return new Promise(function (resolve, reject) {

        xcodeProject.parse(function(err) {

            // If we couldn't parse the project, bail out.
            if (err) {
              reject(new Error("Cannot parse Xcode project: " + JSON.stringify(err)));
              return;
            }

            // Project should not have more that one target.
            var targetUUID = xcodeProject.getFirstTarget().uuid;

            // We need to tell to Xcode project that we use Swift in our framework
            // I believe that this line of code will be removed in the future
            console.log("Adding Build Properties");

            xcodeProject.removeBuildProperty('EMBEDDED_CONTENT_CONTAINS_SWIFT');
            xcodeProject.addBuildProperty('EMBEDDED_CONTENT_CONTAINS_SWIFT', 'YES');

            xcodeProject.removeBuildProperty('OTHER_SWIFT_FLAGS');
            xcodeProject.addBuildProperty('OTHER_SWIFT_FLAGS', '\"-DTEST\"');

            xcodeProject.removeBuildProperty('GCC_PREPROCESSOR_DEFINITIONS');
            xcodeProject.updateBuildProperty('GCC_PREPROCESSOR_DEFINITIONS', ['\"$(inherited)\"', '\"TEST=1\"']);

            // First check to see if the Embed Framework node exists, if not, add it.
            // This is all we need to do as they are added to the embedded section by default.
            if (!xcodeProject.pbxEmbedFrameworksBuildPhaseObj(targetUUID)) {
                var buildPhaseResult = xcodeProject.addBuildPhase([], "PBXCopyFilesBuildPhase", "Embed Frameworks", targetUUID,  "framework");
                // No idea why, but "Framework" (value 10) is not available in node-xcode, set it here manually so libraries
                // embed correctly.  If we don't set it, the folder type defaults to "Shared Frameworks".
                buildPhaseResult.buildPhase.dstSubfolderSpec = 10;
                console.log("Adding Embedded Build Phase");
            } else {
                console.log("Embedded Build Phase already added");
            }

            // This is critical to include, otherwise the library loader cannot find the dynamic Braintree libs at runtime
            // on a device.
            xcodeProject.addBuildProperty("LD_RUNPATH_SEARCH_PATHS", "\"$(inherited) @executable_path/Frameworks\"", "Debug");
            xcodeProject.addBuildProperty("LD_RUNPATH_SEARCH_PATHS", "\"$(inherited) @executable_path/Frameworks\"", "Release");

            // Add the frameworks again.  This time they will have the code-sign option set so they get code signed when being deployed to devices.
            console.log("Adding ThaliCore.framework");
            xcodeProject.addFramework(path.join(thaliFrameworkOutputFolder, "ThaliCore.framework"), {customFramework: true, embed: true, link: true, sign: true});

            // Add the frameworks again. This time they will have the code-sign option set so they get code signed when being deployed to devices.
            if (includeTests) {
              console.log("Adding XCTest.framework");
              var xcTestFrameworkPath = "/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneOS.platform/Developer/Library/Frameworks/XCTest.framework";
              // var xcTestFrameworkPath = "/Applications/Xcode.app/Contents/Developer/Platforms/iPhoneSimulator.platform/Developer/Library/Frameworks/XCTest.framework";
              xcodeProject.addFramework(xcTestFrameworkPath, {customFramework: true, embed: true, link: true, sign: true});
            }

            resolve(xcodeProject);
        });
      })
      .then(function(xcodeProject) {
        // Save the project file back to disk.
        return fs.writeFileAsync(pbxProjectPath, xcodeProject.writeSync(), "utf-8");
      });
    });
};

function buildThaliCoreFramework(projectFolder, outputFolder, includeTests) {
  var projectName = "ThaliCore";
  var projectScheme = "ThaliCore";
  if (includeTests) {
    projectScheme = "ThaliCoreCITests";
  }

  var projectConfiguration = "Release";
  var sdk = "iphoneos";
  var projectPath = path.join(projectFolder, projectName + ".xcodeproj");
  var buildDir = path.join(projectFolder, "build");

  var buildCmd = "set -o pipefail && " +
    "xcodebuild -project " +
    "\"" + projectPath + "\"" +
    " -scheme " + "\"" + projectScheme + "\"" +
    " -configuration " + projectConfiguration +
    " -sdk " + sdk +
    " ONLY_ACTIVE_ARCH=NO " +
    " BUILD_DIR=" + "\"" + buildDir + "\"" +
    " clean build" +
    " > /dev/null";

  console.log("Building ThaliCore.framework");

  return childProcessExecPromise(buildCmd, "")
    .then(function () {
      return childProcessExecPromise("mkdir -p " + "\"" + outputFolder + "\"", "");
    })
    .then(function () {
      var frameworkInputPath = path.join(buildDir, projectConfiguration + "-" + sdk, projectName + ".framework");
      var copyFrameworkCmd =
        "cp -R " +
        " \"" + frameworkInputPath + "\"" +
        " \"" + outputFolder + "\"" ;

      return childProcessExecPromise(copyFrameworkCmd, "");
    });
}
