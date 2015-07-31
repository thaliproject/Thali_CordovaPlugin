'use strict'
var exec = require('child_process').exec;
var path = require('path');

// We can't be sure that jx install was ever run inside the install directory, so
// we have to do it ourselves.
exec('jx npm install', { cwd: "."}, function(error, stdout, stderr) {
   if (error) {
       console.log("Could not install dependencies for install directory. - " + error);
       process.exit(1);
       return;
   } 
   
   var fs = require('fs-extra-promise');
   var readMeFileName = "README.md";
   var parentReadMe = path.join(__dirname, "..", readMeFileName);
   var localReadMe = path.join(__dirname, readMeFileName);
   fs.copyAsync(parentReadMe, localReadMe, { clobber: true})
   .then(function() {
       process.exit(0);
   }).catch(function(err) {
       console.log("prePublishThaliCordova caught error " + err);
       process.exist(1);
   })
});