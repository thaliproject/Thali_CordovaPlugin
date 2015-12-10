'use strict';

var spawn = require('child_process').spawn;
var path = require('path');

var testToRun = process.argv.length > 2 ? process.argv[2] : 'bv_tests/testThaliReplicationManager.js';
var numberOfInstances = process.argv.length > 3 ? process.argv[3] : 1;

var logData = function (data, instanceId) {
  console.log('Instance ' + instanceId + ':');
  console.log(data + '\n');
};

var testInstances = {};
var spawnTestInstance = function (instanceId) {
  var testInstance = spawn('jx', [testToRun]);
  testInstance.stdout.on('data', function (data) {
    logData(data, instanceId);
  });
  testInstance.stderr.on('data', function (data) {
    logData(data, instanceId);
  });
  testInstance.stdout.on('end', function (data) {
    logData(data, instanceId);
  });
  testInstances[instanceId] = testInstance;
}

for (var i = 0; i < numberOfInstances; i++) {
  spawnTestInstance(i);
}
