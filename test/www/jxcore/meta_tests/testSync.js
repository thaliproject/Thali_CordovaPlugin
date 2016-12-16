'use strict';

var util   = require('util');
var format = util.format;

var Promise = require('bluebird');
var path    = require('path');
var fs      = require('fs');

var tape      = require('../lib/thaliTape');
var testUtils = require('../lib/testUtils');
var logger    = require('../lib/testLogger')('testSync');

if (!tape.coordinated) {
  return;
}


// We will use a files for data verification.
var localData = {
  path:    path.join(testUtils.tmpDirectory(), 'testSync.txt'),
  timeout: Math.floor(Math.random() * 100)
};

var test = tape({
  setup: function (t) {
    t.data = localData;
    t.end();
  },
  teardown: function (t) {
    t.end();
  }
});

function checkAllFiles(participants) {
  var promises = participants.map(function (participant) {
    var path = participant.data.path;
    return new Promise(function (resolve, reject) {
      fs.stat(path, function (error, stats) {
        if (error || !stats.isFile()) {
          reject(new Error(
            format('file does not exist, path: \'%s\'', path)
          ));
        } else {
          logger.debug('file exist, path: \'%s\'', path);
          resolve();
        }
      });
    });
  });
  return Promise.all(promises);
}

function syncWorks (t) {
  return new Promise(function (resolve) {
    setTimeout(resolve, localData.timeout);
  })
  .then(function () {
    // we are creating local file at random period of time.
    return fs.writeFile(localData.path, '');
  })
  .then(function () {
    logger.debug('file created, path: \'%s\'', localData.path);
    return t.sync();
  })
  .then(function () {
    return checkAllFiles(t.participants);
  })
  .then(function () {
    return t.sync();
  })
  .then(function () {
    fs.unlinkSync(localData.path);
    logger.debug('file removed, path: \'%s\'', localData.path);
  });
}

test('test sync works', function (t) {
  syncWorks(t)
  .then(function () {
    t.pass('passed');
  })
  .catch(function (error) {
    t.fail('failed with ' + error.toString());
  })
  .then(function () {
    t.end();
  });
});

test('test multiple syncs works', function (t) {
  syncWorks(t)
  .then(function () {
    return syncWorks(t);
  })
  .then(function () {
    t.pass('passed');
  })
  .catch(function (error) {
    t.fail('failed with ' + error.toString());
  })
  .then(function () {
    t.end();
  });
});
