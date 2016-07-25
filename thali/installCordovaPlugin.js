'use strict';
var exec = require('child_process').exec;
var path = require('path');

// If we are in the test directory inside of the GitHub Repo then we are trying to do local development
// on the desktop and don't need the Cordova dependencies
var rootDirectory = path.join(__dirname, "../");
if (path.basename(rootDirectory) == "Thali_CordovaPlugin") {
    console.log("We believe we are in a clone of the GitHub Repo so we won't install Cordova dependencies");
    process.exit(0);
}

var installDirectory = path.join(__dirname, 'install');
exec('jx npm install --autoremove "*.gz"', { cwd: installDirectory}, function(error, stdout, stderr) {
   if (error) {
       // In error cases, log all possible debug output
       console.log(stdout);
       console.log(stderr);
       console.log("Could not install dependencies for install directory. - " + error);
       process.exit(1);
   }

   require(installDirectory)(function(err, data) {
       if (err) {
           console.log("Failed with - " + err);
           process.exit(1);
       }
       process.exit(0);
   });
});