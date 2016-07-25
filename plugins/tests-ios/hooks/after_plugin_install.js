//
// this code was taken from https://github.com/Justin-Credible/cordova-plugin-braintree/blob/master/hooks/after_plugin_install.js
//

var fs = require("fs");
var path = require("path");
var child_process = require("child_process");

module.exports = function(context) {

    // Temporary hack to run npm install on this plugin's package.json dependencies.
    var pluginDir = path.resolve(__dirname, "../");

    child_process.execSync("npm --prefix " + pluginDir + " install " + pluginDir);
    var xcode = require("xcode");

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

    // We need to embded frameworks to the project here.
    // They need to be embedded binaries and cordova does not yet support that.
    // We will use node-xcode directy to add them since that library has
    // been upgraded to support embedded binaries.

    // Cordova libs to get the project path and project name so we can locate the xcode project file.
    var cordova_util = context.requireCordovaModule("cordova-lib/src/cordova/util"),
        ConfigParser = context.requireCordovaModule("cordova-lib").configparser,
        projectRoot = cordova_util.isCordova(),
        xml = cordova_util.projectConfig(projectRoot),
        cfg = new ConfigParser(xml);

    var projectPath = path.join(projectRoot, "platforms", "ios", cfg.name() + ".xcodeproj", "project.pbxproj");
    var xcodeProject = xcode.project(projectPath);

    xcodeProject.parse(function(err) {

        // If we couldn't parse the project, bail out.
        if (err) {
            deferral.reject("ThaliPluginTests - after_plugin_install: " + JSON.stringify(err));
            return;
        }

        // Cordova project should not have more that one target.
        var targetUUID = xcodeProject.getFirstTarget().uuid;

        // Remove all of the frameworks because they were not embeded correctly.
        var frameworkPath = cfg.name() + "/Plugins/org.thaliproject.p2p-tests/";
        xcodeProject.removeFramework(frameworkPath + "XCTest.framework");

        // First check to see if the Embed Framework node exists, if not, add it.
        // This is all we need to do as they are added to the embedded section by default.
        if (!xcodeProject.pbxEmbedFrameworksBuildPhaseObj(targetUUID)) {
            buildPhaseResult = xcodeProject.addBuildPhase([], "PBXCopyFilesBuildPhase", "Embed Frameworks", targetUUID,  "framework");
            // No idea why, but "Framework" (value 10) is not available in node-xcode, set it here manually so libraries
            // embed correctly.  If we don't set it, the folder type defaults to "Shared Frameworks".
            buildPhaseResult.buildPhase.dstSubfolderSpec = 10;
            console.log("Adding Embedded Build Phase");
        } else {
            console.log("Embedded Build Phase already added");
        }

        // This is critical to include, otherwise the library loader cannot find the dynamic Braintree libs at runtime
        // on a device.
        xcodeProject.addBuildProperty("LD_RUNPATH_SEARCH_PATHS", "\"$(inherited) @executable_path/Frameworks\"", "Debug");
        xcodeProject.addBuildProperty("LD_RUNPATH_SEARCH_PATHS", "\"$(inherited) @executable_path/Frameworks\"", "Release");

        // Add the frameworks again.  This time they will have the code-sign option set so they get code signed when being deployed to devices.
        xcodeProject.addFramework(frameworkPath + "XCTest.framework", {customFramework: true, embed: true, link: true});

        // Save the project file back to disk.
        fs.writeFileSync(projectPath, xcodeProject.writeSync(), "utf-8");
        deferral.resolve();
    });

    return deferral.promise;
};
