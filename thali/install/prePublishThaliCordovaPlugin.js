'use strict';
// prePublish gets run on 'npm install' (e.g. even if you aren't actually publishing)
// so we have to check to make sure that we are in our own directory and this isn't
// some poor user trying to install our package.
var path = require('path');
var fs = require('fs');
var rootDirectory = path.join(__dirname, "../../");
if (path.basename(rootDirectory) != "Thali_CordovaPlugin") {
    process.exit(0);
}

var readMeFileName = "readme.md";
var parentReadMe = path.join(__dirname, "../../", readMeFileName);
var localReadMe = path.join(__dirname, "../", readMeFileName);
// We want the project readme to be in our root directory. But when we publish to NPM
// we have to do that from the thali directory which doesn't have the readme.
// The solution is to have this script copy down the readme to the Thali directory,
// do the publish and then have the post install script remove the readme.
fs.writeFileSync(localReadMe, fs.readFileSync(parentReadMe));
process.exit(0);
