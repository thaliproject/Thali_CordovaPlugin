'use strict';

var tape = require('../lib/thaliTape');

var fs = require('fs');
var PouchDB = require('pouchdb');
var PouchDBGenerator = require('thali/NextGeneration/utils/pouchDBGenerator');
var leveldownMobile = require('leveldown-mobile');

var defaultDirectory = './db/';

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

function compareFunctions(a, b) {
  if (a.toString() != b.toString()) {
    return false;
  }
  // this code is going to compare toString() of all functions in the prototype
  function getPrototypeKeys(obj) {
    var keys = [];
    for (var key in obj.prototype) {
      if (obj.prototype.hasOwnProperty(key) && typeof obj.prototype[key] === 'function') {
        keys.push(key);
      }
    }
    return keys;
  }
  var keys = getPrototypeKeys(a).concat(getPrototypeKeys(b));
  for (var i = 0; i < keys.length; i ++) {
    var key = keys[i];
    if (
       !a.prototype.hasOwnProperty(key) ||
       !b.prototype.hasOwnProperty(key) ||
       a.prototype[key].toString() != b.prototype[key].toString()
    ) {
      return false;
    }
  }
  return true;
}

test('test defaultDirectory', function (t) {
  var LocalPouchDB = PouchDBGenerator(PouchDB, defaultDirectory);

  var db = LocalPouchDB('https://localhost:3000');
  t.equals(db.__opts.prefix, undefined);

  db = LocalPouchDB('http://localhost:3000');
  t.equals(db.__opts.prefix, undefined);

  db = LocalPouchDB('dbname');
  t.equals(db.__opts.prefix, defaultDirectory);

  t.end();
});

test('test defaultAdapter', function (t) {
  var LocalPouchDB = PouchDBGenerator(PouchDB, defaultDirectory);

  var db = LocalPouchDB('https://localhost:3000');
  t.equals(db._adapter, 'https');
  t.equals(db.__opts.db, undefined);

  db = LocalPouchDB('http://localhost:3000');
  t.equals(db._adapter, 'http');
  t.equals(db.__opts.db, undefined);

  db = LocalPouchDB('dbname');
  t.equals(db._adapter, 'leveldb');
  t.ok(compareFunctions(db.__opts.db, leveldownMobile));

  // Passing 'pouchdb' as defaultAdapter has no sense. This is just for testing.
  LocalPouchDB = PouchDBGenerator(PouchDB, defaultDirectory, {
    defaultAdapter: 'pouchdb'
  });
  db = LocalPouchDB('dbname');
  t.equals(db._adapter, 'leveldb');
  t.ok(compareFunctions(db.__opts.db, PouchDB));

  t.end();
});
