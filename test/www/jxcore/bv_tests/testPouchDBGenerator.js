'use strict';

var tape = require('../lib/thaliTape');

var fs = require('fs');
var PouchDB = require('pouchdb');
var PouchDBGenerator = require('thali/NextGeneration/utils/pouchDBGenerator');
var leveldownMobile = require('leveldown-mobile');

var defaultDirectory = './db/';
var defaultAdapter = 'leveldown-mobile';

if (! fs.existsSync(defaultDirectory)){
    fs.mkdirSync(defaultDirectory);
}

var test = tape({
  setup: function (t) {
    t.end();
  },
  teardown: function (t) {
    t.end();
  }
});

test('test defaultDirectory', function (t) {
  var LocalPouchDB = PouchDBGenerator(PouchDB, defaultDirectory, {
    defaultAdapter: defaultAdapter
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
    defaultAdapter: defaultAdapter
  });
  
  var db = LocalPouchDB('https://localhost:3000');
  t.equals(db._adapter, 'https');
  t.equals(db.__opts.db, undefined);
  
  db = LocalPouchDB('http://localhost:3000');
  t.equals(db._adapter, 'http');
  t.equals(db.__opts.db, undefined);
  
  db = LocalPouchDB('dbname');
  t.equals(db._adapter, 'leveldb');
  t.equals(db.__opts.db.name, "LevelDOWN");
  t.equals(leveldownMobile.name, "LevelDOWN");
  
  t.end();
});
