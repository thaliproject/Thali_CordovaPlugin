'use strict';

var tape = require('../lib/thaliTape');
var testUtils = require('../lib/testUtils.js');

var fs = require('fs-extra-promise');
var path = require('path');
var PouchDB = require('pouchdb');
var PouchDBGenerator = require('thali/NextGeneration/utils/pouchDBGenerator');
var leveldownMobile = require('leveldown-mobile');

// DB defaultDirectory should be unique among all tests
// and any instance of this test.
// This is especially required for tape.coordinated.
var defaultDirectory = path.join(
  testUtils.getPouchDBTestDirectory(),
  'pouch-db-generator-db-' + testUtils.getRandomPouchDBName()
);

var test = tape({
  setup: function (t) {
    fs.ensureDirSync(defaultDirectory);
    t.end();
  },
  teardown: function (t) {
    fs.removeSync(defaultDirectory);
    t.end();
  }
});

test('test defaultDirectory', function (t) {
  var LocalPouchDB = PouchDBGenerator(PouchDB, defaultDirectory, {
    defaultAdapter: leveldownMobile
  });

  var db = LocalPouchDB('https://localhost:3000');
  t.equals(db.__opts.prefix, undefined);

  db = LocalPouchDB('http://localhost:3000');
  t.equals(db.__opts.prefix, undefined);

  db = LocalPouchDB('dbname');
  t.equals(db.__opts.prefix, defaultDirectory);

  t.end();
});

test('test defaultAdapter', function (t) {
  var LocalPouchDB = PouchDBGenerator(PouchDB, defaultDirectory, {
    defaultAdapter: leveldownMobile
  });

  var db = LocalPouchDB('https://localhost:3000');
  t.equals(db._adapter, 'https');
  t.equals(db.__opts.db, undefined);

  db = LocalPouchDB('http://localhost:3000');
  t.equals(db._adapter, 'http');
  t.equals(db.__opts.db, undefined);

  db = LocalPouchDB('dbname');
  t.equals(db._adapter, 'leveldb');
  t.equals(db.__opts.db, leveldownMobile);

  // Passing 'pouchdb' as defaultAdapter has no sense. This is just for testing.
  LocalPouchDB = PouchDBGenerator(PouchDB, defaultDirectory, {
    defaultAdapter: PouchDB
  });
  db = LocalPouchDB('dbname');
  t.equals(db._adapter, 'leveldb');
  t.equals(db.__opts.db, PouchDB);

  t.end();
});
