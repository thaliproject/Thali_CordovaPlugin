'use strict';
var path = require('path');
// prePublish gets run on 'npm install' (e.g. even if you aren't actually publishing)
// so we have to check to make sure that we are in our own directory and this isn't
// some poor user trying to install our package.
var fs = require('fs');
if (!fs.existsSync(path.join(__dirname, "../../../Thali_CordovaPlugin"))) {
    process.exit(0);
}

var fs = require('fs-extra-promise');
var readMeFileName = "readme.md";
var parentReadMe = path.join(__dirname, "../../", readMeFileName);
var localReadMe = path.join(__dirname, "../", readMeFileName);
fs.copyAsync(parentReadMe, localReadMe, { clobber: true})
.then(function() {
   process.exit(0);
}).catch(function(err) {
   console.log("prePublishThaliCordova caught error " + err);
   process.exit(1);
});