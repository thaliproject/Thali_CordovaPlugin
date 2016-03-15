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
 */
var updateAndroidSDKVersion = function (appRoot) {
  var androidManifestLocation = path.join(appRoot, 'platforms/android/AndroidManifest.xml');
  var originalContent = fs.readFileSync(androidManifestLocation).toString();
  // Different version of Cordova use different mins, yes we need to replace this with xpath
  var newContent = originalContent
    .replace('android:minSdkVersion="10"', 'android:minSdkVersion="21"')
    .replace('android:minSdkVersion="14"', 'android:minSdkVersion="21"');
  fs.writeFileSync(androidManifestLocation, newContent);
};

var replaceJXCoreExtension = function (appRoot) {
  var sourceFile = path.join(appRoot, 'plugins/org.thaliproject.p2p/src/android/java/io/jxcore/node/JXcoreExtension.java');
  var targetFile = path.join(appRoot, 'platforms/android/src/io/jxcore/node/JXcoreExtension.java');
  try {
    var sourceContent = fs.readFileSync(sourceFile);
    fs.writeFileSync(targetFile, sourceContent);
  } catch (e) {
    console.log(e);
    console.log('Failed to update the JXcoreExtension.java file!');
    console.log('Please make sure plugins org.thaliproject.p2p and io.jxcore.node are installed.');
    // Exit the process on this error, because it is a hard requirement for this
    // plugin to get the right JXcoreExtension.java or otherwise there will be
    // a build error when the app is tried to be built.
    process.exit(-1);
  }
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
  var installDir = path.join(appRoot, 'platforms/android/assets/www/jxcore/node_modules/thali/install');
  fs.removeSync(installDir);
};

module.exports = function (context) {
  var appRoot = context.opts.projectRoot;
  updateAndroidSDKVersion(appRoot);
  replaceJXCoreExtension(appRoot);
  updateBtconnectorlibVersion(appRoot);
  removeInstallFromPlatform(appRoot);
};
