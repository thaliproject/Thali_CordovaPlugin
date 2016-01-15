'use strict';

var spawn = require('child_process').spawn;
var path = require('path');
var thaliTape = require('./lib/thali-tape.js');

var parseargv = require('minimist');
var argv = parseargv(process.argv.slice(2), {
  default: {
    test: 'UnitTest_app.js',
    instanceCount: 2,
    serverLogs: true,
    instanceLogs: false
  }
});

var instanceLogs = {};

var logInstanceOutput = function (data, instanceId) {
  instanceLogs[instanceId] += data;

  if (argv.serverLogs && instanceId === null) {
    console.log(data + '\n');
  } else if (argv.instanceLogs) {
    console.log('Instance ' + instanceId + ':');
    console.log(data + '\n');
  }
};

var setListeners = function (instance, instanceId) {
  instanceLogs[instanceId] = '';

  instance.stdout.on('data', function (data) {
    logInstanceOutput(data, instanceId);

    if (data.indexOf('PROCESS_ON_EXIT_') >= 0) {
      if (data.indexOf('PROCESS_ON_EXIT_FAILED') >= 0) {
        console.log(instanceLogs[instanceId]);
      }
      shutdown(1);
    } else if (data.indexOf('-== END ==-') >= 0) {
      shutdown(0);
    }
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
    'ios': argv.instanceCount
  },
  'honorCount': true
};
var testServerInstance = spawn('jx', ['../../TestServer/index.js', JSON.stringify(testServerConfiguration)]);
setListeners(testServerInstance, null);

var testInstances = {};
var spawnTestInstance = function (instanceId) {
  var testInstance = spawn('jx', [argv.test]);
  setListeners(testInstance, instanceId);
  testInstances[instanceId] = testInstance;
};

for (var i = 0; i < argv.instanceCount; i++) {
  spawnTestInstance(i);
}

var shutdown = function (code) {
  Object.keys(testInstances).forEach(function (key) {
    testInstances[key].kill();
  });
  testServerInstance.kill();
  process.exit(code);
};
