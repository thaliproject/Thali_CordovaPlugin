'use strict';

var tape = require('../lib/thaliTape');
var sinon = require('sinon');

var fs = require('fs-extra-promise');
var Promise = require('lie');
var PouchDB = require('pouchdb')
  .plugin(require('pouchdb-size'))
  .plugin(require('thali/NextGeneration/utils/pouchDBCheckpointsPlugin'))
  .defaults({
     db: require('leveldown-mobile')
   });

// DB directory should be unique among all tests and any instance of this test.
// This is especially required for tape.coordinated.
var db;
var dbName = 'pouchdb-uuid:' + Math.random();
var dbOptions = {
  checkpoint: 900
};
var checkpointPluginDelay = 500;

var test = tape({
  setup: function (t) {
    db = new PouchDB(dbName, dbOptions);
    t.end()
  },
  teardown: function (t) {
    db.destroy()
      .then(function () {
        fs.removeSync(dbName);
        t.end();
      })
      .catch(function (error) {
        t.fail(error);
      });
  }
});

var Doc = function () {
  this._id = Date.now().toString()
};

test('onCheckpointReached callback calling on a single change', function (t) {
  var spy = sinon.spy();

  db.onCheckpointReached(spy);

  db.put(new Doc())
    .then(function () {
      // A small latency is needed to calculate database size after put
      setTimeout(function () {
        t.ok(spy.calledOnce, 'checkpointReached handler should be called once. Called ' + spy.callCount + ' time(s)');
        t.end();
      }, checkpointPluginDelay + 300);
    })
    .catch(function (error) {
      t.fail(error);
    });
});

test('onCheckpointReached callback calling on multiple changes' +
'that are in checkpoints plugin delay interval', function (t) {
    var spy = sinon.spy();

    db.onCheckpointReached(spy);

    db.put(new Doc())
      // put some extra docs for 'change' event emission
      .then(function () {
        return db.put(new Doc());
      })
      .then(function () {
        return db.put(new Doc());
      })
      .then(function () {
        // A small latency is needed to calculate database size after put
        setTimeout(function () {
          t.ok(spy.calledOnce, 'checkpointReached handler should be called once. Called ' + spy.callCount + ' time(s)');
          t.end();
        }, checkpointPluginDelay + 300);
      })
      .catch(function (error) {
        t.fail(error);
      });
    });

//  TODO Investigate how to force PouchDB to shrink database size
//  Atfer that test can be enabled
/*
test('onCheckpointReached callback calling after database shrinks', function (t) {
  var spy = sinon.spy();
  var doc = new Doc();

  db.onCheckpointReached(spy);

  db.put(doc)
    .then(function (res) {
      return db.get(res.id);
    })
    .then(function (doc) {
      return db.remove(doc);
    })
    .then(function () {
      return db.compact();
    })
    .then(function () {
      // A small latency is needed to calculate database size after put
      setTimeout(function () {
        t.ok(spu.calledTwice, 'checkpointReached reached handler should be called twice');
        t.end();
      }, 200)
    })
    .catch(function (error) {
      t.fail(error);
    });
});
*/
