'use strict';
var child_process = require('child_process');
var path = require("path");
var Promise = require('lie');
var thaliCoreFramework = require("./ios/prepareThaliCoreFramework.js");


var thaliProjectFolder = process.argv[0];
var projectPath = process.argv[1]; // path.join(projectRoot, "platforms", "ios", cfg.name() + ".xcodeproj");

thaliCoreFramework.addFramework(projectPath, thaliProjectFolder, true);
