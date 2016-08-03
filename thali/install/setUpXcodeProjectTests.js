'use strict';
var child_process = require('child_process');
var path = require("path");
var Promise = require('lie');
var thaliCoreFramework = require("./ios/prepareThaliCoreFramework.js");


var projectPath = process.argv[2];
var thaliProjectFolder = process.argv[3];

thaliCoreFramework.addFramework(projectPath, thaliProjectFolder, true)
  .catch(function(reason) {
    console.log(reason);
  });
