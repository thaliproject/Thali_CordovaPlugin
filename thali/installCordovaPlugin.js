//Script to install the Thali_CordovaPlugin to Cordova project

var exec = require('child_process').exec;
var path = require('path');
var currentFolder = process.cwd();

String.prototype.endsWith = function(suffix) {
    return this.indexOf(suffix, this.length - suffix.length -1) !== -1;
};
var jxcoreFolder = path.join(__dirname, '../../' );
console.log(jxcoreFolder);
if(!jxcoreFolder.endsWith('jxcore')) {
    console.log('Could not locate JXCore folder. Exiting the thali plugin installation..');
    return;
}
//get the app root folder from app/www/jxcore/node_modules/thali
var rootFolder = path.join(__dirname, '../../../../' );
process.chdir(rootFolder);

console.log('Adding the Thali_CordovaPlugin...');

//TODO: Once we have the stable version in master, uncomment the following, and remove the code below (git clone)
/*
 exec('cordova plugin add https://github.com/thaliproject/Thali_CordovaPlugin'),
 function (error, stdout, stderr) {
 console.log('Thali_CordovaPlugin plugin added successfully.......')
 if (error !== null) {
 console.log('Thali_CordovaPlugin install error: ' + error);
 }
 });
 */

exec('git clone -b story_0_sree --single-branch https://github.com/thaliproject/Thali_CordovaPlugin.git',
    function (error, stdout, stderr) {
        exec('cordova plugin add Thali_CordovaPlugin',
            function (error, stdout, stderr) {
                console.log('Thali_CordovaPlugin plugin added successfully.......')
                if (error !== null) {
                    console.log('Thali_CordovaPlugin install error: ' + error);
                }
            });
        if (error !== null) {
            console.log('Thali_CordovaPlugin git clone error: ' + error);
        }
    });

process.chdir(currentFolder);
