#!/usr/bin/env node
/*
This script will do the following tasks
1. Add the Android platform
2. Fix manifest min-sdk issue
3. Fix issue on "can not replace existing file"
4. Install the thali node module to global (until we get thali in npm repo)
5: Create a dummy file to prevent future execution by other plugin add operation
 */


var fs = require('fs');
var exec = require('child_process').execSync;

var rootdir = process.argv[2];
//Dummy file to prevent the execution of this script when the developer add other Cordova plugins
var dummyFile = rootdir + '/../plugins/org.thaliproject.p2p/dummy.js';

//Update the Android SDK version
// ..\platforms\android and in AndroidManifest.xml change android:minSdkVersion="10" to android:minSdkVersion="16"
function updateAndroidSDKVersion() {
    var to_replace = 'android:minSdkVersion=\"10\"';
    var replace_with = 'android:minSdkVersion=\"16\"';
    var filename = rootdir + '/../platforms/android/AndroidManifest.xml';
    var data = fs.readFileSync(filename, 'utf8');
    var result = data.replace(new RegExp(to_replace, "g"), replace_with);
    fs.writeFileSync(filename, result, 'utf8');
}

//Replace JXcoreExtension.java
//Copy from \plugins\org.thaliproject.p2p\src\android\java\io\jxcore\node to \platforms\android\src\io\jxcore\node
function replaceJXCoreExtension(){
    var sourceFile =  rootdir + '/../plugins/org.thaliproject.p2p/src/android/java/io/jxcore/node/JXcoreExtension.java';
    var targetFile = rootdir + '/../platforms/android/src/io/jxcore/node/JXcoreExtension.java';
    fs.writeFileSync(targetFile, fs.readFileSync(sourceFile));
}

//Check whether this is the first time this script is getting executed or not
//When ever this script run, it creates the dummyfile at the end of execution
function isFirstTime(){
    if (fs.existsSync(dummyFile))
        return false;
    else
        return true;
}
//Install thali node modules to global
//once we have the thali module available in npm repo, this is step is not required
function installThaliModules(){
    var thaliPath = rootdir + '/../plugins/org.thaliproject.p2p/thali';
    var currentFolder = process.cwd();
    process.chdir(thaliPath);
    //exec('jx install -g --autoremove "*.gz"'); // https://github.com/jxcore/jxcore/issues/429
    exec('jx install -g');
    process.chdir(currentFolder);
}

if(isFirstTime())
    console.log('Starting the Thali_Cordova plugin pre-requisites configuration..');
else
    return;

//1. Add the Android platform
console.log('Adding Android platform..');
try {
    exec("cordova platform add android");
}
catch(ex){
    console.log(ex.message);
}

 //2. Fix manifest min-sdk issue
console.log('Updating the SDK version in AndroidManifest in Android platform..');
updateAndroidSDKVersion();

//3. Fix issue on "can not replace existing file"
console.log('Replacing JXcoreExtension.java..');
replaceJXCoreExtension();

//4. Install the thali node module to global (until we get thali in npm repo)
console.log('Installing thali node modules to global..');
installThaliModules();

console.log('Completed the Thali_Cordova plugin Pre-requisites configuration..');
//Creating a dummy file to prevent the future execution of the entire script
fs.writeFileSync(dummyFile, '', 'utf8');


