#!/usr/bin/env node

//ThaliCordova_Plugin post installation script

var fs = require('fs');
var exec = require('child_process').exec;
var spawn = require('child_process').spawn;
var path = require('path');

var rootdir = process.argv[2];
//Dummy file to prevent the execution of this script when the developer add other Cordova plugins
var dummyFile = path.join(rootdir, '/../plugins/org.thaliproject.p2p/dummy.js');


//Create a dummy file to prevent the future execution of this script
function createDummyFile(){
    console.log('Completed the Thali_Cordova plugin postInstallation script..');
    fs.writeFileSync(dummyFile, '', 'utf8');
}

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
}

//Copy the build-extras.gradle
//Copy from \plugins\org.thaliproject.p2p\build to \platforms\android
function copyBuildExtras(){
    console.log('Copying the build-extras.gradle to platform..');
    var sourceFile =  rootdir + '/../plugins/org.thaliproject.p2p/build/build-extras.gradle';
    var targetFile = rootdir + '/../platforms/android/build-extras.gradle';
    fs.writeFileSync(targetFile, fs.readFileSync(sourceFile));
    updateAndroidSDKVersion();
}

//Install thali node modules to global
//once we have the thali module available in npm repo, this is step is not required
function installThaliModules(){
    console.log('Installing thali node modules to global..');
    var thaliPath = path.join(rootdir + '/../plugins/org.thaliproject.p2p/thali');
    var currentFolder = process.cwd();
    process.chdir(thaliPath);
    //exec('jx install -g --autoremove "*.gz"'); // https://github.com/jxcore/jxcore/issues/429
    exec('jx install -g',
        function (error, stdout, stderr) {
            process.chdir(currentFolder);
            copyBuildExtras();
            if (error !== null) {
                console.log('jx install failed ' + error);
                return;
            }
        }
    );
}


//Replace JXcoreExtension.java
//Copy from \plugins\org.thaliproject.p2p\src\android\java\io\jxcore\node to \platforms\android\src\io\jxcore\node
function replaceJXCoreExtension(){
    console.log('Replacing JXcoreExtension.java..');
    var sourceFile =  path.join(rootdir + '/../plugins/org.thaliproject.p2p/src/android/java/io/jxcore/node/JXcoreExtension.java');
    var targetFile = path.join(rootdir + '/../platforms/android/src/io/jxcore/node/JXcoreExtension.java');
    fs.writeFileSync(targetFile, fs.readFileSync(sourceFile));
    installThaliModules();
}

//TODO: This is a temporary fix, and we don't require this method once we get the JXCore fix in master
//Uncomment the dependency section in plugin.xml while removing this method
// Update the jxcore-cordova plugin from the working branch
function updateJXCore(){
    console.log('Updating JXcore-Cordova..');
    console.log('Cloning the jxcore-cordova repo (385MB size)..it might take a while. Please be patient..');
    var gitProcess = spawn('git', ['clone', '-b', '0.0.3-dev', '--single-branch', 'https://github.com/jxcore/jxcore-cordova.git']);
    gitProcess.stdout.on('data', function(data){
        console.log(data);
    });
    gitProcess.stdout.on('close', function(data) {
        exec('cordova plugin add jxcore-cordova',
            function (error, stdout, stderr) {
                console.log('Added the jxcore-corodva plugin..');
                replaceJXCoreExtension();
                if (error !== null) {
                    console.log('jxcore-cordova plugin add error ' + ex.message);
                    return;
                }
            }
        );
    });

}

module.exports = function () {
    if (!fs.existsSync(dummyFile))    {
        console.log('Starting the Thali_Cordova plugin post install script..');

        updateJXCore();

        /* sequence of async calls
         updateJXCore();
         replaceJXCoreExtension();
         installThaliModules();
         copyBuildExtras();
         updateAndroidSDKVersion();
         createDummyFile();
         */

    }
    else
        return;
};


