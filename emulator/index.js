// Require Mock Mobile
require('../thali/mockmobile');
var ThaliReplicationManager = require('../thali/thalireplicationmanager');
var express = require('express');
var expressPouchDB = require('express-pouchdb');
var PouchDB = require('pouchdb');
var path = require('path');
var os = require('os');

// Set up PouchDB defaults for leveldown
PouchDB.defaults({db: require('leveldown'), prefix: dbPath});

// Set up two app servers
var app1 = express();
var app2 = express();

app1.disable('x-powered-by');
app2.disable('x-powered-by');

// Add Express PouchDB
app1.use('/db', expressPouchDB)(LevelDownPouchDB, { mode: 'minimumForPouchDB'}));
app2.use('/db', expressPouchDB)(LevelDownPouchDB, { mode: 'minimumForPouchDB'}));
var db1 = new LevelDownPouchDB('thali');
var db2 = new LevelDownPouchDB('thali');

app1.listen(5001, function () {
  var manager = new ThaliReplicationManager(db1);
});

app2.listen(5002, function () {
  var manager = new ThaliReplicationManager(db2);
});
