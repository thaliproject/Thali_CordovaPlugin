'use strict';

var fs = require('fs-extra-promise');
var path = require('path');

// jscs:disable jsDoc
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
// jscs:enable jsDoc
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

var replaceJXCore = function (appRoot) {
  var sourceFile = path.join(appRoot, 'plugins/org.thaliproject.p2p/src/' +
    'android/test/io/jxcore/node/jxcore.java');
  var targetFile = path.join(appRoot, 'platforms/android/src/io/jxcore/node' +
    '/jxcore.java');
  try {
    console.log("replace JXCore file");
    var sourceContent = fs.readFileSync(sourceFile);
    fs.writeFileSync(targetFile, sourceContent);
  } catch (e) {
    console.log(e);
    console.log('Failed to update the jxcore.java file!');
    console.log('Please make sure plugins org.thaliproject.p2p and ' +
      'io.jxcore.node are installed.');
    process.exit(-1);
  }
};

var copyFiles = function(appRoot, source, target, message) {
  var sourceFile = path.join(appRoot, 'plugins/org.thaliproject.p2p/src/android/test' + source);
  var targetFile = path.join(appRoot, 'platforms/android' + target);
  
  try {
    console.log('Copying ' + message);
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

// jscs:disable jsDoc
/**
 * In case of build with android unit test:
 * 1. Replaces jxcore.java with the modified version containing execution of unit tests.
 * 2. Copy unit test files
 * 3. Copy test runner classes
 * 4. Remove a file indicating UT build
 * @param {Object} appRoot
 */
// jscs:enable jsDoc
var copyTestFiles = function (appRoot) {
  try {
    var st = fs.lstatSync('platforms/android/unittests');
    if (st.isFile()) {
      console.log("Preparing UT test environment");
      replaceJXCore(appRoot);
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

var updateTestSuite = function (appRoot) {
  var testClassesPath = path.join(appRoot, 'platforms/android/src/io/jxcore/node');
  var filesArray = fs.readdirSync(testClassesPath);
  var testFilesAsArray = [];
  var testFilesAsString = '';
  var packageStr = 'package com.test.thalitest;\n';
  var importRunWith = '\nimport org.junit.runner.RunWith;';
  var importSuite = '\nimport org.junit.runners.Suite;';
  var importTemplate = '\nimport io.jxcore.node.';
  var imports = '';
  var filePath = path.join(appRoot, 'platforms/android/src/com/test/thalitest/ThaliTestSuite.java');
  var publicClassThaliTestSuite = '\n\npublic class ThaliTestSuite {\n}';
  var runWithAndSuiteClasses = '\n\n@RunWith(Suite.class)\n@Suite.SuiteClasses({';

  for(var i in filesArray){
     if(filesArray[i].indexOf('Test') > -1){
        testFilesAsArray.push(filesArray[i].replace('.java', ''));
	   }
  }

  for(var i in testFilesAsArray){
	   if(i < testFilesAsArray.length - 1){
	       testFilesAsString += '\n\t' + testFilesAsArray[i] + '.class,';
	   } else{
	       	testFilesAsString += '\n\t' + testFilesAsArray[i] + '.class';
     }
	   imports += importTemplate + testFilesAsArray[i] + ';';
  }

  var data = packageStr + importRunWith + importSuite + imports + runWithAndSuiteClasses + testFilesAsString + '})' + publicClassThaliTestSuite;
  fs.writeFileSync(filePath, data, 'utf-8');
};

var updateJXCoreExtensionWithUTMethod = function (appRoot) {
  var filePath = path.join(appRoot, 'platforms/android/src/io/jxcore/node/JXcoreExtension.java');
  var dataFromJXCoreExtension = fs.readFileSync(filePath, 'utf-8');
  var lastIndex = dataFromJXCoreExtension.lastIndexOf('}');
  var dataFromJXCoreExtensionWithoutLastBrace = dataFromJXCoreExtension.substring(0, lastIndex); 
  var codeToAttach = fs.readFileSync(path.join(appRoot, 'platforms/android/src/com/test/thalitest/UTMethod'));
  var result = dataFromJXCoreExtensionWithoutLastBrace + codeToAttach + '\n}';
  
  fs.writeFileSync(filePath, result, 'utf-8');
  
  try {
        console.log("Removing UTMethod");
        fs.removeSync('platforms/android/src/com/test/thalitest/UTMethod');
      } catch (err) {
        console.log(err);
        console.log('Failed to remove the UTMethod file, continuing anyway');
      }
};

module.exports = function (context) {
  var appRoot = context.opts.projectRoot;
  updateAndroidSDKVersion(appRoot);
  replaceJXCoreExtension(appRoot);
  updateBtconnectorlibVersion(appRoot);
  copyTestFiles(appRoot);
  removeInstallFromPlatform(appRoot);
};
