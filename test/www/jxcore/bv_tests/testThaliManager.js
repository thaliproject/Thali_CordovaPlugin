'use strict';

var tape = require('../lib/thaliTape');
var testUtils = require('../lib/testUtils.js');

var fs = require('fs');
var path = require('path');
var del = require('del');
var crypto = require('crypto');
var PouchDB = require('pouchdb');
var expressPouchDB = require('express-pouchdb');
var leveldownMobile = require('leveldown-mobile');

var PouchDBGenerator = require('thali/NextGeneration/utils/pouchDBGenerator');
var ThaliManager = require('thali/NextGeneration/thaliManager');
var thaliConfig = require('thali/NextGeneration/thaliConfig');
var ThaliPeerPoolDefault = require('thali/NextGeneration/thaliPeerPool/thaliPeerPoolDefault');

// DB defaultDirectory should be unique among all tests
// and any instance of this test.
// This is especially required for tape.coordinated.
var defaultDirectory = path.join(
  testUtils.getPouchDBTestDirectory(),
  'thali-manager-db-' + testUtils.getUniqueRandomName()
);
thaliConfig.BASE_DB_PREFIX = defaultDirectory;

var test = tape({
  setup: function (t) {
    if (!fs.existsSync(defaultDirectory)) {
      fs.mkdirSync(defaultDirectory);
    }
    t.end();
  },
  teardown: function (t) {
    if (fs.existsSync(defaultDirectory)) {
      del(defaultDirectory, { force: true }).then(function () {
        t.end();
      });
    } else {
      t.end();
    }
  }
});

test('test 1', function (t) {
  var ecdhForLocalDevice = crypto.createECDH(thaliConfig.BEACON_CURVE);
  var publicKey = ecdhForLocalDevice.generateKeys();
  
  PouchDB = PouchDBGenerator(PouchDB, thaliConfig.BASE_DB_PREFIX, {
    defaultAdapter: leveldownMobile
  });
  
  var thaliManager = new ThaliManager(
    expressPouchDB,
    PouchDB,
    testUtils.getUniqueRandomName(),
    ecdhForLocalDevice,
    new ThaliPeerPoolDefault()
  );
  thaliManager.start([publicKey])
  .then(function () {
    return thaliManager.stop();
  })
  .then(function () {
    t.end();
  });
});
