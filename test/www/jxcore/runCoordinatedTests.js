'use strict';

var spawn = require('child_process').spawn;

var parseargv = require('minimist');
var argv = parseargv(process.argv.slice(2), {
  default: {
    test: 'UnitTest_app.js',
    filter: null,
    instanceCount: 3,
    serverLogs: true,
    instanceLogs: true
  },
  boolean: ['serverLogs', 'instanceLogs'],
  string: ['test', 'filter']
});
var instanceLogs = {};

var logInstanceOutput = function (data, instanceId) {
  instanceLogs[instanceId] += data;

  if (argv.serverLogs && instanceId === 0) {
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
        shutdown(1);
      }
    } else if (data.indexOf('-== END ==-') >= 0) {
      if (instanceLogs[0].indexOf('RESULT: FAIL') >= 0) {
        console.log('TEST FAILED - SEE ABOVE FOR MORE DETAILS');
        shutdown(1);
      } else {
        shutdown(0);
      }
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
var testServerInstance = spawn('jx', ['../../TestServer/index.js',
  JSON.stringify(testServerConfiguration)]);
setListeners(testServerInstance, 0);

var testInstances = {};
var spawnTestInstance = function (instanceId) {
  var instanceArgs = [argv.test];
  if (argv.filter) {
    instanceArgs.push(argv.filter);
  }
  var testInstance = spawn('jx', instanceArgs);
  setListeners(testInstance, instanceId);
  testInstances[instanceId] = testInstance;
};

for (var i = 1; i <= argv.instanceCount; i++) {
  spawnTestInstance(i);
}

var shutdown = function (code) {
  // A small delay so that instances have time to print
  // the test results.
  setTimeout(function () {
    Object.keys(testInstances).forEach(function (key) {
      testInstances[key].kill();
    });
    testServerInstance.kill();
    process.exit(code);
  }, 100);
};
