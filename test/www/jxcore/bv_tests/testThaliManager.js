'use strict';

var tape = require('../lib/thaliTape');

var inherits = require('util').inherits;
var fs = require('fs');
var fs_extra = require('fs-extra');
var crypto = require('crypto');
var PouchDB = require('pouchdb');
var expressPouchDB = require('express-pouchdb');

var ThaliManager = require('thali/NextGeneration/thaliManager');
var thaliConfig = require('thali/NextGeneration/thaliConfig');
var ThaliPeerPoolDefault = require('thali/NextGeneration/thaliPeerPool/thaliPeerPoolDefault');

var defaultDirectory = './db/';
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
      fs_extra.emptyDirSync(defaultDirectory);
      fs.rmdirSync(defaultDirectory);
    }
    t.end();
  }
});


test('test 1', function (t) {
  var ecdhForLocalDevice = crypto.createECDH(thaliConfig.BEACON_CURVE);
  var publicKey = ecdhForLocalDevice.generateKeys();
  var acl = [{
    'role': 'public',
    'paths': [
      {
        'path': '/{:db}',
        'verbs': ['GET']
      }
    ]
  }];
  var thaliManager = new ThaliManager(expressPouchDB, PouchDB, "foo", ecdhForLocalDevice, new ThaliPeerPoolDefault(), acl)
  .start([publicKey])
  .then(function () {
    return this.stop();
  })
  .then(function () {
    t.end();
  });
});
