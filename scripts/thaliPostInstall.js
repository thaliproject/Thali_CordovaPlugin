#!/usr/bin/env node
'use strict';
//ThaliCordova_Plugin post installation script

var fs = require('fs');
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;
var path = require('path');

var rootdir = process.argv[2];
//Dummy file to prevent the execution of this script when the developer adds other Cordova plugins
var dummyFile = path.join(rootdir, '/../plugins/org.thaliproject.p2p/dummy.js');

function createDummyFile(){
    console.log('Completed the Thali_Cordova plugin postInstallation script..');
    fs.writeFileSync(dummyFile, '', 'utf8');
};

//TODO: This is temporary fix, and we don't reqiure it once the version update PR available
//Update the Android SDK version
// ..\platforms\android and in AndroidManifest.xml change android:minSdkVersion="10" to android:minSdkVersion="16"
function updateAndroidSDKVersion() {
    var to_replace = 'android:minSdkVersion=\"10\"';
    var replace_with = 'android:minSdkVersion=\"16\"';
    var filename = path.join(rootdir, '/../platforms/android/AndroidManifest.xml');
    var data = fs.readFileSync(filename, 'utf8');
    var result = data.replace(new RegExp(to_replace, "g"), replace_with);
    try {
        fs.writeFileSync(filename, result, 'utf8');
        createDummyFile();
    }
    catch(ex){
        console.log('Could not update the Android SDK version in Manifest' + ex.message);
        return;
    }
};

function copyBuildExtras(){
    console.log('Copying the build-extras.gradle to platform..');
    var sourceFile =  rootdir + '/../plugins/org.thaliproject.p2p/build/build-extras.gradle';
    var targetFile = rootdir + '/../platforms/android/build-extras.gradle';
    fs.writeFileSync(targetFile, fs.readFileSync(sourceFile));
    updateAndroidSDKVersion();
};

function replaceJXCoreExtension(){
    console.log('Replacing JXcoreExtension.java..');
    var sourceFile =  path.join(rootdir + '/../plugins/org.thaliproject.p2p/src/android/java/io/jxcore/node/JXcoreExtension.java');
    var targetFile = path.join(rootdir + '/../platforms/android/src/io/jxcore/node/JXcoreExtension.java');
    fs.writeFileSync(targetFile, fs.readFileSync(sourceFile));
};

module.exports = function () {
    if (!fs.existsSync(dummyFile))    {
        console.log('Starting the Thali_Cordova plugin post install script..');

        /* sequence of async calls
         updateJXCore();
         replaceJXCoreExtension();
         copyBuildExtras();
         updateAndroidSDKVersion();
         createDummyFile();
         */

    }
    else
        return;
};


