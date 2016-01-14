'use strict';

var spawn = require('child_process').spawn;
var path = require('path');
var thaliTape = require('./lib/thali-tape.js');

var TEST_TO_RUN = process.argv.length > 2 ? process.argv[2] : 'UnitTest_app.js';
var NUMBER_OF_INSTANCES = process.argv.length > 3 ? process.argv[3] : 2;
var LOG_TEST_SERVER = true;
var LOG_INSTANCES = false;

var logInstanceOutput = function (data, instanceId) {
  if (LOG_TEST_SERVER && instanceId === null) {
    console.log(data + '\n');
  } else if (LOG_INSTANCES) {
    console.log('Instance ' + instanceId + ':');
    console.log(data + '\n');
  }
};

var setListeners = function (instance, instanceId) {
  instance.stdout.on('data', function (data) {
    logInstanceOutput(data, instanceId);
  });
  instance.stderr.on('data', function (data) {
    logInstanceOutput(data, instanceId);
  });
  instance.stdout.on('end', function (data) {
    logInstanceOutput(data, instanceId);
  });
};

var testServerConfiguration = {
  'devices': {
    'android': 0,
    'ios': NUMBER_OF_INSTANCES
  },
  'honorCount': true
};
var testServerInstance = spawn('jx', ['../../TestServer/index.js', JSON.stringify(testServerConfiguration)]);
setListeners(testServerInstance, null);

var testInstances = {};
var spawnTestInstance = function (instanceId) {
  var testInstance = spawn('jx', [TEST_TO_RUN]);
  setListeners(testInstance, instanceId);
  testInstances[instanceId] = testInstance;
};

for (var i = 0; i < NUMBER_OF_INSTANCES; i++) {
  spawnTestInstance(i);
}
