"use strict";

var os = require('os');
var path = require('path');
var test = require('tape');
var uuid = require('uuid');
var util = require('util');
var express = require('express');
var PouchDB = require('pouchdb');
var bodyParser = require('body-parser');
var randomstring = require('randomstring');
var ThaliReplicationManager = require('thali/thalireplicationmanager');

var dbPath = path.join(os.tmpdir(), 'pouchdb');
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
         "starting event should occur in right order");
    starting = true;
  });

  manager.on('started', function () {
    t.ok(starting == true && started == false && stopping == false && stopped == false,
         "started event should occur in right order");
    started = true;
    manager.stop();
  });

  manager.on('stopping', function() {
    t.ok(starting == true && started == true && stopping == false && stopped == false,
         "stopping event should occur in right order");
    stopping = true;
  });

  manager.on('stopped', function () {
    t.ok(starting == true && started == true && stopping == true && stopped == false,
         "stopped event should occur in right order");
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

  PouchDB.debug.enable('*');
  
  /*
    Create a local doc with local device name and sync to peer. On receiving that they'll swap
    their device name for ours and sync it back. When both sides have sucesfully done this and 
    have seen the changes we know two-sync is working.
  */

  // Need to recreate since reinstall of test does not delete the db
  // meaning we get unexpected sequence numbers

  var db = new LevelDownPouchDB('thali');
  db.destroy(function(response) {

    db = new LevelDownPouchDB('thali');

    var mydevicename = null;
    var mydocid = uuid.v4();
    var mydoc = {
      _id: mydocid
    };
 
    // Listen for changes from the other side

    var seenLocalChanges = false;
    var seenRemoteChanges = false;

    var manager = new ThaliReplicationManager(db);

    var changes = db.changes({
      since: 'now',
      live: true,
      include_docs: true
    }).on('change', function(change) {
      var doc = change.doc;
      if (doc._id == mydocid) {
        t.ok(doc.data == mydevicename, "1st change of local doc should contain local id");
        seenLocalChanges = true;
        if (seenRemoteChanges) {
          manager.stop();
        }
      } else {
        t.ok(doc.data != mydevicename, "1st change of remote doc should contain remote id");
        seenRemoteChanges = true;
        if (seenLocalChanges) {
          manager.stop();
        }
      }
    }).on('complete', function(info) {
      console.log(info);
    }).on('error', function (err) {
      err = err ? " (" + err + ")" : "";
      t.notOk(err, "Should not see errors in changes" + err);
    });

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

        // Actually create the new doc
        mydevicename = deviceName;
        mydoc.data = mydevicename;
        var r = db.put(mydoc, function (err, result) {
          err = err ? " (" + err + ")" : "";
          t.notOk(err, "Should be able to put doc without error" + err);
        });
      }); 
    });

    manager.on('stopped', function () {
      t.end();
    });

    var app = express();
    app.disable('x-powered-by');
    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: true }));
    app.use('/db', require('express-pouchdb')(LevelDownPouchDB, { mode: 'minimumForPouchDB'}));
    app.listen(4242, function() {
      // Start replication
      manager.start(4242, 'thali');
    });
  });
});

