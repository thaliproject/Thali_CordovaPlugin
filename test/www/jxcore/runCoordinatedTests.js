'use strict';

var spawn = require('child_process').spawn;

var DEFAULT_INSTANCE_COUNT = 3;

var parseargv = require('minimist');
var argv = parseargv(process.argv.slice(2), {
  default: {
    test: 'UnitTest_app.js',
    filter: null,
    instanceCount: DEFAULT_INSTANCE_COUNT,
    serverLogs: true,
    instanceLogs: true,
    waitForInstance: false,
    showFailedLog: false
  },
  boolean: [
    'serverLogs',
    'instanceLogs',
    'waitForInstance',
    'showFailedLog'
  ],
  string: ['test', 'filter']
});

var spawnedInstanceCount = argv.instanceCount;
if (argv.waitForInstance) {
  spawnedInstanceCount = spawnedInstanceCount - 1;
}

var instanceLogs = {};

var logInstanceOutput = function (data, instanceId) {
  instanceLogs[instanceId] += data;

  if (argv.serverLogs && instanceId === 0) {
    jxcore.utils.console.log(data + '');
  } else if (argv.instanceLogs) {
    var colors = [
      'green',
      'cyan',
      'yellow',
      'magenta',
      'grey'
    ];

    // Use grey color for instances that don't have
    // own color in the colors array.
    var color = instanceId <= colors.length ?
      instanceId - 1 : colors.length-1;

    jxcore.utils.console.log(data + '', colors[color]);

  }
};

var setListeners = function (instance, instanceId) {
  instanceLogs[instanceId] = '';

  instance.stdout.on('data', function (data) {
    logInstanceOutput(data, instanceId);

    if (data.indexOf('PROCESS_ON_EXIT_') >= 0) {
      if (data.indexOf('PROCESS_ON_EXIT_FAILED') >= 0) {
        if (argv.showFailedLog) {
          console.log(instanceLogs[instanceId]);
        }
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
  'honorCount': true,
  userConfig: {
    ios: {
      numDevices: argv.instanceCount
    },
    android: {
      numDevices: 0
    }
  }
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

for (var i = 1; i <= spawnedInstanceCount; i++) {
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
