'use strict';

var tape = require('../lib/thaliTape');

var fs = require('fs');
var fs_extra = require('fs-extra');
var PouchDB = require('pouchdb');
var PouchDBGenerator = require('thali/NextGeneration/utils/pouchDBGenerator');
var leveldownMobile = require('leveldown-mobile');

var defaultDirectory = './db/';

var test = tape({
  setup: function (t) {
    if (fs.existsSync(defaultDirectory)) {
      fs_extra.emptyDirSync(defaultDirectory);
    } else {
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
