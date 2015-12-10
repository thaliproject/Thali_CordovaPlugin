'use strict';

var spawn = require('child_process').spawn;
var path = require('path');

var testToRun = process.argv.length > 2 ? process.argv[2] : 'bv_tests/testThaliReplicationManager.js';
var numberOfInstances = 1;

var testInstances = {};
var spawnTestInstance = function (instanceId) {
  var testInstance = spawn('jx', [testToRun]);
  testInstance.stdout.on('data', function (data) {
    console.log(data + '');
  });
  testInstance.stderr.on('data', function (data) {
    console.log(data + '');
  });
  testInstance.stdout.on('end', function (data) {
    console.log(data + '');
  });
  testInstances[instanceId] = testInstance;
}

for (var i = 0; i < numberOfInstances; i++) {
  spawnTestInstance(i);
}
