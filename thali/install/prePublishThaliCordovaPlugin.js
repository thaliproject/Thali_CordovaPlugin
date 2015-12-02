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
fs.writeFileSync(localReadMe, fs.readFileSync(parentReadMe));
process.exit(0);
