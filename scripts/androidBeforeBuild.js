/// <reference path="../typings/node/node.d.ts"/>
'use strict'
var fs = require('fs');
var Promise = require('lie');
var path = require('path');
var promiseUtilities = require('../thali/install/promiseUtilities.js');

/**
 * We've tried various strategies in plugin.xml to set the minimum sdk
 * in the Android manifest to an acceptable value such as uses-sdk in
 * the platform/config section and also the android-minSdkVersion and they do
 * work in that they add an appropriate uses-sdk to AndroidManifest.xml
 * but unfortunately it still leaves the default uses-sdk element set to
 * a min of 10 in there! I'm sure there is some fix but I'm tired of fighting
 * with it so we just force the change.
 */
function updateAndroidSDKVersion(appRoot) {
   var androidManifestLocation = path.join(appRoot, "platforms/android/AndroidManifest.xml");
    return promiseUtilities.readFilePromise(androidManifestLocation)
    .then(function(data) {
        // BUBUG: This is fragile, a single character change and the replace won't work! We should really do a
        // proper XML parse and output.
        var replaceDependency = 
            data.replace("android:minSdkVersion=\"10\"",
                         "android:minSdkVersion=\"19\"");
       return promiseUtilities.writeFilePromise(androidManifestLocation, replaceDependency);        
    });
}

function copyBuildExtras(appRoot) {
    var sourceFile = path.join(appRoot, "plugins/org.thaliproject.p2p/build/build-extras.gradle");
    var targetFile = path.join(appRoot, "/platforms/android/build-extras.gradle");
    return promiseUtilities.overwriteFilePromise(sourceFile, targetFile);
}

function replaceJXCoreExtension(appRoot) {
    var sourceFile = path.join(appRoot, "plugins/org.thaliproject.p2p/src/android/java/io/jxcore/node/JXcoreExtension.java");
    var targetFile = path.join(appRoot, "platforms/android/src/io/jxcore/node/JXcoreExtension.java");
    return promiseUtilities.overwriteFilePromise(sourceFile, targetFile);    
}


function androidUpdates(appRoot) {
    var androidPlatformLocation = path.join(appRoot, "platforms/android");
    if (fs.readdirSync(androidPlatformLocation).indexOf("android") == -1) {
        return Promise.resolve();
    }
    
    return Promise.all([
       updateAndroidSDKVersion(appRoot),
       copyBuildExtras(appRoot),
       replaceJXCoreExtension(appRoot)
    ]); 
}

console.log("PING!");