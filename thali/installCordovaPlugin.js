'use strict';
var exec = require('child_process').exec;
var path = require('path');

var installDirectory = path.join(__dirname, 'install');
exec('jx npm install', { cwd: installDirectory}, function(error, stdout, stderr) {
   if (error) {
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