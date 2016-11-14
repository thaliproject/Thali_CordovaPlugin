//
//  Copyright (C) Microsoft. All rights reserved.
//  Licensed under the MIT license. See LICENSE.txt file in the project root
//  for full license information.
//

'use strict';

var fs = require('fs-extra-promise');
var path = require('path');

/**
 * We've tried various strategies in plugin.xml to set the minimum sdk
 * in the Android manifest to an acceptable value such as uses-sdk in
 * the platform/config section and also the android-minSdkVersion and they do
 * work in that they add an appropriate uses-sdk to AndroidManifest.xml
 * but unfortunately it still leaves the default uses-sdk element set to
 * a min of 10 in there! I'm sure there is some fix but I'm tired of fighting
 * with it so we just force the change. One last thing to try is to create a
 * build-extras.gradle next to our plugin.xml and try to either stick in
 * an android declare block with a defaultConfig and a minSdkVersion or use
 * the special ext property that Cordova declares. But honestly, I'll figure it
 * out later.
 * @param {Object} appRoot
 */

var updateAndroidSDKVersion = function (appRoot) {
  var androidManifestLocation =
    path.join(appRoot, 'platforms/android/AndroidManifest.xml');
  var originalContent = fs.readFileSync(androidManifestLocation).toString();
  // Different version of Cordova use different mins, yes we need to replace
  // this with xpath
  var newContent = originalContent
    .replace('android:minSdkVersion="10"', 'android:minSdkVersion="21"')
    .replace('android:minSdkVersion="14"', 'android:minSdkVersion="21"');
  fs.writeFileSync(androidManifestLocation, newContent);
};

var replaceJXCoreExtension = function (appRoot) {
  var sourceFile = path.join(appRoot, 'plugins/org.thaliproject.p2p/src/' +
    'android/java/io/jxcore/node/JXcoreExtension.java');
  var targetFile = path.join(appRoot, 'platforms/android/src/io/jxcore/node' +
    '/JXcoreExtension.java');
  try {
    var sourceContent = fs.readFileSync(sourceFile);
    fs.writeFileSync(targetFile, sourceContent);
  } catch (e) {
    console.log(e);
    console.log('Failed to update the JXcoreExtension.java file!');
    console.log('Please make sure plugins org.thaliproject.p2p and ' +
      'io.jxcore.node are installed.');
    // Exit the process on this error, because it is a hard requirement for this
    // plugin to get the right JXcoreExtension.java or otherwise there will be
    // a build error when the app is tried to be built.
    process.exit(-1);
  }
};

var copyFiles = function(appRoot, source, target, message) {
  var sourceFile = path.join(appRoot, 'plugins/org.thaliproject.p2p/src/android/test' + source);
  var targetFile = path.join(appRoot, 'platforms/android' + target);

  try {
    fs.copySync(sourceFile, targetFile);
  } catch (err) {
    console.log(err);
    console.log('Failed to copy ' + message);
    process.exit(-1);
  }
};

var copyAndroidTestClasses = function (appRoot) {
  copyFiles(appRoot, '/io/jxcore/node', '/src/io/jxcore/node', 'test classes')
};

var copyAndroidTestRunner = function (appRoot) {
  copyFiles(appRoot, '/com/test/thalitest', '/src/com/test/thalitest', 'test runner classes')
};

var copyBuildExtrasGradle = function (appRoot) {
  copyFiles(appRoot, '/build-extras.gradle', '/build-extras.gradle', 'build-extras.gradle');
};

var updateBtconnectorlibVersion = function (appRoot) {
  var sourceFile = path.join(appRoot, 'plugins/org.thaliproject.p2p/src/android/gradle.properties');
  var targetFile = path.join(appRoot, 'platforms/android/gradle.properties');
  try {
    // the target file gradle.properties should not exist
    fs.copySync(sourceFile, targetFile, {"clobber": false});
  } catch (err) {
    console.log(err);
    console.log('Failed to update the gradle.properties file!');
    // Exit the process on this error, because it is a hard requirement for this
    // plugin to get the right btconnectorlib2 version.
    process.exit(-1);
  }
};

