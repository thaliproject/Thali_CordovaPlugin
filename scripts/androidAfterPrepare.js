'use strict';

var Promise = require('lie');
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
function updateAndroidSDKVersion(appRoot) {
   var androidManifestLocation = path.join(appRoot, "platforms/android/AndroidManifest.xml");
   var originalContent = fs.readFileSync(androidManifestLocation).toString();
    // Different version of Cordova use different mins, yes we need to replace this with xpath
   var newContent = originalContent
       .replace("android:minSdkVersion=\"10\"", "android:minSdkVersion=\"19\"")
       .replace("android:minSdkVersion=\"14\"", "android:minSdkVersion=\"19\"");
   fs.writeFileSync(androidManifestLocation, newContent);
}

function replaceJXCoreExtension(appRoot) {

    var sourceFile = path.join(appRoot, "plugins/org.thaliproject.p2p/src/android/java/io/jxcore/node/JXcoreExtension.java");
    var targetFile = path.join(appRoot, "platforms/android/src/io/jxcore/node/JXcoreExtension.java");
    try {
      var sourceContent = fs.readFileSync(sourceFile);
      fs.writeFileSync(targetFile, sourceContent);
    } catch (e) {
      console.log("+++ WARNING +++ Please re-add io.jxcore.node plugin");
    }
}

function removeInstallFromPlatform(appRoot) {
    var installDir = path.join(appRoot, "platforms/android/assets/www/jxcore/node_modules/thali/install");
    return fs.removeAsync(installDir);
}

var appRoot = path.join(__dirname, "../../..");
updateAndroidSDKVersion(appRoot);
replaceJXCoreExtension(appRoot);
removeInstallFromPlatform(appRoot)
.then(function() {
    process.exit(0);
}).catch(function(err) {
    console.log("Android build failed with: " + err);
    process.exit(1);
});   
