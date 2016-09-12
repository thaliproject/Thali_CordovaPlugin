'use strict';
var exec = require('child_process').exec;
var path = require('path');

// If we are in the test directory inside of the GitHub Repo then we are trying
// to do local development on the desktop and don't need the Cordova
// dependencies
var rootDirectory = path.join(__dirname, '../');
if (path.basename(rootDirectory) === 'Thali_CordovaPlugin') {
  console.log('We believe we are in a clone of the GitHub Repo so we will not '+
              'install Cordova dependencies');
  process.exit(0);
}

// First check that the installation is done to a Cordova project
exec('cordova info', function (error) {
  if (error) {
    console.log('The installation directory does not seem to be a Cordova ' +
                'project and currently the installation is supported only to ' +
                'Cordova apps. Please see further information from:');
    console.log('https://github.com/thaliproject/Thali_CordovaPlugin');
    process.exit(1);
  }
  var installDirectory = path.join(__dirname, 'install');
  exec('npm install --no-optional --production & find . -name "*.gz" -delete',
        { cwd: installDirectory },
    function (error, stdout, stderr) {
      // Log the output in all cases since it might contain useful
      // debugging information.
      if (stdout) { console.log(stdout); }
      if (stderr) { console.log(stderr); }

      if (error) {
        console.log('Could not install dependencies for install directory. - ' +
                    error);
        process.exit(1);
      }

      require(installDirectory)(function (err) {
        if (err) {
          console.log('Failed with - ' + err);
          process.exit(1);
        }
        process.exit(0);
      });
    });
});
