'use strict';
var thaliCoreFramework = require('./ios/prepareThaliCoreFramework.js');

var projectPath = process.argv[2];
var thaliProjectFolder = process.argv[3];

thaliCoreFramework.addFramework(projectPath, thaliProjectFolder, true)
  .catch(function (reason) {
    console.log(reason);
  });
