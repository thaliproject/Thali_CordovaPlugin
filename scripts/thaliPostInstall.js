#!/usr/bin/env node

//ThaliCordova_Plugin post installation script

var fs = require('fs');
var exec = require('child_process').execSync;
var path = require('path');

var rootdir = process.argv[2];
//Dummy file to prevent the execution of this script when the developer adds other Cordova plugins
var dummyFile = path.join(rootdir, '/../plugins/org.thaliproject.p2p/dummy.js');

//Replace JXcoreExtension.java
function replaceJXCoreExtension(){
    var sourceFile =  path.join(rootdir + '/../plugins/org.thaliproject.p2p/src/android/java/io/jxcore/node/JXcoreExtension.java');
    var targetFile = path.join(rootdir + '/../platforms/android/src/io/jxcore/node/JXcoreExtension.java');
    fs.writeFileSync(targetFile, fs.readFileSync(sourceFile));
}

//Install thali node modules to global
//once we have the thali module available in npm repo, this is step is not required
function installThaliModules(){
    var thaliPath = path.join(rootdir + '/../plugins/org.thaliproject.p2p/thali');
    var currentFolder = process.cwd();
    process.chdir(thaliPath);
    //exec('jx install -g --autoremove "*.gz"'); // https://github.com/jxcore/jxcore/issues/429
    exec('jx install -g');
    process.chdir(currentFolder);
}


//TODO: This is a temporary fix, and we don't require this method once we get the JXCore fix in master
//Update the plugin.xml with jxcore dependency and get rid of this function all together.
function updateJXCore(){
    console.log('Cloning the jxcore-cordova repo (380MB size)..it might take a while. Please be patient..');
    try {
        exec('git clone -b 0.0.3-dev --single-branch https://github.com/jxcore/jxcore-cordova.git');
    }
    catch(ex)
    {
        console.log('jxcore-cordova git clone failed... ' + ex.message);
    }
    if (fs.existsSync('jxcore-cordova')){
        console.log('Proceeding with already existing jxcore-cordova folder..');
        // Another temporary fix to prevent this script from getting called during the following 'plugin add'
        fs.writeFileSync(dummyFile, '', 'utf8');
        try{
            exec('cordova plugin add jxcore-cordova');
        }
        catch(ex){
            console.log('jxcore-cordova plugin add error ' + ex.message);
            return;
        }
    }
    else{
        console.log('Aborting the script execution because jxcore-cordova folder not found.. ');
        return;
    }

}

//Copy the build-extras.gradle
//Copy from \plugins\org.thaliproject.p2p\build to \platforms\android
function copyBuildExtras(){
    var sourceFile =  path.join(rootdir, '/../plugins/org.thaliproject.p2p/build/build-extras.gradle');
    var targetFile = path.join(rootdir,  '/../platforms/android/build-extras.gradle');
    fs.writeFileSync(targetFile, fs.readFileSync(sourceFile));
}

module.exports = function () {

    if (!fs.existsSync(dummyFile))
        console.log('Starting the Thali_Cordova plugin post installation script.');
    else
        return;

    //Update the jxcore-cordova plugin from the working branch
    console.log('Updating JXcore-Cordova..');
    updateJXCore();

    //Fix issue on "can not replace existing file"
    console.log('Replacing JXcoreExtension.java..');
    replaceJXCoreExtension();

    // Move the build-extras.gradle to platform
    console.log('Copying the build-extras.gradle to platform..');
    copyBuildExtras();

    //Install the thali node module to global (until we get thali in npm repo)
    console.log('Installing thali node modules to global..');
    installThaliModules();

    //Creating a dummy file to prevent the future execution of the entire script
    console.log('Completed the Thali_Cordova plugin post installation script');
    fs.writeFileSync(dummyFile, '', 'utf8');

};


