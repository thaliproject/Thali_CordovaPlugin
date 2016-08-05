//
// The MIT License (MIT)
//
// Copyright (c) 2016 Justin Unterreiner
//
// Permission is hereby granted, free of charge, to any person obtaining a copy
// of this software and associated documentation files (the "Software"), to deal
// in the Software without restriction, including without limitation the rights
// to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
// copies of the Software, and to permit persons to whom the Software is
// furnished to do so, subject to the following conditions:
//
// The above copyright notice and this permission notice shall be included in all
// copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
// IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
// FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
// AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
// LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
// OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
// SOFTWARE.
//
//
// this code was adapted from https://github.com/Justin-Credible/cordova-plugin-braintree/blob/master/hooks/after_plugin_install.js
//

'use strict';
var path = require('path');
var thaliCoreFramework = require('../ios/prepareThaliCoreFramework.js');

module.exports = function(context) {

    // Need a promise so that the install waits for us to complete our project modifications
    // before the plugin gets installed.
    var Q = context.requireCordovaModule('q');
    var deferred = new Q.defer();

    // Only bother if we're on macOS
    if (process.platform !== 'darwin') {
        deferred.resolve();
        return deferred.promise;
    }

    var platforms = context.opts.cordova.platforms;

    // We can bail out if the iOS platform isn't present.
    if (platforms.indexOf('ios') === -1) {
        deferred.resolve();
        return deferred.promise;
    }

    // We need to build ThaliCore.framework before embedding it into the project

    var thaliProjectFolder = path.join(context.opts.plugin.dir, "lib", "ios", "ThaliCore");

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

    var projectPath = path.join(projectRoot, "platforms", "ios", cfg.name() + ".xcodeproj");

    return thaliCoreFramework.addFramework(projectPath, thaliProjectFolder, false);
};
