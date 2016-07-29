//
// this code was taken from https://github.com/Justin-Credible/cordova-plugin-braintree/blob/master/hooks/after_plugin_install.js
//

var fs = require("fs");
var path = require("path");
var child_process = require("child_process");

module.exports = function(context) {

    console.log(context.opts.plugin.dir);

    // Temporary hack to run npm install on this plugin's package.json dependencies.
    var pluginDir = path.resolve(__dirname, "../");

    // Need a promise so that the install waits for us to complete our project modifications
    // before the plugin gets installed.
    var Q = context.requireCordovaModule("q");
    var deferral = new Q.defer();

    var platforms = context.opts.cordova.platforms;

    // We can bail out if the iOS platform isn't present.
    if (platforms.indexOf("ios") === -1) {
        deferral.resolve();
        return deferral.promise;
    }

    // Build ThaliCore.framework
    var frameworkOutputfolder = context.opts.plugin.dir + "/lib/ios";
    var projectFolder = context.opts.plugin.dir + "/lib/ios/ThaliCore";
    var projectName = "ThaliCore";
    var projectScheme = "ThaliCoreCITests";
    var projectConfiguration = "Release";
    var sdk = "iphoneos";
    var buildDir = projectFolder + "/build";

    console.log("Building ThaliCore.framework");
    var buildCmd = "xcodebuild -project " +
      "\"" + projectFolder + "/" + projectName + ".xcodeproj" + "\"" +
      " -scheme " + "\"" + projectScheme + "\"" +
      " -configuration " + projectConfiguration +
      " -sdk " + sdk +
      " ONLY_ACTIVE_ARCH=NO " +
      " BUILD_DIR=" + "\"" + buildDir + "\"" +
      " clean build";

    child_process.execSync(buildCmd);

    console.log("Copying ThaliCore.framework");
    child_process.execSync("mkdir -p " + "\"" + frameworkOutputfolder + "\"");

    var copyFrameworkCmd =
      "cp -R " +
      " \"" + buildDir + "/" + projectConfiguration + "-" + sdk + "/" + projectName + ".framework" + "/" + "\"" +
      " \"" + frameworkOutputfolder + "/" + "\"" ;

    child_process.execSync(copyFrameworkCmd);

    deferral.resolve();
    return deferral.promise;
};
