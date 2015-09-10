"use strict";

var os = require("os");
var test = require('tape');
var uuid = require('node-uuid');
var PouchDB = require('pouchdb');
var randomstring = require('randomstring');
var ThaliReplicationManager = require('thali/thalireplicationmanager');

var dbPath = "."; //path.join(os.tmpdir(), 'pouchdb');
var LevelDownPouchDB = process.platform === 'android' || process.platform === 'ios' ?
    PouchDB.defaults({db: require('leveldown-mobile'), prefix: dbPath}) :
    PouchDB.defaults({db: require('leveldown'), prefix: dbPath});

test('ThaliReplicationManager can call start without error', function (t) {

  var starting = false;
  var started = false;
  var stopping = false
  var stopped = false;

  // Check that TRM starts and emits event in the expected order
  var manager = new ThaliReplicationManager(new LevelDownPouchDB('thali'));

  manager.on('startError', function () {
    t.fail('startError event should not be emitted');
    t.end();
  });
 
  manager.on('stopError', function () {
    t.fail('stopError event should not be emitted');
    t.end();
  });
  
  manager.on('starting', function () {
    t.ok(starting == false && started == false && stopping == false && stopped == false,
         "starting event emitted out of order");
    starting = true;
  });

  manager.on('started', function () {
    t.ok(starting == true && started == false && stopping == false && stopped == false,
         "started event emitted out of order");
    started = true;
    manager.stop();
  });

  manager.on('stopping', function() {
    t.ok(starting == true && started == true && stopping == false && stopped == false,
         "stopping event emitted out of order");
    stopping = true;
  });

  manager.on('stopped', function () {
    t.ok(starting == true && started == true && stopping == true && stopped == false,
         "stopped event emitted out of order");
    t.end();
  });

  manager.start(5000, 'thali');
});

test('ThaliReplicationManager receives identity', function (t) {

  var manager = new ThaliReplicationManager(new LevelDownPouchDB('thali'));

  manager.on('startError', function () {
    t.fail('startError event should not be emitted');
    t.end();
  });
 
  manager.on('stopError', function () {
    t.fail('stopError event should not be emitted');
    t.end();
  });
  
  manager.on('started', function () {
    manager.getDeviceIdentity(function (err, deviceName) {
      t.notOk(err, "getDeviceIdentity should not return an error");
      t.ok(deviceName, "deviceName should not be null");
      manager.stop();
    });
  });

  manager.on('stopped', function () {
    t.end();
  });

  manager.start(5000, 'thali');
});

test('ThaliReplicationManager replicates database', function (t) {

  var db = new LevelDownPouchDB('thali');
  var manager = new ThaliReplicationManager(db);

  manager.on('startError', function () {
    t.fail('startError event should not be emitted');
    t.end();
  });
 
  manager.on('stopError', function () {
    t.fail('stopError event should not be emitted');
    t.end();
  });
  
  manager.on('started', function () {
  });

  manager.on('stopped', function () {
    t.end();
  });

  // Create a doc to sync to other side
  var mydocid = uuid.v4();
  var myrandomdata = randomstring.generate();
  var mydoc = {
    _id: mydocid,
    data : myrandomdata
  };

  db.put(mydoc, function callback(err, result) {
    t.notOk(err, "Should be able to put doc without error");
  }); 

  // Listen for changes from the other side
  var changes = db.changes({
    since: 'now',
    live: true,
    include_docs: true
  }).on('change', function(change) {
    console.log(change);
    for (doc in change) {
      if (doc.id != mydocid) {
        // A new doc from another peer
        console.log(doc.id);
      }
    }    
  }).on('complete', function(info) {
    console.log(info);
  }).on('error', function (err) {
    console.log(err);
  });

  // Start replication
  manager.start(5000, 'thali');
});


