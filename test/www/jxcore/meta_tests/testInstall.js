'use strict';

var install = require('../../../../thali/install/install.js');
var tape = require('../lib/thaliTape');
var testUtils = require('../lib/testUtils.js');
var exec = require('child_process').exec;
var path = require('path');

var test = tape({
  setup: function(t) {
    t.end();
  },
  teardown: function(t) {
    t.end();
  }
});

test('two required plugins should get installed', function (t) {
  var tmpDirectory = testUtils.tmpDirectory();
  var testAppName = 'TestApp';
  var testAppDirectory = path.join(tmpDirectory, testAppName);
  var cordovaCreateCommand = 'cordova create ' + testAppName;
  exec(cordovaCreateCommand, { cwd: tmpDirectory }, function (err, stdout, stderr) {
    if (err) {
      t.fail('Cordova command should not fail!');
      t.end();
      return;
    }
    install(function () {
      var cordovaPluginsCommand = 'cordova plugins list';
      exec(cordovaPluginsCommand, { cwd: testAppDirectory }, function (err, stdout, stderr) {
        t.ok(stdout.indexOf('io.jxcore.node' >= 0), 'jxcore cordova plugin is installed');
        t.ok(stdout.indexOf('org.thaliproject.p2p' >= 0), 'thali cordova plugin is installed');
        t.end();
      });
    }, testAppDirectory);
  });
});