var removeInstallFromPlatform = function (appRoot) {
  var installDir = path.join(appRoot, 'platforms/android/assets/www/jxcore/' +
    'node_modules/thali/install');
  fs.removeSync(installDir);
};

/**
 * In case of build with android unit test:
 * 1. Copy unit test files
 * 2. Copy test runner classes
 * 3. Generate test suite
 * 4. Update JXcoreExtension with UT executing method
 * 5. Remove temporary file UTMethod, which contains definition of UT executing method
 * 6. Remove a file indicating UT build
 * @param {Object} appRoot
 */

var copyTestFiles = function (appRoot) {
  var utFlag;
  try {
    utFlag = fs.lstatSync('platforms/android/unittests');
    if (utFlag.isFile()) {
      console.log("Preparing UT test environment");
      copyAndroidTestClasses(appRoot);
      copyAndroidTestRunner(appRoot);
      copyBuildExtrasGradle(appRoot);
      updateTestSuite(appRoot);
      updateJXCoreExtensionWithUTMethod(appRoot);
      try {
        console.log("Removing UT flag");
        fs.removeSync('platforms/android/unittests');
      } catch (err) {
        console.log(err);
        console.log('Failed to remove the UT flag file, continuing anyway');
      }
    }
  } catch (err) {
    console.log('Not a test environment, continue normally.');
  }
};

/**
 * Updates test suite with test classes found in the platforms/android/src/io/jxcore/node,
 * adds required imports.
 * @param {Object} appRoot
 */
var updateTestSuite = function (appRoot) {
  try {
    var i, testClassName;
    var filesArray = fs.readdirSync(path.join(appRoot, 'platforms/android/src/io/jxcore/node'));
    var content = 'package com.test.thalitest;\n' +
      'import org.junit.runner.RunWith;\n' +
      'import org.junit.runners.Suite;';
    var filePath = path.join(appRoot, 'platforms/android/src/com/test/thalitest/ThaliTestSuite.java');
    var runWithAndSuiteClasses = '\n\n@RunWith(Suite.class)\n@Suite.SuiteClasses({';

    for (i = 0; i < filesArray.length; i++) {
      if(filesArray[i].indexOf('Test.java') > -1) {
        testClassName = filesArray[i].replace('.java', '');
        content += '\nimport io.jxcore.node.' + testClassName + ";";
        runWithAndSuiteClasses += testClassName + ".class,";
      }
    }

    runWithAndSuiteClasses = runWithAndSuiteClasses.replace(/,\s*$/, "") + "})";

    content = content + runWithAndSuiteClasses + '\n\npublic class ThaliTestSuite {\n}';
    fs.writeFileSync(filePath, content, 'utf-8');
  } catch (err) {
    console.log(err);
    console.log('Failed to update the test suite file');
    process.exit(-1);
  }
};

/**
 * Updates JXcoreExtension with a method which is used to register the native UT executor.
 * We are doing it because we don't want to mess our production code with our test code
 * so we create a function that dynamically adds method executing tests only when we are
 * actually testing.
 * @param {Object} appRoot
 */

var updateJXCoreExtensionWithUTMethod = function (appRoot) {
  var filePath = path.join(appRoot, 'platforms/android/src/io/jxcore/node/JXcoreExtension.java');
  var content = fs.readFileSync(filePath, 'utf-8');

  content = content.replace("lifeCycleMonitor.start();", "lifeCycleMonitor.start();\n\t\tRegisterExecuteUT.Register();");
  content = content.replace("package io.jxcore.node;", "package io.jxcore.node;\nimport com.test.thalitest.RegisterExecuteUT;");
  fs.writeFileSync(filePath, content, 'utf-8');
};

module.exports = function (context) {
  var appRoot = context.opts.projectRoot;
  updateAndroidSDKVersion(appRoot);
  replaceJXCoreExtension(appRoot);
  updateBtconnectorlibVersion(appRoot);
  copyTestFiles(appRoot);
  removeInstallFromPlatform(appRoot);
};
